import unittest
from domestic_market import parse_eastmoney_quote, parse_sina_quote, refresh_domestic_snapshot


class DomesticMarketTests(unittest.TestCase):
    def test_eastmoney_quote_uses_decimal_prices_and_quote_time(self):
        result = parse_eastmoney_quote({'data': {'f43': 7805.45, 'f57': 'SPX', 'f58': '标普500', 'f60': 7807.24, 'f86': 1791982216, 'f107': 100}}, 'sp500', '2026-10-14T13:00:00+00:00')
        self.assertEqual(result['value'], 7805.45)
        self.assertAlmostEqual(result['change'], -1.79)
        self.assertEqual(result['symbol'], '^GSPC')
        self.assertEqual(result['source'], '东方财富')
        self.assertNotEqual(result['asOf'], result['fetchedAt'])

    def test_wrong_symbol_missing_and_nonfinite_quote_are_rejected(self):
        base = {'f43': 7805.45, 'f57': 'SPX', 'f58': '标普500', 'f60': 7807.24, 'f86': 1791982216, 'f107': 100}
        for key, value in [('f57', 'NDX'), ('f43', True), ('f43', '-'), ('f43', float('nan')), ('f43', float('inf')), ('f43', 0), ('f86', 0), ('f86', 9999999999)]:
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                parse_eastmoney_quote({'data': {**base, key: value}}, 'sp500', '2026-10-14T13:00:00+00:00')

    def test_sina_copper_converts_cents_and_labels_settlement_basis(self):
        text = 'var hq_str_hf_HG="668.834,,668.700,668.850,678.900,668.650,21:03:51,672.600,672.700,0,4,3,2026-10-14,美铜,0";'
        result = parse_sina_quote(text, 'copper', '2026-10-14T13:10:00+00:00')
        self.assertAlmostEqual(result['value'], 6.68834)
        self.assertAlmostEqual(result['change'], -0.03766)
        self.assertEqual(result['changeBasis'], 'settlement')
        self.assertEqual(result['asOf'], '2026-10-14T13:03:51+00:00')

    def test_sina_onshore_fx_does_not_use_cnh_or_central_parity(self):
        text = 'var hq_str_USDCNY="21:03:02,6.6978,6.6987,6.6947,74,6.6935,6.6988,6.6914,6.6988,美元人民币,2026-10-14";'
        result = parse_sina_quote(text, 'usdcny', '2026-10-14T13:10:00+00:00')
        self.assertEqual(result['value'], 6.6988)
        self.assertEqual(result['symbol'], 'CNY=X')
        with self.assertRaises(ValueError):
            parse_sina_quote(text.replace('USDCNY', 'USDCNH'), 'usdcny', '2026-10-14T13:10:00+00:00')

    def test_sina_vix_global_index_has_its_own_price_date_and_baseline(self):
        text = 'var hq_str_znb_VIX="VIX恐慌指数,15.8900,0.61,3.99,,,2026-10-14,21:22:46,15.1700,15.2800,15.8900,14.9800,0";'
        item = parse_sina_quote(text, 'vix', '2026-10-14T13:30:00+00:00')
        self.assertEqual(item['value'], 15.89)
        self.assertEqual(item['change'], 0.61)
        self.assertEqual(item['asOf'], '2026-10-14T13:22:46+00:00')

    def test_sina_us_index_uses_the_explicit_exchange_timestamp_not_fetch_time(self):
        fields = ['道琼斯', '51670.1016'] + ['0'] * 28
        fields[3] = '2026-10-14 21:10:02'
        fields[25] = 'Oct 13 04:41PM EDT'
        fields[26] = '51850.55'
        fields[29] = '2026'
        text = 'var hq_str_gb_$dji="' + ','.join(fields) + '";'
        item = parse_sina_quote(text, 'dow', '2026-10-14T13:30:00+00:00')
        self.assertEqual(item['asOf'], '2026-10-13T20:41:00+00:00')
        self.assertAlmostEqual(item['change'], -180.4484)

    def test_refresh_preserves_history_and_failed_quotes_without_relabeling(self):
        old = {'id': 'sp500', 'symbol': '^GSPC', 'value': 100, 'history': [{'date': '2026-10-13', 'value': 100}], 'source': 'Yahoo Finance', 'fetchedAt': '2026-10-13T00:00:00+00:00'}
        def fetch(indicator_id, now):
            if indicator_id == 'sp500':
                return {**old, 'value': 110, 'source': '东方财富', 'fetchedAt': now, 'history': [], 'stale': False}
            raise TimeoutError()
        snapshot, count = refresh_domestic_snapshot({'indicators': [old]}, fetch)
        self.assertEqual(count, 1)
        item = next(item for item in snapshot['indicators'] if item['id'] == 'sp500')
        self.assertEqual(item['history'], old['history'])
        self.assertEqual(item['historySource'], 'Yahoo Finance')
        self.assertEqual(item['historyAsOf'], '2026-10-13')
        self.assertEqual(item['source'], '东方财富')
        self.assertEqual(old['value'], 100)
        with self.assertRaises(RuntimeError):
            refresh_domestic_snapshot({}, lambda *args: (_ for _ in ()).throw(TimeoutError()))
