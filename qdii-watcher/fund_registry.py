"""统一基金名册：后台编辑和扫描器共享的 SQLite 主数据表。"""
import json
import math
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent
SEED_PATH = BASE_DIR / "fund_registry_seed.json"
POOL_PATH = BASE_DIR / "active_qdii_pool.json"
META_PATH = BASE_DIR / "active_qdii_metadata.json"
WATCHLIST_PATH = BASE_DIR / "world_watchlist.json"
SCAN_FIELDS = (
    "name", "status", "redeem", "limit_amount", "min_buy", "direct_limit_amount",
    "direct_as_of", "direct_source", "direct_source_url", "track_target", "tracking_error",
    "fee", "return_1m", "return_6m", "return_1y", "return_3y", "return_since",
    "inception_date", "fund_size", "fund_size_date", "management_fee_rate",
    "custody_fee_rate", "sales_service_fee_rate", "operation_fee_rate",
)
LOCKABLE_FIELDS = frozenset(SCAN_FIELDS)
REGISTRY_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS fund_registry (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    market TEXT NOT NULL CHECK (market IN ('us', 'other', 'cross')),
    region TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    source_group TEXT NOT NULL DEFAULT 'manual',
    index_key TEXT NOT NULL DEFAULT '',
    status TEXT, redeem TEXT, limit_amount REAL, min_buy REAL,
    direct_limit_amount REAL, direct_as_of TEXT, direct_source TEXT, direct_source_url TEXT,
    track_target TEXT, tracking_error REAL, fee REAL,
    return_1m REAL, return_6m REAL, return_1y REAL, return_3y REAL, return_since REAL,
    inception_date TEXT, fund_size REAL, fund_size_date TEXT,
    management_fee_rate REAL, custody_fee_rate REAL, sales_service_fee_rate REAL,
    operation_fee_rate REAL,
    locked_fields TEXT NOT NULL DEFAULT '[]',
    auto_values TEXT NOT NULL DEFAULT '{}',
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS fund_registry_meta (
    key TEXT PRIMARY KEY, value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fund_registry_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    action TEXT NOT NULL,
    changed_fields TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
);
"""


def _read_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return fallback


def _as_number(value):
    if isinstance(value, bool) or value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _limit_to_yuan(value):
    number = _as_number(value)
    if number is None:
        return None
    # worldFunds.js 的存量限额以“万元”为单位；无限额标记保持原值。
    return number if number >= 1e11 else number * 10000


def _kind_from_name(name):
    text = str(name or '')
    if 'ETF联接' in text or '指数发起' in text:
        return '被动联接'
    if 'FOF' in text:
        return '被动FOF'
    return '主动'


def _insert_seed(conn, item, now, limits_are_yuan=False):
    code = str(item.get('code') or '')
    name = str(item.get('name') or '').strip()
    if len(code) != 6 or not code.isdigit() or not name:
        return
    market = item.get('market') if item.get('market') in ('us', 'other', 'cross') else 'other'
    source_group = str(item.get('source_group') or 'manual')
    fields = {key: item.get(key) for key in SCAN_FIELDS}
    if fields.get('return_1y') is None:
        fields['return_1y'] = _as_number(item.get('y1'))
    if not limits_are_yuan:
        fields['limit_amount'] = _limit_to_yuan(item.get('limit_amount'))
        fields['direct_limit_amount'] = _limit_to_yuan(item.get('direct_limit_amount'))
    tags = item.get('tags') if isinstance(item.get('tags'), list) else []
    columns = (
        'code', 'name', 'market', 'region', 'kind', 'tags', 'source_group', 'index_key',
        *SCAN_FIELDS[1:], 'locked_fields', 'auto_values', 'active', 'created_at', 'updated_at', 'deleted_at',
    )
    values = [
        code, name, market, str(item.get('region') or ''), str(item.get('kind') or _kind_from_name(name)),
        json.dumps(tags, ensure_ascii=False), source_group, str(item.get('index_key') or ''),
        *(fields.get(key) for key in SCAN_FIELDS[1:]),
        '[]', json.dumps(fields, ensure_ascii=False, allow_nan=False), 1, now, now, None,
    ]
    placeholders = ','.join('?' for _ in columns)
    conn.execute(
        'INSERT OR IGNORE INTO fund_registry (' + ','.join(columns) + ') VALUES (' + placeholders + ')',
        values,
    )


def init_fund_registry(conn: sqlite3.Connection) -> None:
    """建立表并对旧清单做一次事务型、可重复调用的初次迁移。"""
    # executescript 会隐式提交；逐条执行静态 DDL 才能和 seed_v1 标记一起原子提交。
    with conn:
        for statement in SCHEMA.split(';'):
            if statement.strip():
                conn.execute(statement)
        if conn.execute("SELECT 1 FROM fund_registry_meta WHERE key = 'seed_v1'").fetchone():
            repair_legacy_units(conn)
            release_non_amount_locks(conn)
            restore_index_keys(conn)
            return
        now = datetime.now().isoformat(timespec='seconds')
        seed = _read_json(SEED_PATH, {"funds": []})
        for item in seed.get('funds', []) if isinstance(seed, dict) else []:
            _insert_seed(conn, item, now)

        world = _read_json(WATCHLIST_PATH, {"funds": []})
        world_by_code = {str(row.get('code')): row for row in world.get('funds', []) if isinstance(row, dict)}
        pool = _read_json(POOL_PATH, {"funds": []})
        metadata = _read_json(META_PATH, {"funds": {}}).get('funds', {})
        for item in pool.get('funds', []) if isinstance(pool, dict) else []:
            if not isinstance(item, dict):
                continue
            code = str(item.get('code') or '')
            details = metadata.get(code, {}) if isinstance(metadata, dict) else {}
            regions = details.get('regions', []) if isinstance(details, dict) else []
            region_names = [str(value) for value in regions if isinstance(value, str) and value]
            is_cross = len(region_names) > 1 or any('全球' in value or '多市场' in value for value in region_names)
            region = ' / '.join(region_names) or '多市场 / 全球'
            tags = [*region_names, *(details.get('themes', []) if isinstance(details, dict) else [])]
            _insert_seed(conn, {
                'code': code, 'name': item.get('name'), 'market': 'cross' if is_cross else 'other',
                'region': region, 'kind': '主动', 'tags': tags, 'source_group': 'active_pool',
                'index_key': 'world', 'inception_date': item.get('inception_date'),
            }, now)

        # 旧扫描表的当日数据优先补足静态迁移缺失的自动字段；不会覆盖已有名册记录。
        table_exists = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='funds'"
        ).fetchone()
        if table_exists:
            old_cols = {row[1] for row in conn.execute('PRAGMA table_info(funds)')}
            selected = [field for field in SCAN_FIELDS if field in old_cols]
            rows = conn.execute('SELECT code, name, index_key, ' + ','.join(selected) + ' FROM funds').fetchall()
            for row in rows:
                old = dict(zip(['code', 'name', 'index_key', *selected], row))
                code = str(old.get('code') or '')
                if len(code) != 6 or not code.isdigit() or not old.get('name'):
                    continue
                prior = conn.execute('SELECT 1 FROM fund_registry WHERE code=?', (code,)).fetchone()
                if not prior:
                    watch = world_by_code.get(code, {})
                    index_key = old.get('index_key') or ''
                    if index_key in ('nasdaq100', 'sp500', 'manual'):
                        market, region, source_group = 'us', '美国', 'us'
                    elif index_key == 'world':
                        market, region, source_group = 'other', '多市场 / 全球', 'active_pool'
                    else:
                        region = str(watch.get('country') or '其他市场')
                        market = 'cross' if '跨市场' in region or '全球' in region else ('us' if region == '美国' else 'other')
                        source_group = 'worldpage' if watch else ('us' if market == 'us' else 'manual')
                    record = {
                        'code': code, 'name': old.get('name'), 'market': market, 'region': region,
                        'kind': _kind_from_name(old.get('name')), 'source_group': source_group,
                        'index_key': index_key,
                    }
                    record.update({field: old.get(field) for field in selected if field != 'name'})
                    _insert_seed(conn, record, now, limits_are_yuan=True)
                else:
                    merge_fields = [field for field in selected if field not in ('name',)]
                    assignments = ','.join(field + '=COALESCE(?, ' + field + ')' for field in merge_fields)

                    def merge_value(field):
                        value = old.get(field)
                        # 旧扫描表已经使用元，静态 seed 才需要转换。
                        return value

                    values = [merge_value(field) for field in merge_fields]
                    if assignments:
                        conn.execute('UPDATE fund_registry SET ' + assignments + ', updated_at=? WHERE code=?',
                                     (*values, now, code))
                        stored = conn.execute('SELECT auto_values FROM fund_registry WHERE code=?', (code,)).fetchone()
                        try:
                            auto_values = json.loads(stored[0] or '{}')
                        except (TypeError, json.JSONDecodeError):
                            auto_values = {}
                        for field in merge_fields:
                            if old.get(field) is not None:
                                auto_values[field] = merge_value(field)
                        conn.execute('UPDATE fund_registry SET auto_values=? WHERE code=?',
                                     (json.dumps(auto_values, ensure_ascii=False, allow_nan=False), code))

        # 旧人工核验值迁移为字段锁，避免原覆盖项继续压过后台编辑。
        legacy_locks = {
            '012979': {'direct_limit_amount': 100_000_000_000, 'direct_as_of': '2026-09-22', 'direct_source': '人工核验'},
            '012980': {'direct_limit_amount': 100_000_000_000, 'direct_as_of': '2026-09-22', 'direct_source': '人工核验'},
            '022005': {'status': '暂停申购'},
        }
        for code, values in legacy_locks.items():
            current = conn.execute('SELECT locked_fields FROM fund_registry WHERE code=?', (code,)).fetchone()
            if not current:
                continue
            locked = set(json.loads(current[0] or '[]'))
            for field, value in values.items():
                if field not in locked:
                    conn.execute('UPDATE fund_registry SET ' + field + '=?, updated_at=? WHERE code=?',
                                 (value, now, code))
                    locked.add(field)
            conn.execute('UPDATE fund_registry SET locked_fields=? WHERE code=?',
                         (json.dumps(sorted(locked)), code))

        conn.execute("INSERT INTO fund_registry_meta(key, value) VALUES ('seed_v1', ?)",
                     (datetime.now().isoformat(timespec='seconds'),))

        conn.execute("INSERT OR IGNORE INTO fund_registry_meta(key,value) VALUES('funds_units_v2',?)", (now,))
        release_non_amount_locks(conn)
        restore_index_keys(conn)


def repair_legacy_units(conn):
    if conn.execute("SELECT 1 FROM fund_registry_meta WHERE key='funds_units_v2'").fetchone():
        return
    if conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='funds'").fetchone():
        columns = {row[1] for row in conn.execute('PRAGMA table_info(funds)')}
        for field in ('limit_amount', 'direct_limit_amount'):
            if field not in columns:
                continue
            for code, amount in conn.execute('SELECT code,' + field + ' FROM funds').fetchall():
                row = conn.execute('SELECT ' + field + ',locked_fields,auto_values FROM fund_registry WHERE code=?', (code,)).fetchone()
                if not row or field in json.loads(row[1] or '[]') or amount is None or not (0 < amount < 1e11) or row[0] != amount * 10000:
                    continue
                auto = json.loads(row[2] or '{}')
                auto[field] = amount
                conn.execute('UPDATE fund_registry SET ' + field + '=?,auto_values=? WHERE code=?', (amount, json.dumps(auto), code))
    conn.execute("INSERT INTO fund_registry_meta(key,value) VALUES('funds_units_v2',?)", (datetime.now().isoformat(timespec='seconds'),))


def release_non_amount_locks(conn):
    if conn.execute("SELECT 1 FROM fund_registry_meta WHERE key='amount_overrides_v1'").fetchone():
        return
    for code, raw_locks, raw_auto in conn.execute('SELECT code,locked_fields,auto_values FROM fund_registry').fetchall():
        locks, auto = json.loads(raw_locks or '[]'), json.loads(raw_auto or '{}')
        for field in locks:
            if field in LOCKABLE_FIELDS and field not in ('limit_amount', 'direct_limit_amount', 'status') and field in auto and (field != 'name' or auto[field]):
                conn.execute('UPDATE fund_registry SET ' + field + '=? WHERE code=?', (auto[field], code))
        conn.execute('UPDATE fund_registry SET locked_fields=? WHERE code=?', (json.dumps([field for field in locks if field in ('limit_amount', 'direct_limit_amount', 'status')]), code))
    conn.execute("INSERT INTO fund_registry_meta(key,value) VALUES('amount_overrides_v1',?)", (datetime.now().isoformat(timespec='seconds'),))


def restore_index_keys(conn):
    if conn.execute("SELECT 1 FROM fund_registry_meta WHERE key='index_keys_v1'").fetchone():
        return
    if conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='funds'").fetchone():
        if 'index_key' in {row[1] for row in conn.execute('PRAGMA table_info(funds)')}:
            conn.execute("UPDATE fund_registry SET index_key=(SELECT index_key FROM funds WHERE funds.code=fund_registry.code) WHERE index_key='' AND EXISTS (SELECT 1 FROM funds WHERE funds.code=fund_registry.code AND index_key IS NOT NULL)")
    conn.execute("INSERT INTO fund_registry_meta(key,value) VALUES('index_keys_v1',?)", (datetime.now().isoformat(timespec='seconds'),))


def decode_registry_row(row):
    result = dict(row)
    for field in ('tags', 'locked_fields', 'auto_values'):
        try:
            result[field] = json.loads(result.get(field) or ('{}' if field == 'auto_values' else '[]'))
        except json.JSONDecodeError:
            result[field] = {} if field == 'auto_values' else []
    result['active'] = bool(result.get('active'))
    return result


def read_registry(conn: sqlite3.Connection, active_only: bool = True):
    where = ' WHERE active = 1' if active_only else ''
    cursor = conn.execute('SELECT * FROM fund_registry' + where + ' ORDER BY market, region, name, code')
    names = [description[0] for description in cursor.description]
    return [decode_registry_row(row if hasattr(row, 'keys') else dict(zip(names, row)))
            for row in cursor.fetchall()]


def sync_registry_scan(conn: sqlite3.Connection, records: list, raw_records: list, today: str) -> None:
    """保存抓取原值，并以锁定值为最终值；必须在调用方的 BEGIN IMMEDIATE 内执行。"""
    registry = {row['code']: row for row in read_registry(conn, active_only=False)}
    raw_by_code = {record['code']: record for record in raw_records}
    now = datetime.now().isoformat(timespec='seconds')
    for record in records:
        code = record['code']
        current = registry.get(code)
        raw = raw_by_code.get(code, record)
        if current and not current['active']:
            continue
        if current is None:
            market = 'us' if record.get('index_key') in ('nasdaq100', 'sp500', 'manual') else 'other'
            region = '美国' if market == 'us' else '多市场 / 全球'
            kind = _kind_from_name(record.get('name'))
            current = {
                'code': code, 'name': record.get('name'), 'market': market, 'region': region,
                'kind': kind, 'tags': [], 'source_group': 'us' if market == 'us' else 'manual',
                'index_key': record.get('index_key') or '', 'locked_fields': [], 'auto_values': {},
                'active': True,
            }
            _insert_seed(conn, {**current, **record}, now, limits_are_yuan=True)
            current = {**current, 'auto_values': {}, 'locked_fields': []}
        locked = set(current.get('locked_fields') or [])
        auto_values = dict(current.get('auto_values') or {})
        updates = {}
        # 已存在的名册也需要接收扫描识别的指数；尊重管理员维护的市场。
        if current.get('market') == 'us':
            index_key = raw.get('index_key')
            if index_key not in ('nasdaq100', 'sp500'):
                text = str(raw.get('name') or current.get('name') or '') + ' ' + str(raw.get('track_target') or current.get('track_target') or '')
                if any(word in text for word in ('纳斯达克100', '纳指', '纳斯达克科技')):
                    index_key = 'nasdaq100'
                elif any(word in text for word in ('标普500', '标准普尔500')):
                    index_key = 'sp500'
                else:
                    index_key = current.get('index_key') or 'manual'
            updates['index_key'] = index_key
            record['index_key'] = index_key
        for field in SCAN_FIELDS:
            value = raw.get(field)
            if value is not None:
                auto_values[field] = value
            # scanner 的空响应保留最近有效自动值，避免短暂源站缺数擦除前台资料。
            if field in locked:
                effective = current.get(field)
                record[field] = effective
                updates[field] = effective
                continue
            effective = auto_values.get(field)
            if field == 'name' and not locked.__contains__('name') and value:
                effective = value
                auto_values[field] = value
            if field in record and effective is not None:
                record[field] = effective
                updates[field] = effective
        record.update({
            'market': current.get('market'), 'region': current.get('region'),
            'kind': current.get('kind'), 'tags': current.get('tags') or [],
            'source_group': current.get('source_group'),
        })
        updates.update({'auto_values': json.dumps(auto_values, ensure_ascii=False, allow_nan=False),
                        'updated_at': now})
        assignments = ','.join(key + '=?' for key in updates)
        conn.execute('UPDATE fund_registry SET ' + assignments + ' WHERE code=?',
                     (*updates.values(), code))
