import sqlite3
import unittest

from scanner import init_db, save_snapshot


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


if __name__ == "__main__":
    unittest.main()
