# -*- coding: utf-8 -*-
"""
QDII 指数基金限额监控 — 每日扫描脚本

直接请求天天基金申购状态接口（t=8）拉取全市场数据，筛选出监控清单内
的场外基金，补充详情（收益/规模/跟踪误差/费率/跟踪标的）与安鑫乐直销
限额，写入 SQLite 快照并与历史对比生成变更日志，导出 data.json 与
worldpage-data.json 供前端页面使用。cron 每日定时运行，同日重跑幂等。
"""
import argparse
import copy
import json
import logging
import math
import re
import sqlite3
import sys
import time
from datetime import date, datetime
from pathlib import Path

from akshare.utils import demjson
import pandas as pd
import requests
from typing import Optional

from fetch_direct_limit import fetch_direct_limits
from direct_limit_store import (init_store, save_observations, read_observations,
                               apply_observations, publication_lock, write_json)
from fund_registry import init_fund_registry, read_registry, sync_registry_scan

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "fund.db"
# 默认输出到前端 public/（开发模式 Vite 直接可用）；部署时用 --out 指向 dist 目录
DATA_JSON = BASE_DIR.parent / "public" / "qdii" / "data.json"
WORLD_DATA_JSON = BASE_DIR.parent / "public" / "qdii" / "world-data.json"
ACTIVE_QDII_POOL_PATH = BASE_DIR / "active_qdii_pool.json"
ACTIVE_QDII_METADATA_PATH = BASE_DIR / "active_qdii_metadata.json"

# ---------------------------------------------------------------------------
# 筛选规则：index_key -> (展示名, 基金简称包含的任一关键词)
# 新增跟踪指数只需在这里加一行，例如 "spinfo": ("标普信息科技", ["标普信息科技"])
# ---------------------------------------------------------------------------
INDEX_RULES = {
    "nasdaq100": ("纳斯达克100", ["纳斯达克100", "纳指", "纳斯达克科技"]),
    "sp500": ("标普500", ["标普500"]),
}

# 业务人工核验值：数据源同步正确后应删除对应覆盖项。
FUND_OVERRIDES = {
    "012979": {"direct_limit_amount": 100_000_000_000,
               "direct_as_of": "2026-09-22", "direct_source": "人工核验"},
    "012980": {"direct_limit_amount": 100_000_000_000,
               "direct_as_of": "2026-09-22", "direct_source": "人工核验"},
    "022005": {"status": "暂停申购"},
}


def apply_fund_overrides(records: list[dict]) -> None:
    for record in records:
        override = FUND_OVERRIDES.get(record["code"])
        if override:
            record.update(override)

# ---------------------------------------------------------------------------
# 其他市场基金：以 2026Q2 的 104 只主动权益 QDII 产品为冻结母池。
# 同一产品的人民币 A/C 等份额在清单中合并，页面只展示代表代码。
# data.json 只导出 INDEX_RULES 基金（美国页不受影响）；world 基金的快照与
# 变更正常入库，供后续 world-data.json 导出使用。
# ---------------------------------------------------------------------------
WORLD_INDEX_KEY = "world"

# ---------------------------------------------------------------------------
# 世界页（/qdii/world）监控清单：与前端 worldFunds.js 静态快照同集，
# 每日扫描天天基金刷新申购状态/限额，导出 worldpage-data.json 供前端合并。
# 清单中已被 INDEX_RULES 关键词命中的基金（美国段纳指/标普联接）保留原
# index_key，导出时按代码从 records 全集取数。
# ---------------------------------------------------------------------------
WORLD_PAGE_INDEX_KEY = "worldpage"
WORLD_PAGE_WATCHLIST_PATH = BASE_DIR / "world_watchlist.json"
WORLD_PAGE_DATA_JSON = BASE_DIR.parent / "public" / "qdii" / "worldpage-data.json"


def load_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logging.getLogger("scanner").warning("读取 %s 失败: %s", path, exc)
        return fallback


ACTIVE_QDII_POOL = load_json(ACTIVE_QDII_POOL_PATH, {"funds": []})
ACTIVE_QDII_FUNDS = ACTIVE_QDII_POOL.get("funds", [])
ACTIVE_QDII_BY_CODE = {fund["code"]: fund for fund in ACTIVE_QDII_FUNDS}
WORLD_CODES = set(ACTIVE_QDII_BY_CODE)

WORLD_PAGE_WATCHLIST = load_json(WORLD_PAGE_WATCHLIST_PATH, {"funds": []})
WORLD_PAGE_FUNDS = WORLD_PAGE_WATCHLIST.get("funds", [])
WORLD_PAGE_BY_CODE = {fund["code"]: fund for fund in WORLD_PAGE_FUNDS}

RETRY_TIMES = 3
RETRY_INTERVAL = 60  # 秒

