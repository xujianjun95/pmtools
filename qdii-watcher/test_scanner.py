import json
import sqlite3
import tempfile
import unittest
from unittest.mock import patch, Mock
from pathlib import Path

import pandas as pd

from scanner import (
    export_json,
    export_worldpage_json,
    filter_funds,
    fetch_purchase,
    init_db,
    parse_fee_details_html,
    parse_fund_details_html,
    save_snapshot,
)


def purchase_df(rows: list[dict]) -> pd.DataFrame:
    return pd.DataFrame([dict(r) for r in rows])


def purchase_row(code: str, name: str, status: str = "限大额",
                 limit: float = 10000.0) -> dict:
    return {"基金代码": code, "基金简称": name, "申购状态": status,
            "赎回状态": "开放赎回", "日累计限定金额": limit,
            "购买起点": 10.0, "手续费": 0.15}


def world_record(limit_amount: float, **overrides) -> dict:
    rec = {
        "code": "006282",
        "name": "摩根欧洲动力策略股票(QDII)A",
        "index_key": "world",
        "status": "限大额",
        "redeem": "开放赎回",
        "limit_amount": limit_amount,
        "min_buy": 10.0,
    }
    rec.update(overrides)
    return rec


def fund_record(limit_amount: float) -> dict:
    return {
        "code": "018966",
        "name": "汇添富纳斯达克100ETF发起式联接(QDII)人民币A",
        "index_key": "nasdaq100",
        "status": "限大额",
        "redeem": "开放赎回",
        "limit_amount": limit_amount,
        "min_buy": 10.0,
    }


def worldpage_fund_record(limit_amount: float, **overrides) -> dict:
    """world_watchlist.json 真实清单中的基金（012348 天弘恒生科技ETF联接A）。"""
    rec = {
        "code": "012348",
        "name": "天弘恒生科技ETF联接A",
        "index_key": "worldpage",
        "status": "限大额",
        "redeem": "开放赎回",
        "limit_amount": limit_amount,
        "min_buy": 10.0,
    }
    rec.update(overrides)
    return rec


class SaveSnapshotTest(unittest.TestCase):
    def test_preserves_distinct_intraday_changes_and_deduplicates_repeated_scan(self):
        conn = sqlite3.connect(":memory:")
        self.addCleanup(conn.close)
        init_db(conn)

        save_snapshot(conn, [fund_record(10000.0)], "2026-09-02")
        save_snapshot(conn, [fund_record(2000.0)], "2026-09-03")
        save_snapshot(conn, [fund_record(2000.0)], "2026-09-03")
        save_snapshot(conn, [fund_record(10.0)], "2026-09-03")

        changes = conn.execute(
            "SELECT old_val, new_val FROM changes "
            "WHERE code = ? AND date = ? AND field = ? ORDER BY id",
            ("018966", "2026-09-03", "limit_amount"),
        ).fetchall()

        self.assertEqual(changes, [("10000.0", "2000.0"), ("2000.0", "10.0")])


class FundDetailsParserTest(unittest.TestCase):
    def test_parses_tracking_target_from_tiantian_detail(self):
        details = parse_fund_details_html('<a href="tsdata.html">跟踪标的：</a>纳斯达克100指数 | <a>年化跟踪误差：</a>1.75%')
        self.assertEqual(details.get('track_target'), '纳斯达克100指数')

    def test_parses_three_year_return(self):
        html = (
            '<dd><span>近3年：</span>'
            '<span class="ui-num">47.69%</span></dd>'
        )

        details = parse_fund_details_html(html)

        self.assertEqual(details["return_3y"], 47.69)


