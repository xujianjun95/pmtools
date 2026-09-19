# -*- coding: utf-8 -*-
from __future__ import annotations
"""从基金中期/年度报告刷新 104 只主动权益 QDII 的地区与投资方向。"""
import argparse
import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from threading import Lock

import requests

try:
    import fitz
except ImportError as exc:  # pragma: no cover - 运行环境依赖提示
    raise SystemExit("缺少 PyMuPDF，请先执行: pip install pymupdf") from exc


BASE_DIR = Path(__file__).resolve().parent
POOL_PATH = BASE_DIR / "active_qdii_pool.json"
OUTPUT_PATH = BASE_DIR / "active_qdii_metadata.json"
ANNOUNCEMENT_URL = "https://api.fund.eastmoney.com/f10/JJGG"
PDF_URL = "https://pdf.dfcfw.com/pdf/H2_{report_id}_1.pdf"
REPORT_PATTERN = re.compile(r"(?:中期|年度)报告")
NUMBER_PATTERN = re.compile(r"^-?[\d,]+(?:\.\d+)?$")
INVALID_HOLDING_NAME_PATTERN = re.compile(
    r"(?:债券投资收益|资产支持证券投资收益|贵金属投资收益|利息收入|投资收益|指数基金|^[-—]+$)"
)

REGION_FLAGS = {
    "中国大陆": "🇨🇳", "中国": "🇨🇳", "中国香港": "🇭🇰", "香港": "🇭🇰",
    "中国台湾": "🇹🇼", "台湾": "🇹🇼", "美国": "🇺🇸", "日本": "🇯🇵",
    "韩国": "🇰🇷", "印度": "🇮🇳", "越南": "🇻🇳", "新加坡": "🇸🇬",
    "英国": "🇬🇧", "法国": "🇫🇷", "德国": "🇩🇪", "荷兰": "🇳🇱",
    "瑞士": "🇨🇭", "意大利": "🇮🇹", "西班牙": "🇪🇸", "奥地利": "🇦🇹",
    "瑞典": "🇸🇪", "比利时": "🇧🇪", "挪威": "🇳🇴", "爱尔兰": "🇮🇪",
    "加拿大": "🇨🇦", "澳大利亚": "🇦🇺", "巴西": "🇧🇷", "墨西哥": "🇲🇽",
    "丹麦": "🇩🇰", "芬兰": "🇫🇮", "葡萄牙": "🇵🇹", "希腊": "🇬🇷",
    "印度尼西亚": "🇮🇩", "马来西亚": "🇲🇾", "泰国": "🇹🇭", "菲律宾": "🇵🇭",
}

THEME_RULES = (
    ("半导体", ("半导体", "芯片", "集成电路")),
    ("AI", ("人工智能", "AI", "智能")),
    ("互联网", ("互联网", "移动互联", "数字经济")),
    ("医疗健康", ("医疗", "医药", "生物", "健康")),
    ("消费", ("消费", "消费者")),
    ("新能源", ("新能源", "清洁能源", "低碳", "绿色")),
    ("能源资源", ("能源", "油气", "矿业", "资源", "黄金", "煤")),
    ("金融", ("金融", "银行", "保险")),
    ("高端制造", ("制造", "工业", "航空", "国防")),
    ("科技", ("科技", "信息技术", "软件", "电子")),
)

INDUSTRY_LABELS = {
    "信息技术", "科技", "通讯业务", "通信服务", "电信服务", "金融", "工业",
    "医疗保健", "医药卫生", "能源", "房地产", "公用事业", "原材料", "基础材料",
    "日常消费品", "非日常生活消费品", "消费者常用品", "消费者非必需品",
    "可选消费", "主要消费", "其他-GICS未分类",
}