# 年化跟踪误差取自天天基金"特殊指标"页（静态渲染的表格）。
# 先锚定"年化跟踪误差"表头，再取其后第一行数据（跟踪指数名、误差值、同类平均），
# 避免误匹配页面其他区块的百分比。
# 如: <th>年化跟踪误差</th>...<td >纳斯达克100指数</td><td >0.33%</td><td >2.29%</td>
TSDATA_URL = "https://fundf10.eastmoney.com/tsdata_{code}.html"
TE_ROW_RE = re.compile(
    r"年化跟踪误差.*?<td[^>]*>[^<]*</td><td[^>]*>([\d.]+)%</td>", re.S
)
FUND_DETAIL_URL = "https://fund.eastmoney.com/{code}.html"
DETAIL_RETURN_LABELS = {
    "return_1m": "近1月",
    "return_6m": "近6月",
    "return_1y": "近1年",
    "return_3y": "近3年",
    "return_since": "成立来",
}
INCEPTION_DATE_RE = re.compile(
    r'<span[^>]*>成\s*立\s*日</span>：\s*(\d{4}-\d{2}-\d{2})', re.S
)
FUND_SIZE_RE = re.compile(
    r'>规模</a>：\s*([\d.]+)\s*亿元（(\d{4}-\d{2}-\d{2})）', re.S
)
FUND_FEE_URL = "https://fundf10.eastmoney.com/jjfl_{code}.html"
FEE_RATE_LABELS = {
    "management_fee_rate": "管理费率",
    "custody_fee_rate": "托管费率",
    "sales_service_fee_rate": "销售服务费率",
}
TS_REQUEST_INTERVAL = 0.3  # 抓取间隔，避免请求过快

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()],
)
log = logging.getLogger("scanner")


def fetch_purchase() -> pd.DataFrame:
    """直接读取天天基金原始金额，避免 AkShare 将带单位的额度提前转为 NaN。"""
    last_err = None
    for i in range(1, RETRY_TIMES + 1):
        try:
            response = requests.get(
                'https://fund.eastmoney.com/Data/Fund_JJJZ_Data.aspx',
                params={'t': '8', 'page': '1,50000', 'js': 'reData', 'sort': 'fcode,asc'},
                headers={'User-Agent': 'Mozilla/5.0'}, timeout=30,
            )
            response.raise_for_status()
            payload = demjson.decode(response.text.split('=', 1)[-1].strip().rstrip(';'))
            rows = payload.get('datas') if isinstance(payload, dict) else None
            if not isinstance(rows, list) or not rows:
                raise RuntimeError("接口返回空数据")
            if any(not isinstance(row, list) or len(row) < 13 for row in rows):
                raise RuntimeError('申购接口字段结构发生变化')
            return pd.DataFrame([
                {'基金代码': row[0], '基金简称': row[1], '申购状态': row[5],
                 '赎回状态': row[6], '购买起点': row[8],
                 '日累计限定金额': row[9], '手续费': row[12]}
                for row in rows
            ])
        except Exception as e:  # noqa: BLE001
            last_err = e
            log.warning("第 %d/%d 次拉取失败: %s", i, RETRY_TIMES, e)
            if i < RETRY_TIMES:
                time.sleep(RETRY_INTERVAL)
    raise RuntimeError(f"拉取失败，已重试 {RETRY_TIMES} 次: {last_err}")


def filter_funds(df: pd.DataFrame) -> list[dict]:
    """按 INDEX_RULES（关键词）+ WORLD_CODES（显式代码）筛选目标场外基金。

    排除场内品种：申购状态为"场内交易"的，以及名称含"ETF"但不含"联接"
    的纯场内 ETF（如 513100 纳指ETF国泰）。"ETF联接/发起联接"是场外，
    保留。
    """
    records = []
    name_col = df["基金简称"].astype(str)

    def parse_number(value) -> Optional[float]:
        """保留未知值；支持元/万/亿及费率百分号，拒绝非有限值。"""
        if isinstance(value, bool) or value is None:
            return None
        multiplier = 1
        if isinstance(value, str):
            match = re.fullmatch(r'\s*([\d,]+(?:\.\d+)?)\s*([万亿]?)\s*(?:元|%)?\s*', value)
            if not match:
                return None
            value = match.group(1).replace(',', '')
            multiplier = {'': 1, '万': 10000, '亿': 100000000}[match.group(2)]
        try:
            n = float(value) * multiplier
        except (TypeError, ValueError):
            return None
        return n if math.isfinite(n) and n >= 0 else None

    def append_row(row, index_key: str, code_override: str = None,
                   name_override: str = None, share_codes: list[str] = None) -> None:
        name = str(row["基金简称"]).strip()
        status = str(row["申购状态"]).strip()
        if status.lower() in {"", "nan", "none"}:
            status = "暂无申购信息"
        if status == "场内交易":
            return
        if "ETF" in name and "联接" not in name:
            return
        records.append(
            {
                "code": str(row["基金代码"]).zfill(6),
                "name": name_override or name,
                "index_key": index_key,
                "status": status,
                "redeem": str(row["赎回状态"]).strip() or "暂无赎回信息",
                "limit_amount": parse_number(row["日累计限定金额"]),
                "min_buy": parse_number(row["购买起点"]),
                "fee": parse_number(row["手续费"]),
                "share_codes": share_codes or [str(row["基金代码"]).zfill(6)],
            }
        )
        if code_override:
            records[-1]["code"] = code_override

    for index_key, (_, keywords) in INDEX_RULES.items():
        mask = name_col.apply(lambda n: any(k in n for k in keywords))
        for _, row in df[mask].iterrows():
            append_row(row, index_key)
    rows_by_code = {
        str(row["基金代码"]).zfill(6): row
        for _, row in df.iterrows()
    }
    for fund in ACTIVE_QDII_FUNDS:
        candidate_codes = list(dict.fromkeys([fund["code"], *fund.get("share_codes", [])]))
        available_codes = [code for code in candidate_codes if code in rows_by_code]
        available_code = next((code for code in available_codes
                               if str(rows_by_code[code]["申购状态"]).strip()),
                              available_codes[0] if available_codes else None)
        if available_code:
            append_row(
                rows_by_code[available_code],
                WORLD_INDEX_KEY,
                code_override=fund["code"],
                name_override=fund["name"],
                share_codes=fund.get("share_codes", [fund["code"]]),
            )
    # 世界页清单：已被 INDEX_RULES 命中的基金（如纳指/标普联接）最终会被下方
    # 去重保留先匹配的 index_key；其余按 worldpage 入库，参与变更检测
    for fund in WORLD_PAGE_FUNDS:
        row = rows_by_code.get(fund["code"])
        if row is not None:
            append_row(row, WORLD_PAGE_INDEX_KEY,
                       code_override=fund["code"], name_override=fund["name"])
    # 一只基金可能同时命中多条规则，保留先匹配到的
    seen, unique = set(), []
    for r in records:
        if r["code"] not in seen:
            seen.add(r["code"])
            unique.append(r)
    return unique


