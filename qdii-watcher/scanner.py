# -*- coding: utf-8 -*-
"""
QDII 指数基金限额监控 — 每日扫描脚本

从天天基金(经 akshare)拉取全市场基金申购状态，筛选出跟踪纳指100/标普500
的场外基金，写入 SQLite 快照并与历史对比生成变更日志，导出 data.json 供
前端页面使用。cron 每日定时运行，同日重跑幂等。
"""
import argparse
import json
import logging
import re
import sqlite3
import sys
import time
from datetime import date, datetime
from pathlib import Path

import akshare as ak
import pandas as pd
import requests
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "fund.db"
# 默认输出到前端 public/（开发模式 Vite 直接可用）；部署时用 --out 指向 dist 目录
DATA_JSON = BASE_DIR / "frontend" / "public" / "data.json"

# ---------------------------------------------------------------------------
# 筛选规则：index_key -> (展示名, 基金简称包含的任一关键词)
# 新增跟踪指数只需在这里加一行，例如 "spinfo": ("标普信息科技", ["标普信息科技"])
# ---------------------------------------------------------------------------
INDEX_RULES = {
    "nasdaq100": ("纳斯达克100", ["纳斯达克100", "纳指"]),
    "sp500": ("标普500", ["标普500"]),
}

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
    "return_since": "成立来",
}
INCEPTION_DATE_RE = re.compile(
    r'<span[^>]*>成\s*立\s*日</span>：\s*(\d{4}-\d{2}-\d{2})', re.S
)
FUND_SIZE_RE = re.compile(
    r'>规模</a>：\s*([\d.]+)\s*亿元（(\d{4}-\d{2}-\d{2})）', re.S
)
TS_REQUEST_INTERVAL = 0.3  # 抓取间隔，避免请求过快

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()],
)
log = logging.getLogger("scanner")


def fetch_purchase() -> pd.DataFrame:
    """拉取全市场基金申购状态，带重试。"""
    last_err = None
    for i in range(1, RETRY_TIMES + 1):
        try:
            df = ak.fund_purchase_em()
            if df is None or df.empty:
                raise RuntimeError("接口返回空数据")
            return df
        except Exception as e:  # noqa: BLE001
            last_err = e
            log.warning("第 %d/%d 次拉取失败: %s", i, RETRY_TIMES, e)
            if i < RETRY_TIMES:
                time.sleep(RETRY_INTERVAL)
    raise RuntimeError(f"拉取失败，已重试 {RETRY_TIMES} 次: {last_err}")


def filter_funds(df: pd.DataFrame) -> list[dict]:
    """按 INDEX_RULES 筛选目标场外基金，返回标准化记录。

    排除场内品种：申购状态为"场内交易"的，以及名称含"ETF"但不含"联接"
    的纯场内 ETF（如 513100 纳指ETF国泰）。"ETF联接/发起联接"是场外，
    保留。
    """
    records = []
    name_col = df["基金简称"].astype(str)
    for index_key, (_, keywords) in INDEX_RULES.items():
        mask = name_col.apply(lambda n: any(k in n for k in keywords))
        for _, row in df[mask].iterrows():
            name = str(row["基金简称"]).strip()
            status = str(row["申购状态"]).strip()
            if status == "场内交易":
                continue
            if "ETF" in name and "联接" not in name:
                continue
            records.append(
                {
                    "code": str(row["基金代码"]).zfill(6),
                    "name": name,
                    "index_key": index_key,
                    "status": status,
                    "redeem": str(row["赎回状态"]).strip(),
                    "limit_amount": float(row["日累计限定金额"] or 0),
                    "min_buy": float(row["购买起点"] or 0),
                    "fee": float(row["手续费"] or 0),
                }
            )
    # 一只基金可能同时命中多条规则，保留先匹配到的
    seen, unique = set(), []
    for r in records:
        if r["code"] not in seen:
            seen.add(r["code"])
            unique.append(r)
    return unique


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
        "return_1m": None,
        "return_6m": None,
        "return_1y": None,
        "return_since": None,
        "inception_date": None,
        "fund_size": None,
        "fund_size_date": None,
    }


