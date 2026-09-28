import datetime
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import fetch_direct_limit as fetcher
import scanner
import update_direct_from_ai as ai
from direct_limit_store import save_observations, read_observations, write_json
from fund_registry import init_fund_registry, read_registry


class DirectSourceTest(unittest.TestCase):
    def test_ai_import_updates_registry_and_respects_locks_in_json(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            db, source, target = root / 'fund.db', root / 'ai.json', root / 'data.json'
            codes = ['012348', '012349', '040046', '000834']
            with sqlite3.connect(db) as conn:
                scanner.init_db(conn)
                init_fund_registry(conn)
                for code in codes:
                    conn.execute('UPDATE fund_registry SET direct_limit_amount=100,locked_fields=? WHERE code=?', ('[]', code))
                conn.execute("UPDATE fund_registry SET direct_limit_amount=0,locked_fields='[\"direct_limit_amount\"]' WHERE code='012349'")
                conn.execute("UPDATE fund_registry SET direct_limit_amount=NULL,locked_fields='[\"direct_limit_amount\"]' WHERE code='040046'")
                conn.execute("UPDATE fund_registry SET active=0 WHERE code='000834'")
            target.write_text(json.dumps({'funds': [{'code': code, 'direct_limit_amount': 100} for code in codes]}))
            source.write_text(json.dumps({'as_of': '2026-09-19', 'source_url': 'https://mp.weixin.qq.com/s/test',
                                          'funds': {code: 500 for code in codes}}))
            with patch('sys.argv', ['update_direct_from_ai.py', '--input', str(source), '--db', str(db),
                                   '--out', str(target), '--world-page-out', str(target), '--world-out', str(target)]):
                self.assertEqual(ai.main(), 0)
            with sqlite3.connect(db) as conn:
                funds = {fund['code']: fund for fund in read_registry(conn, active_only=False)}
                self.assertEqual(funds['012348']['direct_limit_amount'], 500)
                self.assertEqual(funds['012349']['direct_limit_amount'], 0)
                self.assertIsNone(funds['040046']['direct_limit_amount'])
                self.assertEqual(funds['000834']['direct_limit_amount'], 100)
                for code in codes[:3]:
                    self.assertEqual(funds[code]['auto_values']['direct_limit_amount'], 500)
                # 旧日期导入不能让名册退回旧额度。
                save_observations(conn, {'as_of': '2026-09-18', 'funds': {'012348': {'direct_limit_amount': 50}}})
                self.assertEqual(next(f for f in read_registry(conn) if f['code'] == '012348')['direct_limit_amount'], 500)
            published = {fund['code']: fund for fund in json.loads(target.read_text())['funds']}
            self.assertEqual(published['012348']['direct_limit_amount'], 500)
            self.assertEqual(published['012349']['direct_limit_amount'], 0)
            self.assertIsNone(published['040046']['direct_limit_amount'])
            self.assertNotIn('000834', published)

    def test_store_keeps_per_fund_dates_and_zeros(self):
        conn = sqlite3.connect(':memory:')
        self.addCleanup(conn.close)
        save_observations(conn, {'as_of': '2026-09-19', 'source': 'wechat-ai',
                                'funds': {'012348': {'direct_limit_amount': 0}}})
        save_observations(conn, {'as_of': '2026-09-18', 'source': 'anxinletech.com',
                                'funds': {'012348': {'direct_limit_amount': 1000},
                                          '012349': {'direct_limit_amount': 500}}})
        saved = read_observations(conn)
        self.assertEqual(saved['012348']['direct_limit_amount'], 0)
        self.assertEqual(saved['012348']['direct_as_of'], '2026-09-19')
        self.assertEqual(saved['012349']['direct_as_of'], '2026-09-18')
        # 同日的网站有效档位优先；随后未知值不能擦掉该值。
        save_observations(conn, {'as_of': '2026-09-19', 'source': 'anxinletech.com',
                                'funds': {'012348': {'direct_limit_amount': 200}}})
        save_observations(conn, {'as_of': '2026-09-19', 'source': 'wechat-ai',
                                'funds': {'012348': {'direct_limit_amount': 900}}})
        save_observations(conn, {'as_of': '2026-09-19', 'funds': {'012348': {'direct_limit_amount': None}}})
        self.assertEqual(read_observations(conn)['012348']['direct_limit_amount'], 200)

    def test_invalid_json_does_not_replace_existing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'data.json'
            target.write_text('{"ok":true}')
            with self.assertRaises(ValueError):
                write_json(target, {'limit_amount': float('inf')})
            self.assertEqual(target.read_text(), '{"ok":true}')

    def test_older_article_does_not_replace_newer_site_amount(self):
        site = {'as_of': '2026-09-18', 'funds': {'012348': {'direct_limit_amount': 1000}}}
        article = {'as_of': '2026-09-17', 'funds': {'012348': {
            'direct_limit_amount': 100, 'direct_channel_note': '', 'direct_source_status': 'wechat'}}}
        with patch.object(fetcher, 'fetch_direct_limits_anxinle', return_value=site), \
                patch.object(fetcher, 'fetch_from_wechat', return_value=article):
            result = fetcher.fetch_direct_limits()
        self.assertEqual(result['funds']['012348']['direct_limit_amount'], 1000)

    def test_current_site_with_missing_amount_still_tries_fallback(self):
        today = datetime.date.today().isoformat()
        site = {'as_of': today, 'funds': {'012348': {'direct_limit_amount': None}}}
        article = {'as_of': today, 'funds': {'012348': {
            'direct_limit_amount': 100, 'direct_channel_note': '', 'direct_source_status': 'wechat'}}}
        with patch.object(fetcher, 'fetch_direct_limits_anxinle', return_value=site), \
                patch.object(fetcher, 'fetch_from_wechat', return_value=article):
            result = fetcher.fetch_direct_limits()
        self.assertEqual(result['funds']['012348']['direct_limit_amount'], 100)

    def test_ai_update_survives_next_scan_and_updates_both_pages(self):
        from test_scanner import fund_record
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            db = root / 'fund.db'
            source = root / 'ai.json'
            us = root / 'data.json'
            world = root / 'worldpage-data.json'
            record = fund_record(100)
            record['direct_limit_amount'] = 1000
            for target in (us, world):
                target.write_text(json.dumps({'funds': [record]}))
            source.write_text(json.dumps({'as_of': '2026-09-19',
                'source_url': 'https://mp.weixin.qq.com/s/test', 'funds': {'018966': 5000}}))
            with patch.object(ai, 'SRC', source), patch.object(ai, 'TARGET', world), \
                    patch('sys.argv', ['update_direct_from_ai.py', '--db', str(db), '--out', str(us),
                                       '--world-out', str(root / 'world-data.json')]):
                self.assertEqual(ai.main(), 0)
            self.assertEqual(json.loads(us.read_text())['funds'][0]['direct_limit_amount'], 5000)
            conn = sqlite3.connect(db)
            try:
                scanner.init_db(conn)
                older = {'as_of': '2026-09-18', 'funds': {'018966': {'direct_limit_amount': 1000}}}
                with patch.object(scanner, 'fetch_direct_limits', return_value=older):
                    scanner.merge_direct_limits([record], conn)
                self.assertEqual(record['direct_limit_amount'], 5000)
                with patch.object(scanner, 'fetch_direct_limits', side_effect=RuntimeError('offline')):
                    scanner.merge_direct_limits([record], conn)
                self.assertEqual(record['direct_limit_amount'], 5000)
            finally:
                conn.close()

    def test_ai_rejects_invalid_amount_without_touching_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'ai.json'
            target = root / 'worldpage-data.json'
            original = json.dumps({'funds': [{'code': '012348', 'direct_limit_amount': 1000}]})
            target.write_text(original)
            source.write_text(json.dumps({'as_of': '2026-09-19',
                'source_url': 'https://mp.weixin.qq.com/s/test', 'funds': {'012348': -1}}))
            with patch.object(ai, 'SRC', source), patch.object(ai, 'TARGET', target), \
                    patch('sys.argv', ['update_direct_from_ai.py', '--db', str(root / 'fund.db')]):
                self.assertEqual(ai.main(), 1)
            self.assertEqual(target.read_text(), original)


if __name__ == '__main__':
    unittest.main()