def _parse_cell_number(value) -> Optional[float]:
    """申购表单元格 → 数值（元）；保留未知，支持万/亿与费率百分号，允许负数。"""
    if isinstance(value, bool) or value is None:
        return None
    multiplier = 1
    if isinstance(value, str):
        match = re.fullmatch(r'\s*(-?[\d,]+(?:\.\d+)?)\s*([万亿]?)\s*(?:元|%)?\s*', value)
        if not match:
            return None
        value = match.group(1).replace(',', '')
        multiplier = {'': 1, '万': 10000, '亿': 100000000}[match.group(2)]
    try:
        n = float(value) * multiplier
    except (TypeError, ValueError):
        return None
    return n if math.isfinite(n) else None


def build_registry_record(row, registry: dict) -> dict:
    """后台新增、但未被静态关键词命中的基金：从申购行 + registry 主数据构造记录。"""
    code = registry["code"]
    name = registry.get("name") or str(row["基金简称"]).strip()
    # 美国新增基金归 manual（随 data.json 出口），其余进世界页 worldpage
    index_key = registry.get("index_key") or (
        "manual" if registry.get("market") == "us" else WORLD_PAGE_INDEX_KEY
    )
    status = str(row["申购状态"]).strip()
    if status.lower() in {"", "nan", "none"}:
        status = "暂无申购信息"
    return {
        "code": code,
        "name": name,
        "kind": registry.get("kind") or "其他",
        "index_key": index_key,
        "status": status,
        "redeem": str(row["赎回状态"]).strip() or "暂无赎回信息",
        "limit_amount": _parse_cell_number(row["日累计限定金额"]),
        "min_buy": _parse_cell_number(row["购买起点"]),
        "fee": _parse_cell_number(row["手续费"]),
        "region": registry.get("region") or "其他市场",
        "share_codes": [code],
    }


def augment_records_with_registry(df: pd.DataFrame, records: list[dict],
                                  registry_rows: list[dict]) -> list[dict]:
    """把名册 active、但静态筛选未命中的基金从当日申购数据补入；并回填 kind/region。

    kind / region 由后台管理、申购状态表不提供，静态筛选记录也缺这两个字段，
    因此统一用名册主数据回填，保证前台类型筛选与国家分组对所有基金成立。
    """
    registry_by_code = {r["code"]: r for r in registry_rows}
    for rec in records:
        reg = registry_by_code.get(rec["code"])
        if not reg:
            continue
        if not rec.get("kind") and reg.get("kind"):
            rec["kind"] = reg["kind"]
        if not rec.get("region") and reg.get("region"):
            rec["region"] = reg["region"]

    present = {r["code"] for r in records}
    code_col = df["基金代码"].astype(str).str.zfill(6)
    for registry in registry_rows:
        code = registry["code"]
        if code in present:
            continue
        fallback_key = registry.get("index_key") or (
            "manual" if registry.get("market") == "us" else WORLD_PAGE_INDEX_KEY)
        hit = df[code_col == code]
        if hit.empty:
            # 当日申购表无此基金行（如已停售下架）：保留主数据占位，enrich 补详情
            records.append({
                "code": code, "name": registry.get("name"),
                "kind": registry.get("kind") or "其他",
                "index_key": fallback_key,
                "status": "暂无申购信息", "redeem": "暂无赎回信息",
                "limit_amount": None, "min_buy": None, "fee": None,
                "region": registry.get("region") or "其他市场",
                "share_codes": [code],
            })
            continue
        records.append(build_registry_record(hit.iloc[0], registry))
    return records