def parse_fund_details_html(html: str) -> dict:
    """从天天基金主页 HTML 解析收益率、成立日和单只基金规模。"""
    details = empty_fund_details()
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
                details[field] = float(raw)
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


def enrich_fund_details(records: list[dict]) -> None:
    """为每只基金补充跟踪误差、收益率、成立日和基金规模（原地更新）。"""
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0"})
    tracking_error_count = 0
    details_count = 0
    for i, r in enumerate(records):
        r["tracking_error"] = fetch_tracking_error(r["code"], session)
        if r["tracking_error"] is not None:
            tracking_error_count += 1
        details = fetch_fund_details(r["code"], session)
        r.update(details)
        if any(value is not None for value in details.values()):
            details_count += 1
        if i < len(records) - 1:
            time.sleep(TS_REQUEST_INTERVAL)
    log.info("跟踪误差获取成功 %d/%d", tracking_error_count, len(records))
    log.info("基金详情获取成功 %d/%d", details_count, len(records))


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS funds (
            code TEXT PRIMARY KEY, name TEXT NOT NULL, index_key TEXT NOT NULL,
            status TEXT, redeem TEXT, limit_amount REAL, min_buy REAL, updated_at TEXT,
            tracking_error REAL, fee REAL
        );
        CREATE TABLE IF NOT EXISTS snapshots (
            code TEXT NOT NULL, date TEXT NOT NULL, status TEXT, redeem TEXT,
            limit_amount REAL, PRIMARY KEY (code, date)
        );
        CREATE TABLE IF NOT EXISTS changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL,
            date TEXT NOT NULL, field TEXT NOT NULL, old_val TEXT, new_val TEXT
        );
        """
    )
    # 存量库迁移：老表缺列时补上
    cols = {row[1] for row in conn.execute("PRAGMA table_info(funds)")}
    detail_columns = {
        "tracking_error": "REAL",
        "fee": "REAL",
        "return_1m": "REAL",
        "return_6m": "REAL",
        "return_1y": "REAL",
        "return_since": "REAL",
        "inception_date": "TEXT",
        "fund_size": "REAL",
        "fund_size_date": "TEXT",
    }
    for col, column_type in detail_columns.items():
        if col not in cols:
            conn.execute(f"ALTER TABLE funds ADD COLUMN {col} {column_type}")
    conn.commit()


def save_snapshot(conn: sqlite3.Connection, records: list[dict], today: str) -> list[dict]:
    """写入当日快照并对比历史生成变更记录。返回本次变更列表。"""
    changes = []
    for r in records:
        prev = conn.execute(
            "SELECT status, redeem, limit_amount FROM snapshots "
            "WHERE code = ? AND date < ? ORDER BY date DESC LIMIT 1",
            (r["code"], today),
        ).fetchone()

        # 先删当日旧快照再插入，保证同日重跑幂等；变更对比只针对历史日期
        conn.execute(
            "DELETE FROM snapshots WHERE code = ? AND date = ?", (r["code"], today)
        )
        conn.execute(
            "INSERT INTO snapshots (code, date, status, redeem, limit_amount) "
            "VALUES (?, ?, ?, ?, ?)",
            (r["code"], today, r["status"], r["redeem"], r["limit_amount"]),
        )

        if prev:
            old_status, old_redeem, old_limit = prev
            # 同日重跑时先清掉当日已生成的变更，避免重复
            conn.execute(
                "DELETE FROM changes WHERE code = ? AND date = ?", (r["code"], today)
            )
            for field, old, new in (
                ("status", old_status, r["status"]),
                ("redeem", old_redeem, r["redeem"]),
                ("limit_amount", old_limit, r["limit_amount"]),
            ):
                if old != new:
                    conn.execute(
                        "INSERT INTO changes (code, date, field, old_val, new_val) "
                        "VALUES (?, ?, ?, ?, ?)",
                        (r["code"], today, field, str(old), str(new)),
                    )
                    changes.append(
                        {"code": r["code"], "date": today, "field": field,
                         "old_val": str(old), "new_val": str(new)}
                    )

        conn.execute(
            "INSERT INTO funds (code, name, index_key, status, redeem, limit_amount, "
            "min_buy, updated_at, tracking_error, fee, return_1m, return_6m, return_1y, "
            "return_since, inception_date, fund_size, fund_size_date) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(code) DO UPDATE SET name=excluded.name, "
            "index_key=excluded.index_key, status=excluded.status, "
            "redeem=excluded.redeem, limit_amount=excluded.limit_amount, "
            "min_buy=excluded.min_buy, updated_at=excluded.updated_at, "
            "tracking_error=excluded.tracking_error, fee=excluded.fee, "
            "return_1m=excluded.return_1m, return_6m=excluded.return_6m, "
            "return_1y=excluded.return_1y, return_since=excluded.return_since, "
            "inception_date=excluded.inception_date, fund_size=excluded.fund_size, "
            "fund_size_date=excluded.fund_size_date",
            (r["code"], r["name"], r["index_key"], r["status"], r["redeem"],
             r["limit_amount"], r["min_buy"], today, r.get("tracking_error"),
             r.get("fee"), r.get("return_1m"), r.get("return_6m"),
             r.get("return_1y"), r.get("return_since"), r.get("inception_date"),
             r.get("fund_size"), r.get("fund_size_date")),
        )
    conn.commit()
    return changes


def export_json(conn: sqlite3.Connection, records: list[dict], today: str, out_path: Path) -> None:
    """导出 data.json：最新状态 + 每只基金全量历史 + 近 7 天变更。"""
    funds_out = []
    for r in records:
        history = conn.execute(
            "SELECT date, status, redeem, limit_amount FROM snapshots "
            "WHERE code = ? ORDER BY date ASC",
            (r["code"],),
        ).fetchall()
        funds_out.append(
            {
                **r,
                "history": [
                    {"date": d, "status": s, "redeem": rd, "limit_amount": la}
                    for d, s, rd, la in history
                ],
            }
        )

    name_map = {r["code"]: r["name"] for r in records}
    recent = conn.execute(
        "SELECT date, code, field, old_val, new_val FROM changes "
        "ORDER BY date DESC, id DESC"
    ).fetchall()
    recent_out = [
        {"date": d, "code": c, "name": name_map.get(c, c), "field": f,
         "old_val": ov, "new_val": nv}
        for d, c, f, ov, nv in recent
    ][:200]  # 前端只展示最近一批，限制体积

    payload = {
        "updated_at": today,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "rules": {k: v[0] for k, v in INDEX_RULES.items()},
        "funds": funds_out,
        "recent_changes": recent_out,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = out_path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    tmp.replace(out_path)  # 原子替换，避免前端读到半截文件


def main() -> int:
    parser = argparse.ArgumentParser(description="QDII 基金限额每日扫描")
    parser.add_argument(
        "--out",
        type=Path,
        default=DATA_JSON,
        help="data.json 输出路径（默认: %(default)s）",
    )
    args = parser.parse_args()

    today = date.today().isoformat()
    log.info("开始扫描 %s", today)
    try:
        df = fetch_purchase()
    except Exception as e:  # noqa: BLE001
        log.error("拉取数据失败，本次不更新: %s", e)
        return 1

    records = filter_funds(df)
    log.info("筛选出目标基金 %d 只", len(records))
    for index_key, (label, _) in INDEX_RULES.items():
        n = sum(1 for r in records if r["index_key"] == index_key)
        log.info("  %s: %d 只", label, n)

    enrich_fund_details(records)

    conn = sqlite3.connect(DB_PATH)
    try:
        init_db(conn)
        changes = save_snapshot(conn, records, today)
        export_json(conn, records, today, args.out)
    finally:
        conn.close()

    log.info("完成：快照 %d 只，本次变更 %d 条，已导出 %s",
             len(records), len(changes), args.out)
    for c in changes:
        log.info("  变更 %s: %s %s -> %s", c["code"], c["field"], c["old_val"], c["new_val"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