FALLBACK_REGIONS = (
    ("港股", "中国香港"), ("香港", "中国香港"), ("大中华", "中国大陆"), ("中国", "中国大陆"),
    ("美国", "美国"), ("日本", "日本"), ("印度", "印度"), ("越南", "越南"),
    ("欧洲", "欧洲"), ("亚洲", "亚洲"), ("新兴市场", "新兴市场"),
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("active-qdii-metadata")
FITZ_TABLE_LOCK = Lock()


def clean_lines(block: str) -> list[str]:
    return [re.sub(r"\s+", " ", line).strip() for line in block.splitlines() if line.strip()]


def number_after(lines: list[str], start: int) -> float | None:
    values = []
    for line in lines[start + 1:start + 8]:
        value = line.replace(" ", "")
        if NUMBER_PATTERN.match(value):
            try:
                values.append(float(value.replace(",", "")))
            except ValueError:
                continue
        if len(values) == 2:
            return values[1]
    return None


def table_block(text: str, heading: str, next_heading: str) -> str:
    start = text.rfind(heading)
    if start < 0:
        return ""
    end = text.find(next_heading, start + len(heading))
    return text[start:end if end >= 0 else None]


def parse_regions(text: str) -> list[dict]:
    block = table_block(text, "期末在各个国家（地区）证券市场的权益投资分布", "期末按行业分类")
    lines = clean_lines(block)
    found = []
    aliases = {**REGION_FLAGS, "中国香港特别行政区": "🇭🇰", "中国台湾地区": "🇹🇼"}
    for index, line in enumerate(lines):
        if line not in aliases:
            continue
        weight = number_after(lines, index)
        if weight is not None and 0 < weight <= 100:
            label = {"中国": "中国大陆", "香港": "中国香港", "台湾": "中国台湾"}.get(line, line)
            found.append({"label": label, "flag": aliases[line], "weight": weight})
    found.sort(key=lambda item: item["weight"], reverse=True)
    material = [item for item in found if item["weight"] >= 5]
    return (material or found[:3])[:6]


def parse_industries(text: str) -> list[dict]:
    block = table_block(text, "期末按行业分类的权益投资组合", "期末按公允价值")
    lines = clean_lines(block)
    found = []
    for index, line in enumerate(lines):
        if line not in INDUSTRY_LABELS:
            continue
        weight = number_after(lines, index)
        if weight is not None and 0 < weight <= 100:
            found.append({"label": line, "weight": weight})
    deduped = {item["label"]: item for item in found}
    return sorted(deduped.values(), key=lambda item: item["weight"], reverse=True)[:5]


def compact_cell(value: object) -> str:
    return re.sub(r"\s+", "", str(value or ""))


def display_cell(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def display_company_name(value: object) -> str:
    text = display_cell(value)
    if re.search(r"[\u4e00-\u9fff]", text) and not re.search(r"[A-Za-z]{2,}", text):
        return compact_cell(value)
    if len(str(value or "").splitlines()) >= 3:
        return compact_cell(value)
    return text


def parse_holdings_rows(rows: list[list[object]], continuation: bool = False) -> list[dict]:
    if len(rows) < 2:
        return []
    header_row_count = 0 if continuation else next(
        (index for index, row in enumerate(rows[1:], start=1) if row and compact_cell(row[0]).isdigit()),
        min(4, len(rows)),
    )
    column_count = max(len(row) for row in rows[:header_row_count or 1])
    headers = [
        compact_cell("".join(str(rows[row_index][column_index] or "") for row_index in range(header_row_count) if column_index < len(rows[row_index])))
        for column_index in range(column_count)
    ]
    if continuation:
        rank_index = 0
        weight_index = len(rows[0]) - 1
        chinese_name_index = 2 if len(rows[0]) > 2 else None
        english_name_index = 1 if len(rows[0]) > 1 else None
        generic_name_index = None
    else:
        rank_index = next((index for index, value in enumerate(headers) if value == "序号"), None)
        weight_index = next((index for index, value in enumerate(headers) if "占基金" in value and "净值比例" in value), None)
        chinese_name_index = next((index for index, value in enumerate(headers) if "公司名称" in value and "中文" in value), None)
        english_name_index = next((index for index, value in enumerate(headers) if "公司名称" in value and "英文" in value), None)
        generic_name_index = next((index for index, value in enumerate(headers) if value in {"公司名称", "股票名称", "证券名称"}), None)
    if rank_index is None or weight_index is None or all(index is None for index in (chinese_name_index, english_name_index, generic_name_index)):
        return []

    holdings_by_rank = {}
    for row in rows[header_row_count:]:
        if len(row) <= max(rank_index, weight_index):
            continue
        rank = compact_cell(row[rank_index])
        if not rank.isdigit() or not 1 <= int(rank) <= 3:
            continue
        rank_value = int(rank)
        name = next((display_company_name(row[index]) for index in (chinese_name_index, generic_name_index, english_name_index) if index is not None and display_company_name(row[index])), "")
        weight_value = next(
            (
                compact_cell(row[index])
                for index in reversed(range(max(0, weight_index - 2), min(len(row), weight_index + 3)))
                if NUMBER_PATTERN.match(compact_cell(row[index]).replace("%", "").replace("％", "").replace(",", ""))
            ),
            "",
        )
        try:
            weight = float(weight_value.replace("%", "").replace("％", "").replace(",", ""))
        except ValueError:
            continue
        if name and 0 < weight <= 35:
            if rank_value in holdings_by_rank:
                holdings_by_rank[rank_value]["weight"] = round(holdings_by_rank[rank_value]["weight"] + weight, 2)
            else:
                holdings_by_rank[rank_value] = {"name": name, "weight": weight}
    return [holdings_by_rank[rank] for rank in sorted(holdings_by_rank)]


def parse_holdings_text(page_text: str) -> list[dict]:
    lines = clean_lines(page_text)
    rank_lines = []
    for index, line in enumerate(lines):
        match = re.match(r"^(\d{1,2})(?:\s+|$)", line)
        if match and 1 <= int(match.group(1)) <= 4:
            rank_lines.append((int(match.group(1)), index))

    holdings = []
    market_code = re.compile(r"\b[A-Z0-9][A-Z0-9.:-]*\s+[A-Z]{2}\b")
    for rank in range(1, 4):
        starts = [index for value, index in rank_lines if value == rank]
        if not starts:
            return []
        start = starts[0]
        ends = [index for value, index in rank_lines if value == rank + 1 and index > start]
        entry_lines = lines[start:(ends[0] if ends else start + 20)]
        entry_text = re.sub(rf"^{rank}\s*", "", " ".join(entry_lines))
        code_match = market_code.search(entry_text)
        name_block = entry_text[:code_match.start()] if code_match else entry_text
        chinese_start = next((index for index, char in enumerate(name_block) if "\u4e00" <= char <= "\u9fff"), -1)
        chinese_name = compact_cell(name_block[chinese_start:]) if chinese_start >= 0 else ""
        english_name = display_cell(name_block[:chinese_start])
        english_suffix = re.search(r"\b(?:Inc|Corp|Ltd|PLC|NV|SA|SE|LLC)\b", english_name)
        if english_suffix:
            english_name = english_name[:english_suffix.end()]
        name = chinese_name if chinese_name not in {"公司", "有限公司", "股份有限公司", "株式会社"} else english_name
        if not name:
            name = display_cell(name_block)
        weights = []
        for value in entry_lines:
            if re.match(r"^\d{1,2}(?:\s+|$)", value):
                continue
            trailing_number = re.search(r"(-?[\d,]+(?:\.\d+)?)\s*[%％]?\s*$", value)
            if trailing_number:
                normalized = trailing_number.group(1).replace(",", "")
                if NUMBER_PATTERN.match(normalized) and 0 < float(normalized) <= 35:
                    weights.append(float(normalized))
        if not name or not weights or re.search(r"\d{2,}", name):
            return []
        weight = round(sum(weights), 2)
        if weight > 35:
            return []
        holdings.append({"name": name, "weight": weight})
    return holdings


def sanitize_top_holdings(holdings: list[dict]) -> list[dict]:
    valid = [
        holding
        for holding in holdings
        if holding.get("name")
        and not INVALID_HOLDING_NAME_PATTERN.search(str(holding["name"]).strip())
        and 0 < float(holding.get("weight") or 0) <= 35
    ]
    return sorted(valid, key=lambda holding: holding["weight"], reverse=True)[:3]


def parse_report_top_holdings(text: str) -> list[dict]:
    heading = re.compile(r"7\.4\s*(?:报告)?期末按公允价值占基金资产净值比例大小排序的(?:(?:所有)?权益|前十名股票)投资明细")
    matches = list(heading.finditer(text))
    if not matches:
        return []
    start = matches[-1].start()
    next_section = re.search(r"\n7\.5\s", text[start:])
    end = start + next_section.start() if next_section else len(text)
    return parse_holdings_text(text[start:end])


def parse_top_holdings(document: fitz.Document, page_texts: list[str] | None = None) -> list[dict]:
    best_holdings = []
    collected_by_rank = {}
    inside_holdings_section = False
    for index, page in enumerate(document):
        page_text = page_texts[index] if page_texts is not None else page.get_text("text")
        compact_text = compact_cell(page_text)
        starts_section = "公允价值占基金资产净值比例" in compact_text and "投资明细" in compact_text
        if starts_section:
            inside_holdings_section = True
            collected_by_rank = {}
            best_holdings = []
        elif inside_holdings_section and re.search(r"(?:^|\n)7\.5\s", page_text):
            inside_holdings_section = False
        if not inside_holdings_section:
            continue
        with FITZ_TABLE_LOCK:
            table_finder = page.find_tables()
            extracted_tables = [table.extract() for table in table_finder.tables]
        for rows in extracted_tables:
            holdings = parse_holdings_rows(rows, continuation=not starts_section)
            for holding in holdings:
                rank = len(collected_by_rank) + 1 if not starts_section else None
                if rank is None:
                    row_rank = next((int(compact_cell(row[0])) for row in rows if row and compact_cell(row[0]).isdigit() and display_company_name(row[2] if len(row) > 2 else row[1]) == holding["name"]), None)
                    rank = row_rank
                if rank and 1 <= rank <= 3:
                    if rank in collected_by_rank:
                        collected_by_rank[rank]["weight"] = round(collected_by_rank[rank]["weight"] + holding["weight"], 2)
                    else:
                        collected_by_rank[rank] = holding
            if len(collected_by_rank) >= 3:
                return sanitize_top_holdings([collected_by_rank[rank] for rank in sorted(collected_by_rank)[:3]])
            if len(holdings) > len(best_holdings):
                best_holdings = holdings
        holdings = parse_holdings_text(page_text)
        if len(holdings) >= 3:
            return sanitize_top_holdings(holdings)
    report_holdings = parse_report_top_holdings("\n".join(page_texts)) if page_texts is not None else []
    return sanitize_top_holdings(report_holdings or best_holdings)


def derive_themes(name: str, industries: list[dict]) -> list[str]:
    haystack = " ".join([name, *(item["label"] for item in industries[:4])])
    themes = [label for label, keywords in THEME_RULES if any(word in haystack for word in keywords)]
    if not themes:
        themes = [item["label"] for item in industries[:2]]
    return list(dict.fromkeys(themes))[:3] or ["全球多元"]


def fallback_regions(name: str) -> list[dict]:
    for keyword, label in FALLBACK_REGIONS:
        if keyword in name:
            flag = REGION_FLAGS.get(label, "🌏" if label in {"亚洲", "新兴市场"} else "🇪🇺" if label == "欧洲" else "🌐")
            return [{"label": label, "flag": flag, "weight": None}]
    return [{"label": "全球", "flag": "🌐", "weight": None}]


def latest_report(session: requests.Session, code: str) -> dict:
    response = session.get(
        ANNOUNCEMENT_URL,
        params={"fundcode": code, "pageIndex": 1, "pageSize": 1000, "type": 3},
        headers={"Referer": f"https://fundf10.eastmoney.com/jjgg_{code}_3.html"},
        timeout=20,
    )
    response.raise_for_status()
    reports = [item for item in response.json().get("Data", []) if REPORT_PATTERN.search(str(item.get("TITLE", "")))]
    if not reports:
        raise RuntimeError("未找到中期或年度报告")
    reports.sort(key=lambda item: str(item.get("PUBLISHDATE", "")), reverse=True)
    return reports[0]


def refresh_one(fund: dict) -> tuple[str, dict]:
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0"})
    report = latest_report(session, fund["code"])
    report_id = report.get("ID") or report.get("INFOCODE")
    if not report_id:
        raise RuntimeError("报告 ID 为空")
    pdf_url = PDF_URL.format(report_id=report_id)
    response = session.get(pdf_url, timeout=45)
    response.raise_for_status()
    document = fitz.open(stream=response.content, filetype="pdf")
    page_texts = [page.get_text("text") for page in document]
    text = "\n".join(page_texts)
    regions = parse_regions(text)
    if not regions or sum((region.get("weight") or 0) for region in regions) < 20:
        regions = fallback_regions(fund["name"])
    industries = parse_industries(text)
    top_holdings = parse_top_holdings(document, page_texts)
    return fund["code"], {
        "regions": regions,
        "themes": derive_themes(fund["name"], industries),
        "top_industries": industries,
        "top_holdings": top_holdings,
        "report_title": report.get("TITLE"),
        "report_date": str(report.get("PUBLISHDATE", ""))[:10],
        "source_url": pdf_url,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="刷新主动权益 QDII 地区与主题元数据")
    parser.add_argument("--pool", type=Path, default=POOL_PATH)
    parser.add_argument("--out", type=Path, default=OUTPUT_PATH)
    parser.add_argument("--workers", type=int, default=6)
    args = parser.parse_args()
    pool = json.loads(args.pool.read_text(encoding="utf-8"))
    previous = {}
    if args.out.exists():
        previous = json.loads(args.out.read_text(encoding="utf-8")).get("funds", {})
    output = dict(previous)
    failed = []
    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 10))) as executor:
        futures = {executor.submit(refresh_one, fund): fund for fund in pool["funds"]}
        for future in as_completed(futures):
            fund = futures[future]
            try:
                code, metadata = future.result()
                output[code] = metadata
                log.info("已刷新 %s %s", code, fund["name"])
            except Exception as exc:  # noqa: BLE001
                failed.append(code := fund["code"])
                if code not in output:
                    output[code] = {
                        "regions": fallback_regions(fund["name"]),
                        "themes": derive_themes(fund["name"], []),
                        "top_industries": [],
                        "top_holdings": [],
                        "report_title": None,
                        "report_date": None,
                        "source_url": None,
                    }
                log.warning("刷新失败 %s: %s", code, exc)
    payload = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "count": len(output),
        "failed_codes": failed,
        "funds": output,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    temp_path = args.out.with_suffix(".tmp")
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temp_path.replace(args.out)
    log.info("完成：%d 只，失败 %d 只", len(output), len(failed))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