def fetch_tracking_error(code: str, session: requests.Session) -> Optional[float]:
    """从天天基金特殊指标页解析年化跟踪误差（百分数值，如 1.17）。

    失败或页面无数据返回 None，不抛异常——跟踪误差缺失不影响主流程。
    """
    try:
        r = session.get(TSDATA_URL.format(code=code), timeout=15)
        r.raise_for_status()
        m = TE_ROW_RE.search(r.text)
        return float(m.group(1)) if m else None
    except Exception as e:  # noqa: BLE001
        log.debug("跟踪误差抓取失败 %s: %s", code, e)
        return None


def empty_fund_details() -> dict:
    """返回字段完整的空详情，保证导出的 JSON 结构稳定。"""
    return {
        "track_target": None,
        "return_1m": None,
        "return_6m": None,
        "return_1y": None,
        "return_3y": None,
        "return_since": None,
        "inception_date": None,
        "fund_size": None,
        "fund_size_date": None,
    }


def empty_fee_details() -> dict:
    """返回字段完整的空费率详情。"""
    return {
        "management_fee_rate": None,
        "custody_fee_rate": None,
        "sales_service_fee_rate": None,
        "operation_fee_rate": None,
    }


def parse_fee_details_html(html: str) -> dict:
    """解析天天基金费率页中的年度运作费率。"""
    details = empty_fee_details()
    for field, label in FEE_RATE_LABELS.items():
        match = re.search(
            rf'>{label}</td>\s*<td[^>]*>\s*([\d.]+)%',
            html,
            re.S,
        )
        if match:
            details[field] = float(match.group(1))

    management = details["management_fee_rate"]
    custody = details["custody_fee_rate"]
    if management is not None and custody is not None:
        details["operation_fee_rate"] = round(
            management + custody + (details["sales_service_fee_rate"] or 0),
            4,
        )
    return details


def parse_fund_details_html(html: str) -> dict:
    """从天天基金主页 HTML 解析收益率、成立日和单只基金规模。"""
    details = empty_fund_details()
    target = re.search(r'跟踪标的[：:]\s*</a>\s*([^<|]+)', html)
    if target:
        from html import unescape
        value = unescape(target.group(1)).strip()
        if value not in {'', '--', '无', '该基金无跟踪标的'}:
            details['track_target'] = value
    for field, label in DETAIL_RETURN_LABELS.items():
        match = re.search(
            rf'{label}：</span>\s*<span[^>]*>\s*([^<]+?)\s*</span>',
            html,
            re.S,
        )
        if not match:
            continue
        raw = match.group(1).strip().replace(",", "").rstrip("%").strip()
        if raw and raw != "--":
            try:
                value = float(raw)
                details[field] = value if math.isfinite(value) else None
            except ValueError:
                pass

    inception_match = INCEPTION_DATE_RE.search(html)
    if inception_match:
        details["inception_date"] = inception_match.group(1)

    size_match = FUND_SIZE_RE.search(html)
    if size_match:
        details["fund_size"] = float(size_match.group(1))
        details["fund_size_date"] = size_match.group(2)
    return details


def fetch_fund_details(code: str, session: requests.Session) -> dict:
    """请求天天基金主页并解析详情；失败时返回全空字段，不中断扫描。"""
    try:
        response = session.get(FUND_DETAIL_URL.format(code=code), timeout=15)
        response.raise_for_status()
        return parse_fund_details_html(response.content.decode("utf-8-sig"))
    except Exception as e:  # noqa: BLE001
        log.debug("基金详情抓取失败 %s: %s", code, e)
        return empty_fund_details()


def fetch_fee_details(code: str, session: requests.Session) -> dict:
    """请求天天基金费率页；失败时返回全空字段，不中断扫描。"""
    try:
        response = session.get(FUND_FEE_URL.format(code=code), timeout=15)
        response.raise_for_status()
        return parse_fee_details_html(response.content.decode("utf-8-sig"))
    except Exception as e:  # noqa: BLE001
        log.debug("基金费率抓取失败 %s: %s", code, e)
        return empty_fee_details()


def enrich_fund_details(records: list[dict]) -> None:
    """为每只基金补充跟踪误差、收益、规模和运作费率（原地更新）。"""
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0"})
    tracking_error_count = 0
    details_count = 0
    fee_details_count = 0
    for i, r in enumerate(records):
        is_world = r["index_key"] == WORLD_INDEX_KEY
        r["tracking_error"] = None if is_world else fetch_tracking_error(r["code"], session)
        if r["tracking_error"] is not None:
            tracking_error_count += 1
        details = fetch_fund_details(r["code"], session)
        r.update(details)
        if is_world and len(r.get("share_codes", [])) > 1:
            sizes = [details] if details.get("fund_size") is not None else []
            for share_code in r["share_codes"]:
                if share_code == r["code"]:
                    continue
                share_details = fetch_fund_details(share_code, session)
                if share_details.get("fund_size") is not None:
                    sizes.append(share_details)
                time.sleep(0.05)
            if sizes:
                r["fund_size"] = round(sum(item["fund_size"] for item in sizes), 4)
                r["fund_size_date"] = max(
                    (item.get("fund_size_date") or "" for item in sizes),
                    default=None,
                ) or None
        if any(value is not None for value in details.values()):
            details_count += 1
        fee_details = fetch_fee_details(r["code"], session)
        r.update(fee_details)
        if fee_details["operation_fee_rate"] is not None:
            fee_details_count += 1
        if i < len(records) - 1:
            time.sleep(TS_REQUEST_INTERVAL)
    log.info("跟踪误差获取成功 %d/%d", tracking_error_count, len(records))
    log.info("基金详情获取成功 %d/%d", details_count, len(records))
    log.info("基金运作费率获取成功 %d/%d", fee_details_count, len(records))


