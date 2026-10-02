import json
from pathlib import Path
import tempfile
import unittest

from fetch_market_dashboard import INDICATORS, parse_indicator, refresh_snapshot, write_snapshot


def payload(price=110, closes=None):
    # Two past daily closes followed by today's partial close; the range baseline is deliberately unrelated.
    return {"chart": {"result": [{"meta": {"symbol": "^DJI", "regularMarketPrice": price, "regularMarketTime": 1735920000, "exchangeTimezoneName": "America/New_York", "chartPreviousClose": 50}, "timestamp": [1735747200, 1735833600, 1735920000], "indicators": {"quote": [{"close": closes if closes is not None else [99, 100, 109]}]}}], "error": None}}


class MarketDashboardTests(unittest.TestCase):
    def test_daily_change_uses_prior_trading_day_not_range_baseline(self):
        result = parse_indicator(payload(), INDICATORS[0], "2025-01-04T00:00:00+00:00")
        self.assertEqual(result["previousClose"], 100)
        self.assertEqual(result["change"], 10)
        self.assertEqual(result["changePercent"], 10)

    def test_null_daily_close_is_skipped(self):
        result = parse_indicator(payload(closes=[99, None, 109]), INDICATORS[0], "2025-01-04T00:00:00+00:00")
        self.assertEqual(result["previousClose"], 99)
        self.assertEqual(len(result["history"]), 2)

    def test_quote_timestamp_uses_exchange_date_near_utc_midnight(self):
        data = payload()
        result = data["chart"]["result"][0]
        result["meta"]["regularMarketTime"] = 1735948800  # Jan 4 00:00 UTC, still Jan 3 in New York.
        quote = parse_indicator(data, INDICATORS[0], "2025-01-04T01:00:00+00:00")
        self.assertEqual(quote["tradingDate"], "2025-01-03")
        self.assertEqual(quote["previousClose"], 100)

    def test_invalid_quote_or_future_timestamp_is_rejected(self):
        for value in [None, True, float("nan"), float("inf"), -1, 0]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                parse_indicator(payload(price=value), INDICATORS[0], "2025-01-04T00:00:00+00:00")
        with self.assertRaises(ValueError):
            parse_indicator(payload(), INDICATORS[0], "2020-01-01T00:00:00+00:00")

    def test_partial_refresh_preserves_the_failed_indicator(self):
        old = {"id": "dow", "symbol": "^DJI", "value": 100, "asOf": "2025-01-01T00:00:00+00:00", "fetchedAt": "2025-01-01T00:00:00+00:00", "history": [{"date": "2025-01-01", "value": 100}]}
        def fetch(indicator, now):
            if indicator[0] == "dow":
                raise TimeoutError()
            return {"id": indicator[0], "value": 123, "history": [], "fetchedAt": now, "stale": False}
        result, count = refresh_snapshot({"indicators": [old]}, fetch)
        self.assertEqual(count, len(INDICATORS) - 1)
        self.assertEqual(result["indicators"][0]["value"], 100)
        self.assertEqual(result["indicators"][0]["asOf"], old["asOf"])
        self.assertTrue(result["indicators"][0]["stale"])
        self.assertNotIn("stale", old)

    def test_symbol_change_does_not_relabel_old_spot_cache_as_futures(self):
        def fetch(indicator, now):
            if indicator[0] in {'gold', 'copper'}:
                raise TimeoutError()
            return {'id': indicator[0], 'symbol': indicator[1], 'value': 123, 'history': [], 'fetchedAt': now}
        previous = {'indicators': [{'id': 'gold', 'symbol': 'XAU', 'value': 2000, 'history': [{'date': '2025-01-01', 'value': 2000}]}, {'id': 'copper', 'symbol': 'LME_Cu_cash', 'value': 10000, 'history': []}]}
        result, _ = refresh_snapshot(previous, fetch)
        gold = next(item for item in result['indicators'] if item['id'] == 'gold')
        self.assertEqual(gold['symbol'], 'GC=F')
        self.assertIsNone(gold['value'])
        self.assertEqual(gold['history'], [])
        self.assertTrue(gold['stale'])
        copper = next(item for item in result['indicators'] if item['id'] == 'copper')
        self.assertEqual(copper['symbol'], 'HG=F')
        self.assertIsNone(copper['value'])
        self.assertEqual(copper['unit'], 'usd-pound')

    def test_total_failure_preserves_cache_and_no_cache_is_rejected(self):
        def fail(*args):
            raise TimeoutError()
        previous = {"updatedAt": "2025-01-01T00:00:00+00:00", "indicators": [{"id": "dow", "symbol": "^DJI", "value": 100, "history": []}]}
        result, count = refresh_snapshot(previous, fail)
        self.assertEqual(count, 0)
        self.assertEqual(result["updatedAt"], previous["updatedAt"])
        with self.assertRaises(RuntimeError):
            refresh_snapshot({}, fail)

    def test_nonfinite_snapshot_does_not_overwrite_existing_output(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "market.json"
            path.write_text('{"value":100}')
            with self.assertRaises(ValueError):
                write_snapshot(path, {"value": float("nan")})
            self.assertEqual(json.loads(path.read_text()), {"value": 100})
            write_snapshot(path, {"value": 123})
            self.assertEqual(json.loads(path.read_text()), {"value": 123})

if __name__ == "__main__":
    unittest.main()
