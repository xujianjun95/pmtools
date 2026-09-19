# -*- coding: utf-8 -*-
"""核对监控清单的基金代码与名称是否与天天基金官方数据一致。

数据源：天天基金全量基金代码表 fund.eastmoney.com/js/fundcode_search.js
核对对象：data.json（美国页）与 world-data.json（其他市场）中的
代表代码及全部份额代码（share_codes）。

用法：
    python3 verify_fund_names.py [--data PATH] [--world PATH]

退出码：0 = 全部一致；1 = 存在代码缺失或名称不一致。
"""
import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

FUNDCODE_URL = "https://fund.eastmoney.com/js/fundcode_search.js"
BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DATA = BASE_DIR.parent / "public" / "qdii" / "data.json"
DEFAULT_WORLD = BASE_DIR.parent / "public" / "qdii" / "world-data.json"


def normalize(name: str) -> str:
    """名称规范化：去空白、全角括号/问号转半角、统一大小写。"""
    name = name.strip()
    table = str.maketrans({"（": "(", "）": ")", "　": "", " ": ""})
    name = name.translate(table)
    return re.sub(r"\s+", "", name).lower()


def fetch_official_list() -> dict[str, dict]:
    """下载并解析天天基金全量代码表，返回 code -> {name, type}。"""
    req = urllib.request.Request(
        FUNDCODE_URL,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://fund.eastmoney.com/",
        },
    )
    raw = urllib.request.urlopen(req, timeout=30).read().decode("utf-8-sig")
    match = re.search(r"\[\[.*\]\]", raw, re.S)
    if not match:
        raise RuntimeError("fundcode_search.js 格式异常，未找到数据数组")
    rows = json.loads(match.group(0))
    # 行结构：[代码, 拼音缩写, 基金简称, 基金类型, 拼音全拼]
    return {row[0]: {"name": row[2], "type": row[3]} for row in rows if len(row) >= 3}


def load_funds(path: Path) -> list[dict]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"[跳过] 无法读取 {path}: {exc}")
        return []
    return payload.get("funds", [])


def verify(path: Path, official: dict[str, dict]) -> tuple[int, int]:
    """核对一个数据文件，打印报告。返回 (核对基金数, 问题数)。"""
    funds = load_funds(path)
    if not funds:
        return 0, 0

    print(f"\n{'=' * 72}\n文件：{path}  共 {len(funds)} 只基金\n{'=' * 72}")
    checked, issues = 0, 0
    for fund in funds:
        rep_code = str(fund.get("code", "")).zfill(6)
        rep_name = str(fund.get("name", ""))
        share_codes = [str(c).zfill(6) for c in fund.get("share_codes", []) or []]
        codes = list(dict.fromkeys([rep_code, *share_codes]))

        for code in codes:
            checked += 1
            entry = official.get(code)
            if entry is None:
                issues += 1
                print(f"  [缺失] {code}  天天基金无此代码  （监控名：{rep_name}）")
                continue
            off_name = entry["name"]
            if normalize(off_name) != normalize(str(fund.get("name", ""))) and code == rep_code:
                issues += 1
                print(f"  [名称不一致] {code}")
                print(f"      监控清单：{rep_name}")
                print(f"      天天基金：{off_name}（{entry['type']}）")
    print(f"  小计：核对 {checked} 个代码，发现 {issues} 个问题")
    return checked, issues


def main() -> int:
    parser = argparse.ArgumentParser(description="核对基金代码/名称与天天基金官方数据")
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--world", type=Path, default=DEFAULT_WORLD)
    args = parser.parse_args()

    print("下载天天基金全量基金代码表…")
    official = fetch_official_list()
    print(f"官方数据 {len(official)} 只基金")

    total_checked, total_issues = 0, 0
    for path in (args.data, args.world):
        checked, issues = verify(path, official)
        total_checked += checked
        total_issues += issues

    print(f"\n{'=' * 72}")
    print(f"总计：核对 {total_checked} 个代码，发现 {total_issues} 个问题")
    if total_issues == 0:
        print("结论：全部代码存在，名称与天天基金一致。")
    else:
        print("结论：存在待处理问题，见上方明细。")
    print(f"{'=' * 72}")
    return 0 if total_issues == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