def merge_direct_limits(records: list[dict], conn: sqlite3.Connection) -> Optional[str]:
    """网站与 AI 共用持久化额度；失败保留最近有效值，按每只基金日期合并。"""
    try:
        # 正则公众号解析不再充当 AI；外部 AI 任务通过统一导入脚本入库。
        data = fetch_direct_limits(allow_wechat_fallback=False)
        save_observations(conn, data)
    except Exception as exc:
        log.warning("直销网站不可用，使用已保存的有效额度: %s", exc)
    observations = read_observations(conn)
    apply_observations(records, observations, clear_missing=True)
    dates = [r['direct_as_of'] for r in records if r.get('direct_as_of')]
    return max(dates) if dates else None


def init_db(conn: sqlite3.Connection) -> None:
    init_store(conn)
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS funds (
            code TEXT PRIMARY KEY, name TEXT NOT NULL, index_key TEXT NOT NULL,
            status TEXT, redeem TEXT, limit_amount REAL, min_buy REAL, updated_at TEXT,
            tracking_error REAL, fee REAL, return_3y REAL,
            management_fee_rate REAL, custody_fee_rate REAL,
            sales_service_fee_rate REAL, operation_fee_rate REAL
        );
        CREATE TABLE IF NOT EXISTS snapshots (
            code TEXT NOT NULL, date TEXT NOT NULL, status TEXT, redeem TEXT,
            limit_amount REAL, direct_limit_amount REAL,
            PRIMARY KEY (code, date)
        );
        CREATE TABLE IF NOT EXISTS changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL,
            date TEXT NOT NULL, field TEXT NOT NULL, old_val TEXT, new_val TEXT
        );
        """
    )
    # 存量库迁移：老表缺列时补上。
    # 以下均为完整固定 SQL 字符串（SQLite 列定义无法参数绑定），
    # 不存在任何外部输入参与构造。
    cols = {row[1] for row in conn.execute("PRAGMA table_info(funds)")}
    MIGRATION_SQL = (
        "ALTER TABLE funds ADD COLUMN track_target TEXT",
        "ALTER TABLE funds ADD COLUMN tracking_error REAL",
        "ALTER TABLE funds ADD COLUMN fee REAL",
        "ALTER TABLE funds ADD COLUMN return_1m REAL",
        "ALTER TABLE funds ADD COLUMN return_6m REAL",
        "ALTER TABLE funds ADD COLUMN return_1y REAL",
        "ALTER TABLE funds ADD COLUMN return_3y REAL",
        "ALTER TABLE funds ADD COLUMN return_since REAL",
        "ALTER TABLE funds ADD COLUMN inception_date TEXT",
        "ALTER TABLE funds ADD COLUMN fund_size REAL",
        "ALTER TABLE funds ADD COLUMN fund_size_date TEXT",
        "ALTER TABLE funds ADD COLUMN management_fee_rate REAL",
        "ALTER TABLE funds ADD COLUMN custody_fee_rate REAL",
        "ALTER TABLE funds ADD COLUMN sales_service_fee_rate REAL",
        "ALTER TABLE funds ADD COLUMN operation_fee_rate REAL",
    )
    for sql in MIGRATION_SQL:
        col = sql.split("ADD COLUMN ", 1)[1].split()[0]
        if col not in cols:
            conn.execute(sql)
    snapshot_cols = {row[1] for row in conn.execute("PRAGMA table_info(snapshots)")}
    if "direct_limit_amount" not in snapshot_cols:
        conn.execute("ALTER TABLE snapshots ADD COLUMN direct_limit_amount REAL")
    conn.commit()


def save_snapshot(conn: sqlite3.Connection, records: list[dict], today: str) -> list[dict]:
    """写入当日快照并对比历史生成变更记录。返回本次变更列表。"""
    changes = []
    for r in records:
        prev = conn.execute(
            "SELECT status, redeem, limit_amount, direct_limit_amount FROM snapshots "
            "WHERE code = ? ORDER BY date DESC LIMIT 1",
            (r["code"],),
        ).fetchone()

        # 当日快照只保留最新状态；变更对比使用最近一次扫描状态，保留日内变化。
        conn.execute(
            "DELETE FROM snapshots WHERE code = ? AND date = ?", (r["code"], today)
        )
        conn.execute(
            "INSERT INTO snapshots "
            "(code, date, status, redeem, limit_amount, direct_limit_amount) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (r["code"], today, r["status"], r["redeem"], r["limit_amount"],
             r.get("direct_limit_amount")),
        )

        if prev:
            old_status, old_redeem, old_limit, old_direct_limit = prev
            for field, old, new in (
                ("status", old_status, r["status"]),
                ("redeem", old_redeem, r["redeem"]),
                ("limit_amount", old_limit, r["limit_amount"]),
                ("direct_limit_amount", old_direct_limit,
                 r.get("direct_limit_amount")),
            ):
                if field in {'limit_amount', 'direct_limit_amount'} and (
                        old is None or new is None):
                    continue
                if old != new:
                    old_text = str(old)
                    new_text = str(new)
                    exists = conn.execute(
                        "SELECT 1 FROM changes WHERE code = ? AND date = ? "
                        "AND field = ? AND old_val = ? AND new_val = ? LIMIT 1",
                        (r["code"], today, field, old_text, new_text),
                    ).fetchone()
                    if not exists:
                        conn.execute(
                            "INSERT INTO changes (code, date, field, old_val, new_val) "
                            "VALUES (?, ?, ?, ?, ?)",
                            (r["code"], today, field, old_text, new_text),
                        )
                        changes.append(
                            {"code": r["code"], "date": today, "field": field,
                             "old_val": old_text, "new_val": new_text}
                        )

        conn.execute(
            "INSERT INTO funds (code, name, index_key, status, redeem, limit_amount, "
            "min_buy, updated_at, tracking_error, fee, return_1m, return_6m, return_1y, "
            "return_3y, return_since, inception_date, fund_size, fund_size_date, "
            "management_fee_rate, custody_fee_rate, sales_service_fee_rate, "
            "operation_fee_rate) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(code) DO UPDATE SET name=excluded.name, "
            "index_key=excluded.index_key, status=excluded.status, "
            "redeem=excluded.redeem, limit_amount=excluded.limit_amount, "
            "min_buy=excluded.min_buy, updated_at=excluded.updated_at, "
            "tracking_error=excluded.tracking_error, fee=excluded.fee, "
            "return_1m=excluded.return_1m, return_6m=excluded.return_6m, "
            "return_1y=excluded.return_1y, return_3y=excluded.return_3y, "
            "return_since=excluded.return_since, "
            "inception_date=excluded.inception_date, fund_size=excluded.fund_size, "
            "fund_size_date=excluded.fund_size_date, "
            "management_fee_rate=excluded.management_fee_rate, "
            "custody_fee_rate=excluded.custody_fee_rate, "
            "sales_service_fee_rate=excluded.sales_service_fee_rate, "
            "operation_fee_rate=excluded.operation_fee_rate",
            (r["code"], r["name"], r["index_key"], r["status"], r["redeem"],
             r["limit_amount"], r["min_buy"], today, r.get("tracking_error"),
             r.get("fee"), r.get("return_1m"), r.get("return_6m"),
             r.get("return_1y"), r.get("return_3y"), r.get("return_since"),
             r.get("inception_date"), r.get("fund_size"), r.get("fund_size_date"),
             r.get("management_fee_rate"), r.get("custody_fee_rate"),
             r.get("sales_service_fee_rate"), r.get("operation_fee_rate")),
        )
        conn.execute('UPDATE funds SET track_target = COALESCE(?, track_target) WHERE code = ?',
                     (r.get('track_target'), r['code']))
    conn.commit()
    return changes


def export_json(conn: sqlite3.Connection, records: list[dict], today: str, out_path: Path,
                direct_as_of: Optional[str] = None) -> None:
    """导出 data.json：最新状态 + 每只基金全量历史 + 近 7 天变更。

    只导出 INDEX_RULES 基金（美国页口径）；world 基金仅入库不导出，
    避免污染 /qdii 的全部基金列表、统计与 DCA 回测。
    """
    # INDEX_RULES 命中的纳指/标普基金 + 后台新增的美国基金（index_key=manual）
    us_records = [r for r in records
                  if r["index_key"] in INDEX_RULES or r["index_key"] == "manual"]
    funds_out = []
    for r in us_records:
        history = conn.execute(
            "SELECT date, status, redeem, limit_amount, direct_limit_amount "
            "FROM snapshots "
            "WHERE code = ? ORDER BY date ASC",
            (r["code"],),
        ).fetchall()
        funds_out.append(
            {
                **r,
                "history": [
                    {"date": d, "status": s, "redeem": rd, "limit_amount": la,
                     "direct_limit_amount": dla}
                    for d, s, rd, la, dla in history
                ],
            }
        )

    name_map = {r["code"]: r["name"] for r in us_records}
    # 世界页基金的变更同样进入「最近变更」；region 供前端展示市场小标签。
    # 主动权益母池（world key）依旧不进：主页用户对其无上下文。
    region_map = {r["code"]: "美国" for r in us_records}
    region_map.update({code: fund["country"] for code, fund in WORLD_PAGE_BY_CODE.items()
                       if fund["country"] != "美国"})
    for code, fund in WORLD_PAGE_BY_CODE.items():
        name_map.setdefault(code, fund["name"])
    recent = conn.execute(
        "SELECT date, code, field, old_val, new_val FROM changes "
        "ORDER BY date DESC, id DESC"
    ).fetchall()
    recent_out = [
        {"date": d, "code": c, "name": name_map.get(c, c), "field": f,
         "old_val": ov, "new_val": nv,
         **({"region": region_map[c]} if c in region_map else {})}
        for d, c, f, ov, nv in recent
        if c in name_map
    ][:200]  # 前端只展示最近一批，限制体积

    payload = {
        "updated_at": today,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "rules": {k: v[0] for k, v in INDEX_RULES.items()},
        # 直销限额来源：安鑫乐跨境额度日报（基金公司公告口径，每交易日更新）
        "direct_limits": {
            "source": ', '.join(sorted({r['direct_source'] for r in us_records if r.get('direct_source')})) or None,
            "as_of": direct_as_of,
        },
        "funds": funds_out,
        "recent_changes": recent_out,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    write_json(out_path, payload)


def export_world_json(conn: sqlite3.Connection, records: list[dict], today: str,
                      out_path: Path) -> None:
    """导出扁平化的主动权益 QDII 母池，合并地区、主题与监控历史。"""
    metadata_payload = load_json(ACTIVE_QDII_METADATA_PATH, {"funds": {}})
    metadata = metadata_payload.get("funds", {})
    world_records = [r for r in records if r["index_key"] == WORLD_INDEX_KEY]
    funds_out = []
    for record in world_records:
        history = conn.execute(
            "SELECT date, status, redeem, limit_amount, direct_limit_amount "
            "FROM snapshots "
            "WHERE code = ? ORDER BY date ASC",
            (record["code"],),
        ).fetchall()
        fund_metadata = metadata.get(record["code"], {})
        funds_out.append({
            **record,
            "kind": "主动",
            "regions": fund_metadata.get("regions", []),
            "themes": fund_metadata.get("themes", ["全球多元"]),
            "top_industries": fund_metadata.get("top_industries", []),
            "top_holdings": fund_metadata.get("top_holdings", []),
            "report_title": fund_metadata.get("report_title"),
            "report_date": fund_metadata.get("report_date"),
            "source_url": fund_metadata.get("source_url"),
            "history": [
                {"date": d, "status": s, "redeem": rd, "limit_amount": la,
                 "direct_limit_amount": dla}
                for d, s, rd, la, dla in history
            ],
        })
    funds_out.sort(key=lambda fund: (fund.get("fund_size") is None,
                                     -(fund.get("fund_size") or 0), fund["code"]))
    payload = {
        "updated_at": today,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "pool_as_of": ACTIVE_QDII_POOL.get("as_of"),
        "methodology": ACTIVE_QDII_POOL.get("methodology"),
        "expected_count": ACTIVE_QDII_POOL.get("count", len(ACTIVE_QDII_FUNDS)),
        "count": len(funds_out),
        "funds": funds_out,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    write_json(out_path, payload)


def export_worldpage_json(conn: sqlite3.Connection, records: list[dict], today: str,
                          out_path: Path) -> None:
    """导出世界页（/qdii/world）监控基金：每日状态/限额 + 详情字段 + 快照历史。

    按 world_watchlist.json 清单输出；清单中已被 INDEX_RULES 命中的基金
    从当天 records 取数（其变更同样进入 data.json 的 recent_changes）。
    详情字段（跟踪误差/收益/规模/费率）随每日 enrich 一并导出，前端据此
    覆盖静态快照，避免收益率长期不更新。
    当天接口缺行的基金回退 funds 表最新快照，保证清单完整；两者皆无则跳过，
    前端对缺失基金回退静态快照（worldFunds.js）。
    """
    # 随导出透传的详情字段（enrich_fund_details 的产出，前端按白名单覆盖静态值）
    detail_fields = (
        "track_target", "tracking_error", "return_1m", "return_6m", "return_1y", "return_3y",
        "return_since", "inception_date", "fund_size", "fund_size_date",
        "management_fee_rate", "custody_fee_rate",
        "sales_service_fee_rate", "operation_fee_rate",
    )
    detail_cols = ", ".join(detail_fields)
    records_by_code = {r["code"]: r for r in records}
    observations = read_observations(conn)
    funds_out = []
    # 静态世界页清单 + 后台新增的其他/跨市场基金（index_key=worldpage）
    specs = [{"code": f["code"], "name": f["name"], "country": f["country"]}
             for f in WORLD_PAGE_FUNDS]
    static_codes = {f["code"] for f in WORLD_PAGE_FUNDS}
    for r in records:
        if r.get("index_key") == WORLD_PAGE_INDEX_KEY and r["code"] not in static_codes:
            specs.append({"code": r["code"], "name": r["name"],
                          "country": r.get("region") or "其他市场"})
    for fund in specs:
        code = fund["code"]
        record = records_by_code.get(code)
        if record is not None:
            status = record["status"]
            redeem = record["redeem"]
            limit_amount = record["limit_amount"]
            direct_limit_amount = record.get("direct_limit_amount")
            kind = record.get("kind")
            details = {key: record.get(key) for key in detail_fields}
        else:
            row = conn.execute(
                f"SELECT status, redeem, limit_amount, {detail_cols} "
                "FROM funds WHERE code = ?",
                (code,),
            ).fetchone()
            if row is None:
                log.warning("世界页清单基金 %s 当日无数据且无历史，跳过导出", code)
                continue
            status, redeem, limit_amount = row[:3]
            direct_limit_amount = None
            kind = None
            details = dict(zip(detail_fields, row[3:]))
        history = conn.execute(
            "SELECT date, status, redeem, limit_amount, direct_limit_amount "
            "FROM snapshots "
            "WHERE code = ? ORDER BY date ASC",
            (code,),
        ).fetchall()
        output = {
            "code": code,
            "name": fund["name"],
            "kind": kind,
            "country": fund["country"],
            "status": status,
            "redeem": redeem,
            "limit_amount": limit_amount,
            "direct_limit_amount": direct_limit_amount,
            **observations.get(code, {}),
            **details,
            "history": [
                {"date": d, "status": s, "redeem": rd, "limit_amount": la,
                 "direct_limit_amount": dla}
                for d, s, rd, la, dla in history
            ],
        }
        output.update(FUND_OVERRIDES.get(code, {}))
        funds_out.append(output)

    payload = {
        "updated_at": today,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "count": len(funds_out),
        "funds": funds_out,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    write_json(out_path, payload)


def main() -> int:
    parser = argparse.ArgumentParser(description="QDII 基金限额每日扫描")
    parser.add_argument(
        "--out",
        type=Path,
        default=DATA_JSON,
        help="data.json 输出路径（默认: %(default)s）",
    )
    parser.add_argument(
        "--world-out",
        type=Path,
        default=WORLD_DATA_JSON,
        help="world-data.json 输出路径（默认: %(default)s）",
    )
    parser.add_argument(
        "--world-page-out",
        type=Path,
        default=WORLD_PAGE_DATA_JSON,
        help="worldpage-data.json 输出路径（默认: %(default)s）",
    )
    parser.add_argument("--db", type=Path, default=DB_PATH, help="扫描数据库路径")
    args = parser.parse_args()

    today = date.today().isoformat()
    log.info("开始扫描 %s", today)
    try:
        df = fetch_purchase()
    except Exception as e:  # noqa: BLE001
        log.error("拉取数据失败，本次不更新: %s", e)
        return 1

    # 第一次进锁：初始化统一名册并读取当前 active 主数据（不做网络请求，快速完成）
    with publication_lock(args.db):
        pre_conn = sqlite3.connect(args.db)
        try:
            init_db(pre_conn)
            init_fund_registry(pre_conn)
            registry_rows = read_registry(pre_conn, active_only=True)
        finally:
            pre_conn.close()

    records = filter_funds(df)
    augment_records_with_registry(df, records, registry_rows)
    log.info("纳入扫描基金 %d 只", len(records))
    for index_key, (label, _) in INDEX_RULES.items():
        n = sum(1 for r in records if r["index_key"] == index_key)
        log.info("  %s: %d 只", label, n)
    log.info("  美国新增(manual): %d 只",
             sum(1 for r in records if r["index_key"] == "manual"))
    log.info("  其他市场母池: %d 只",
             sum(1 for r in records if r["index_key"] == WORLD_INDEX_KEY))
    log.info("  世界页清单: %d 只",
             sum(1 for r in records if r["index_key"] == WORLD_PAGE_INDEX_KEY))

    # 详情网络请求在锁外执行，避免长时间持锁阻塞其他发布
    enrich_fund_details(records)

    with publication_lock(args.db):
        conn = sqlite3.connect(args.db)
        try:
            direct_as_of = merge_direct_limits(records, conn)
            apply_fund_overrides(records)
            raw_records = copy.deepcopy(records)
            # 名册同步在 BEGIN IMMEDIATE 内：抓取原值入 auto_values，锁定字段保留手工值
            conn.execute("BEGIN IMMEDIATE")
            try:
                sync_registry_scan(conn, records, raw_records, today)
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            # 后台已软删除的基金从当日结果剔除，不进快照与前台导出
            active_codes = {row["code"] for row in read_registry(conn, active_only=True)}
            records = [r for r in records if r["code"] in active_codes]
            changes = save_snapshot(conn, records, today)
            export_json(conn, records, today, args.out, direct_as_of=direct_as_of)
            export_world_json(conn, records, today, args.world_out)
            export_worldpage_json(conn, records, today, args.world_page_out)
        finally:
            conn.close()

    log.info("完成：快照 %d 只，本次变更 %d 条，已导出 %s / %s / %s",
             len(records), len(changes), args.out, args.world_out, args.world_page_out)
    for c in changes:
        log.info("  变更 %s: %s %s -> %s", c["code"], c["field"], c["old_val"], c["new_val"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