class FeeDetailsParserTest(unittest.TestCase):
    def test_parses_and_sums_operation_fee_rates(self):
        html = """
        <tr>
          <td class="th">管理费率</td><td>1.20%（每年）</td>
          <td class="th">托管费率</td><td>0.20%（每年）</td>
          <td class="th">销售服务费率</td><td>0.40%（每年）</td>
        </tr>
        """

        details = parse_fee_details_html(html)

        self.assertEqual(details["management_fee_rate"], 1.2)
        self.assertEqual(details["custody_fee_rate"], 0.2)
        self.assertEqual(details["sales_service_fee_rate"], 0.4)
        self.assertEqual(details["operation_fee_rate"], 1.8)

    def test_requires_management_and_custody_rates_for_total(self):
        details = parse_fee_details_html(
            '<td class="th">管理费率</td><td>1.20%（每年）</td>'
        )

        self.assertIsNone(details["operation_fee_rate"])

    def test_treats_unlisted_sales_service_rate_as_zero_in_total(self):
        html = """
        <td class="th">管理费率</td><td>1.20%（每年）</td>
        <td class="th">托管费率</td><td>0.20%（每年）</td>
        <td class="th">销售服务费率</td><td>---</td>
        """

        details = parse_fee_details_html(html)

        self.assertIsNone(details["sales_service_fee_rate"])
        self.assertEqual(details["operation_fee_rate"], 1.4)


class WorldFundsTest(unittest.TestCase):
    def test_includes_world_codes_by_code_with_world_key(self):
        df = purchase_df([
            purchase_row("040046", "华安纳斯达克100ETF联接A"),
            purchase_row("006282", "摩根欧洲动力策略股票(QDII)A"),
        ])

        records = filter_funds(df)
        by_code = {r["code"]: r for r in records}

        self.assertEqual(by_code["040046"]["index_key"], "nasdaq100")
        self.assertEqual(by_code["006282"]["index_key"], "world")

    def test_skips_world_code_with_intramarket_status(self):
        df = purchase_df([
            purchase_row("006282", "摩根欧洲动力策略股票(QDII)A",
                         status="场内交易"),
        ])

        self.assertEqual(filter_funds(df), [])

    def test_replaces_blank_purchase_status(self):
        records = filter_funds(purchase_df([
            purchase_row("006282", "摩根欧洲动力策略股票(QDII)A", status=""),
        ]))

        self.assertEqual(records[0]["status"], "暂无申购信息")

    def test_export_json_excludes_world_records(self):
        conn = sqlite3.connect(":memory:")
        self.addCleanup(conn.close)
        init_db(conn)

        save_snapshot(conn, [fund_record(10000.0), world_record(10000.0)],
                      "2026-09-10")
        save_snapshot(conn, [fund_record(2000.0), world_record(2000.0)],
                      "2026-09-11")

        with tempfile.TemporaryDirectory() as tmp:
            out_path = Path(tmp) / "data.json"
            export_json(conn, [fund_record(2000.0), world_record(2000.0)],
                        "2026-09-11", out_path)
            payload = json.loads(out_path.read_text(encoding="utf-8"))

        self.assertEqual([f["code"] for f in payload["funds"]], ["018966"])
        self.assertTrue(len(payload["recent_changes"]) > 0)
        # 006282 属主动母池（world）但同在世界页清单中，其变更随世界页规则进入；
        # 仅在母池、不在世界页清单的基金变更依旧被排除
        self.assertTrue(all(c["code"] in {"018966", "006282"}
                            for c in payload["recent_changes"]))


