import copy
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from fund_registry import init_fund_registry, read_registry, sync_registry_scan
from scanner import init_db, export_worldpage_json, save_snapshot
from direct_limit_store import init_store, save_observations


class FundRegistryTest(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(':memory:')
        self.addCleanup(self.conn.close)
        init_db(self.conn)

    def test_old_scan_units_and_idempotency(self):
        self.conn.execute('INSERT INTO funds(code,name,index_key,limit_amount,min_buy,updated_at) VALUES(?,?,?,?,?,?)',
                          ('040046', '历史基金', 'nasdaq100', 100, 10, '2026-09-26'))
        self.conn.commit()
        init_fund_registry(self.conn)
        init_fund_registry(self.conn)
        fund = next(r for r in read_registry(self.conn) if r['code'] == '040046')
        self.assertEqual(fund['limit_amount'], 100)
        self.assertEqual(fund['auto_values']['limit_amount'], 100)

    def test_deleted_fund_not_reexported_from_history(self):
        record = dict(code='012348', name='历史基金', index_key='worldpage',
                      status='限大额', redeem='开放赎回', limit_amount=100, min_buy=10)
        save_snapshot(self.conn, [record], '2026-09-26')
        init_fund_registry(self.conn)
        self.conn.execute("UPDATE fund_registry SET active=0 WHERE code='012348'")
        self.conn.commit()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'worldpage.json'
            export_worldpage_json(self.conn, [], '2026-09-28', output)
            self.assertNotIn('012348', [r['code'] for r in json.loads(output.read_text())['funds']])

    def test_manual_amount_null_preserved_and_scan_updates_other_fields(self):
        init_fund_registry(self.conn)
        self.conn.execute("UPDATE fund_registry SET limit_amount=NULL,direct_limit_amount=777,locked_fields=? WHERE code='012348'", (json.dumps(['limit_amount', 'direct_limit_amount']),))
        init_store(self.conn)
        self.assertEqual(save_observations(self.conn, {'funds': {'012348': {'direct_limit_amount': 300, 'direct_as_of': '2026-09-28', 'direct_source': '扫描源'}}}), 1)
        self.conn.commit()
        records = [dict(code='012348', name='新名称', index_key='worldpage', status='开放申购',
                        redeem='开放赎回', limit_amount=200, min_buy=10, direct_limit_amount=300)]
        self.conn.execute('BEGIN IMMEDIATE')
        sync_registry_scan(self.conn, records, copy.deepcopy(records), '2026-09-28')
        self.conn.commit()
        fund = next(r for r in read_registry(self.conn) if r['code'] == '012348')
        self.assertIsNone(records[0]['limit_amount'])
        self.assertEqual(fund['auto_values']['limit_amount'], 200)
        self.assertEqual(fund['status'], '开放申购')
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'worldpage.json'
            export_worldpage_json(self.conn, records, '2026-09-28', output)
            exported = next(r for r in json.loads(output.read_text())['funds'] if r['code'] == '012348')
            self.assertIsNone(exported['limit_amount'])
            self.assertEqual(exported['direct_limit_amount'], 777)
            self.assertEqual(exported['name'], '新名称')

    def test_existing_broken_units_and_non_amount_locks(self):
        self.test_old_scan_units_and_idempotency()
        self.conn.execute("DELETE FROM fund_registry_meta WHERE key IN ('funds_units_v2','amount_overrides_v1')")
        self.conn.execute("UPDATE fund_registry SET limit_amount=1000000,status='暂停申购',locked_fields=? WHERE code='040046'", (json.dumps(['status']),))
        self.conn.commit()
        init_fund_registry(self.conn)
        fund = next(r for r in read_registry(self.conn) if r['code'] == '040046')
        self.assertEqual(fund['limit_amount'], 100)
        self.assertIn('status', fund['locked_fields'])
        self.assertEqual(fund['status'], '暂停申购')

    def test_scan_backfills_index_without_changing_market(self):
        init_fund_registry(self.conn)
        for market, initial_key, scan_key, expected in (
            ('us', '', 'nasdaq100', 'nasdaq100'),
            ('us', 'manual', 'sp500', 'sp500'),
            ('other', 'worldpage', 'nasdaq100', 'worldpage'),
        ):
            with self.subTest(market=market, scan_key=scan_key):
                self.conn.execute("UPDATE fund_registry SET market=?,index_key=? WHERE code='040046'", (market, initial_key))
                records = [dict(code='040046', name='测试基金', index_key=scan_key, status='开放申购', limit_amount=100)]
                sync_registry_scan(self.conn, records, copy.deepcopy(records), '2026-09-28')
                fund = next(r for r in read_registry(self.conn) if r['code'] == '040046')
                self.assertEqual(fund['index_key'], expected)
                self.assertEqual(fund['market'], market)
                if market == 'us':
                    self.assertEqual(records[0]['index_key'], expected)

    def test_manual_status_survives_scan_and_restart(self):
        init_fund_registry(self.conn)
        self.conn.execute("UPDATE fund_registry SET status='暂停申购',locked_fields=? WHERE code='012348'", (json.dumps(['status']),))
        self.conn.commit()
        init_fund_registry(self.conn)
        records = [dict(code='012348', name='测试基金', index_key='worldpage', status='开放申购',
                        redeem='开放赎回', limit_amount=200, min_buy=10)]
        self.conn.execute('BEGIN IMMEDIATE')
        sync_registry_scan(self.conn, records, copy.deepcopy(records), '2026-09-28')
        self.conn.commit()
        fund = next(r for r in read_registry(self.conn) if r['code'] == '012348')
        self.assertEqual(records[0]['status'], '暂停申购')
        self.assertEqual(fund['status'], '暂停申购')
        self.assertEqual(fund['auto_values']['status'], '开放申购')
        self.assertEqual(fund['limit_amount'], 200)
