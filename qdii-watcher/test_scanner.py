import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

import pandas as pd

from scanner import (
    export_json,
    filter_funds,
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
        self.assertTrue(all(c["code"] == "018966"
                            for c in payload["recent_changes"]))


if __name__ == "__main__":
    unittest.main()