class WorldPageTest(unittest.TestCase):
    def test_filter_funds_includes_worldpage_watchlist_by_code(self):
        df = purchase_df([
            purchase_row("012348", "天弘恒生科技ETF联接(QDII)A"),
        ])

        records = filter_funds(df)

        by_code = {r["code"]: r for r in records}
        self.assertEqual(by_code["012348"]["index_key"], "worldpage")
        self.assertEqual(by_code["012348"]["name"], "天弘恒生科技ETF联接A")

    def test_filter_funds_keeps_index_rule_for_overlapping_codes(self):
        # 美国段基金同时命中 INDEX_RULES 关键词与世界页清单，保留指数归属
        df = purchase_df([
            purchase_row("000834", "大成纳斯达克100ETF联接A"),
        ])

        records = filter_funds(df)

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["index_key"], "nasdaq100")

    def test_filter_funds_preserves_missing_limits_and_parses_units(self):
        import math

        df = purchase_df([
            purchase_row("021539", "华安法国CAC40ETF联接A", limit=math.nan),
            purchase_row("012348", "天弘恒生科技ETF联接A", limit="10.00万"),
        ])

        records = filter_funds(df)
        by_code = {r["code"]: r for r in records}

        self.assertIsNone(by_code["021539"]["limit_amount"])
        self.assertEqual(by_code["012348"]["limit_amount"], 100000.0)

    def test_rejects_nonfinite_and_negative_amounts(self):
        for value in [float('inf'), -1, True, 'bad']:
            records = filter_funds(purchase_df([
                purchase_row('012348', '天弘恒生科技ETF联接A', limit=value),
            ]))
            self.assertIsNone(records[0]['limit_amount'])

    def test_fetch_purchase_keeps_raw_amount_before_unit_parsing(self):
        row = ['012348', '天弘恒生科技ETF联接A', '指数', '1', '2026-09-19',
               '限大额', '开放赎回', '', '10', '10.00万元', '', '', '0.10%']
        response = Mock(text='var reData=' + json.dumps({'datas': [row]}))
        with patch('scanner.requests.get', return_value=response):
            records = filter_funds(fetch_purchase())
        self.assertEqual(records[0]['limit_amount'], 100000)
        self.assertEqual(records[0]['fee'], 0.1)

    def test_export_worldpage_exports_watchlist_with_history(self):
        conn = sqlite3.connect(":memory:")
        self.addCleanup(conn.close)
        init_db(conn)

        save_snapshot(conn, [worldpage_fund_record(10000.0)], "2026-09-10")
        save_snapshot(conn,
                      [worldpage_fund_record(1000.0, return_1m=-7.23, tracking_error=6.47)],
                      "2026-09-11")

        with tempfile.TemporaryDirectory() as tmp:
            out_path = Path(tmp) / "worldpage-data.json"
            export_worldpage_json(
                conn,
                [worldpage_fund_record(1000.0, return_1m=-7.23, tracking_error=6.47)],
                "2026-09-11", out_path)
            payload = json.loads(out_path.read_text(encoding="utf-8"))

        by_code = {f["code"]: f for f in payload["funds"]}
        target = by_code["012348"]
        self.assertEqual(target["status"], "限大额")
        self.assertEqual(target["limit_amount"], 1000.0)
        self.assertEqual(target["country"], "中国香港")
        self.assertEqual(len(target["history"]), 2)
        self.assertEqual(target["history"][-1]["limit_amount"], 1000.0)
        # enrich 详情字段随导出透传（前端据此覆盖静态快照的收益率等）
        self.assertEqual(target["return_1m"], -7.23)
        self.assertEqual(target["tracking_error"], 6.47)

    def test_export_worldpage_falls_back_to_db_latest_snapshot(self):
        # 当天接口缺行：records 无该基金，回退 funds 表最新快照
        conn = sqlite3.connect(":memory:")
        self.addCleanup(conn.close)
        init_db(conn)

        save_snapshot(conn, [worldpage_fund_record(500.0)], "2026-09-10")

        with tempfile.TemporaryDirectory() as tmp:
            out_path = Path(tmp) / "worldpage-data.json"
            export_worldpage_json(conn, [], "2026-09-11", out_path)
            payload = json.loads(out_path.read_text(encoding="utf-8"))

        target = next(f for f in payload["funds"] if f["code"] == "012348")
        self.assertEqual(target["status"], "限大额")
        self.assertEqual(target["limit_amount"], 500.0)

    def test_export_json_tags_worldpage_changes_with_region(self):
        conn = sqlite3.connect(":memory:")
        self.addCleanup(conn.close)
        init_db(conn)

        save_snapshot(conn, [fund_record(10000.0), worldpage_fund_record(10000.0)],
                      "2026-09-10")
        save_snapshot(conn, [fund_record(1000.0), worldpage_fund_record(1000.0)],
                      "2026-09-11")

        with tempfile.TemporaryDirectory() as tmp:
            out_path = Path(tmp) / "data.json"
            export_json(conn, [fund_record(1000.0), worldpage_fund_record(1000.0)],
                        "2026-09-11", out_path)
            payload = json.loads(out_path.read_text(encoding="utf-8"))

        by_code = {c["code"]: c for c in payload["recent_changes"]}
        self.assertIn("012348", by_code)
        self.assertEqual(by_code["012348"]["region"], "中国香港")
        # 美国基金变更不带 region 标签
        self.assertNotIn("region", by_code["018966"])


if __name__ == "__main__":
    unittest.main()
