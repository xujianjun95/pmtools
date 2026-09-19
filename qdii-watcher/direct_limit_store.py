"""直销额度的共享存储：网站与 AI 共用日期比较及发布锁。"""
from contextlib import contextmanager
from datetime import date, datetime
import fcntl
import json
import math
from pathlib import Path
import re
import tempfile


def valid_date(value):
    try:
        return isinstance(value, str) and date.fromisoformat(value).isoformat() == value and value <= date.today().isoformat()
    except ValueError:
        return False


def valid_amount(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0


def init_store(conn):
    conn.execute('''CREATE TABLE IF NOT EXISTS direct_limits (
        code TEXT PRIMARY KEY, amount REAL NOT NULL, as_of TEXT NOT NULL,
        source TEXT NOT NULL, source_url TEXT, updated_at TEXT NOT NULL
    )''')


def save_observations(conn, payload):
    """只保存有有效日期和明确数值的记录；同日以网站为准，AI 仅补缺。"""
    init_store(conn)
    written = 0
    with conn:
        for code, info in payload.get('funds', {}).items():
            if not isinstance(info, dict) or not re.fullmatch(r'\d{6}', str(code)):
                continue
            amount = info.get('direct_limit_amount')
            if amount is None:
                amount = info.get('announcement_limit_amount')
            as_of = info.get('direct_as_of') or payload.get('as_of')
            source = info.get('direct_source') or payload.get('source') or 'anxinletech.com'
            if not valid_amount(amount) or not valid_date(as_of):
                continue
            previous = conn.execute('SELECT as_of, source FROM direct_limits WHERE code = ?', (code,)).fetchone()
            if previous and (as_of < previous[0] or
                             (as_of == previous[0] and previous[1] == 'anxinletech.com' and source != previous[1])):
                continue
            conn.execute('''INSERT INTO direct_limits VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(code) DO UPDATE SET amount=excluded.amount, as_of=excluded.as_of,
                source=excluded.source, source_url=excluded.source_url, updated_at=excluded.updated_at''',
                (code, amount, as_of, source, info.get('direct_source_url') or payload.get('source_url'),
                 datetime.now().isoformat(timespec='seconds')))
            written += 1
    return written


def read_observations(conn):
    init_store(conn)
    return {code: {'direct_limit_amount': amount, 'direct_as_of': as_of,
                   'direct_source': source, 'direct_source_url': url}
            for code, amount, as_of, source, url in conn.execute(
                'SELECT code, amount, as_of, source, source_url FROM direct_limits')}


def apply_observations(records, observations, clear_missing=False):
    for record in records:
        saved = observations.get(record['code'])
        if saved:
            record.update(saved)
        elif clear_missing:
            record['direct_limit_amount'] = None


@contextmanager
def publication_lock(db_path):
    """扫描器和 AI 导入串行发布，避免 JSON 读改写覆盖并发结果。"""
    lock_path = Path(str(db_path) + '.publish.lock')
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open('a') as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def write_json(path, payload):
    path = Path(path)
    text = json.dumps(payload, ensure_ascii=False, allow_nan=False)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent,
                                     prefix=path.name + '.', suffix='.tmp', delete=False) as handle:
        temporary = Path(handle.name)
        handle.write(text)
    try:
        # NamedTemporaryFile 默认 0600；页面 JSON 需要允许 Web 服务读取。
        temporary.chmod(0o644)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
