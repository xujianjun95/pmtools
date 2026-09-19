#!/usr/bin/env python3
"""校验 AI 公众号结果，保存到共享直销表并原子刷新全部已有页面 JSON。

输入包含 as_of、source_url（公众号原文）和 funds（六位代码到元额度）。
未知额度省略，明确暂停为 0；执行方式与路径参数见 docs/qdii-scan-logic.md。
本脚本只导入结果，不调用模型、不发送邮件。
"""
import argparse
import json
import re
import sqlite3
import sys
from pathlib import Path
from urllib.parse import urlparse

from direct_limit_store import (valid_amount, valid_date, save_observations,
                               read_observations, apply_observations, publication_lock, write_json)

BASE = Path(__file__).resolve().parent
SRC = BASE / "ai_direct_limits.json"
TARGET = BASE.parent / "public" / "qdii" / "worldpage-data.json"


def main() -> int:
    parser = argparse.ArgumentParser(description='校验 AI 直销结果，入库并刷新所有页面数据')
    parser.add_argument('--input', type=Path, default=SRC)
    parser.add_argument('--db', type=Path, default=BASE / 'fund.db')
    parser.add_argument('--out', type=Path, default=BASE.parent / 'public/qdii/data.json')
    parser.add_argument('--world-page-out', type=Path, default=TARGET)
    parser.add_argument('--world-out', type=Path, default=BASE.parent / 'public/qdii/world-data.json')
    args = parser.parse_args()
    try:
        data = json.loads(args.input.read_text(encoding='utf-8'))
        funds = data.get('funds')
        url = urlparse(data.get('source_url') or '')
        if not valid_date(data.get('as_of')):
            raise ValueError('as_of 必须为非未来的 YYYY-MM-DD 数据日期')
        if url.scheme != 'https' or url.hostname != 'mp.weixin.qq.com':
            raise ValueError('必须提供公众号原文 source_url')
        if not isinstance(funds, dict) or not funds:
            raise ValueError('解析结果为空或格式错误')
        if any(not re.fullmatch(r'\d{6}', code) or not valid_amount(amount)
               for code, amount in funds.items()):
            raise ValueError('基金代码必须为六位字符串，额度必须为有限非负数字；未知额度请省略')
        payload = {'as_of': data['as_of'], 'source': 'wechat-ai', 'source_url': data['source_url'],
                   'funds': {code: {'direct_limit_amount': amount} for code, amount in funds.items()}}
        with publication_lock(args.db):
            conn = sqlite3.connect(args.db)
            try:
                count = save_observations(conn, payload)
                observations = read_observations(conn)
                for target in dict.fromkeys([args.out, args.world_page_out, args.world_out]):
                    if not target.exists():
                        print(f'数据已入库，等待扫描生成 {target}')
                        continue
                    page = json.loads(target.read_text(encoding='utf-8'))
                    apply_observations(page['funds'], observations)
                    dates = [fund['direct_as_of'] for fund in page['funds'] if fund.get('direct_as_of')]
                    page['direct_limits'] = {
                        'as_of': max(dates) if dates else None,
                        'source': ', '.join(sorted({fund['direct_source'] for fund in page['funds'] if fund.get('direct_source')})) or None,
                    }
                    write_json(target, page)
            finally:
                conn.close()
        print(f'已保存 {count} 条有效直销记录，并刷新已有页面数据（{data["as_of"]}）')
        return 0
    except (OSError, ValueError, TypeError, KeyError, sqlite3.Error) as exc:
        print(f'AI 结果应用失败: {exc}', file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
