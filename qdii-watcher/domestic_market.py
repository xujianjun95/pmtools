"""Domestic quote adapters; cached history is retained with its original attribution."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, date, timedelta
import json
import logging
import re
import time
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from fetch_market_dashboard import INDICATORS, finite_number

log = logging.getLogger('market-dashboard')
CANONICAL = {item[0]: item for item in INDICATORS}
EASTMONEY = {
    'dow': ('100.DJIA', '道琼斯'), 'nasdaq': ('100.NDX', '纳斯达克'),
    'sp500': ('100.SPX', '标普500'), 'hangseng': ('100.HSI', '恒生'),
    'ftse': ('100.FTSE', '富时100'), 'dax': ('100.GDAXI', 'DAX'),
    'nikkei': ('100.N225', '日经225'), 'cac': ('100.FCHI', 'CAC40'),
    'vix': ('167.VIX', 'VIX'), 'treasury': ('171.US10Y', '10年'),
    'dollar': ('100.UDI', '美元指数'), 'gold': ('101.GC00Y', '黄金'),
    'silver': ('101.SI00Y', '白银'), 'copper': ('101.HG00Y', '铜'),
    'brent': ('112.B00Y', '布伦特'),
}
SINA = {'gold': 'hf_GC', 'silver': 'hf_SI', 'copper': 'hf_HG', 'brent': 'hf_OIL', 'usdcny': 'USDCNY', 'dollar': 'DINIW', 'dow': 'gb_$dji', 'nasdaq': 'gb_$ixic', 'sp500': 'gb_$inx', 'hangseng': 'rt_hkHSI', 'ftse': 'znb_UKX', 'dax': 'znb_DAX', 'nikkei': 'znb_NKY', 'cac': 'znb_CAC', 'vix': 'znb_VIX'}
COMMODITIES = {'gold', 'silver', 'copper', 'brent'}


def positive(value):
    if not finite_number(value) or value <= 0:
        raise ValueError('Invalid quote number')
    return value


def validate_time(value, fetched_at):
    fetched = datetime.fromisoformat(fetched_at)
    if value.tzinfo is None or value.timestamp() <= 0 or (value - fetched).total_seconds() > 60:
        raise ValueError('Invalid quote timestamp')
    return value.astimezone(timezone.utc).isoformat()


def quote_record(indicator_id, value, baseline, as_of, fetched_at, source, source_url):
    _, symbol, unit = CANONICAL[indicator_id]
    value, baseline = positive(value), positive(baseline)
    change = value - baseline
    record = {
        'id': indicator_id, 'symbol': symbol, 'unit': unit,
        'source': source, 'sourceUrl': source_url,
        'value': round(value, 6), 'change': round(change, 6),
        'changePercent': round(change / baseline * 100, 6),
        'asOf': validate_time(as_of, fetched_at), 'fetchedAt': fetched_at,
        'history': [], 'stale': False,
        'changeBasis': 'settlement' if indicator_id in COMMODITIES else 'close',
    }
    record['previousSettlement' if indicator_id in COMMODITIES else 'previousClose'] = baseline
    return record


def parse_eastmoney_quote(payload, indicator_id, fetched_at):
    data = payload.get('data') if isinstance(payload, dict) else None
    secid, name = EASTMONEY[indicator_id]
    market, code = secid.split('.')
    if not isinstance(data, dict) or data.get('f57') != code or data.get('f107') != int(market) or name not in str(data.get('f58', '')):
        raise ValueError('Mismatched Eastmoney instrument')
    timestamp = positive(data.get('f86'))
    return quote_record(indicator_id, data.get('f43'), data.get('f60'), datetime.fromtimestamp(timestamp, timezone.utc), fetched_at, '东方财富', f'https://quote.eastmoney.com/q/{secid}.html')


def parse_sina_quote(text, indicator_id, fetched_at):
    symbol = SINA[indicator_id]
    match = re.search(r'var\s+hq_str_' + re.escape(symbol) + r'="([^"]*)";', text)
    if not match or not match.group(1):
        raise ValueError('Missing Sina quote')
    fields = match.group(1).split(',')
    if indicator_id in ('usdcny', 'dollar'):
        expected = '美元人民币' if indicator_id == 'usdcny' else '美元指数'
        if len(fields) < 11 or expected not in fields[9]:
            raise ValueError('Mismatched onshore USD/CNY')
        value, baseline, day, clock = float(fields[8]), float(fields[3]), fields[10], fields[0]
        source_url = f'https://finance.sina.com.cn/money/forex/hq/{symbol}.shtml'
    elif symbol.startswith('znb_'):
        if len(fields) < 12 or EASTMONEY[indicator_id][1] not in fields[0]:
            raise ValueError('Mismatched global index')
        value, baseline, day, clock = float(fields[1]), float(fields[9]), fields[6], fields[7]
        source_url = 'https://finance.sina.com.cn/stock/globalindex/quotes/' + symbol[4:]
    elif indicator_id == 'hangseng':
        if len(fields) < 19 or fields[0] != 'HSI' or '恒生' not in fields[1]:
            raise ValueError('Mismatched Hong Kong index')
        value, baseline, day, clock = float(fields[6]), float(fields[3]), fields[17].replace('/', '-'), fields[18]
        source_url = 'https://stock.finance.sina.com.cn/hkstock/quotes/HSI.html'
    elif symbol.startswith('gb_'):
        if len(fields) < 30 or EASTMONEY[indicator_id][1] not in fields[0]:
            raise ValueError('Mismatched US index')
        value, baseline = float(fields[1]), float(fields[26])
        match = re.fullmatch(r'([A-Za-z]{3})\s+(\d{1,2})\s+(\d{1,2}):(\d{2})(AM|PM)\s+(EDT|EST)', fields[25])
        if not match or not re.fullmatch(r'\d{4}', fields[29]):
            raise ValueError('Missing US exchange quote time')
        month_name, day_number, hour, minute, period, offset = match.groups()
        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        hour = int(hour) % 12 + (12 if period == 'PM' else 0)
        as_of = datetime(int(fields[29]), months.index(month_name) + 1, int(day_number), hour, int(minute), tzinfo=timezone(timedelta(hours=-4 if offset == 'EDT' else -5)))
        source_url = 'https://stock.finance.sina.com.cn/usstock/quotes/.' + symbol[4:].upper() + '.html'
        return quote_record(indicator_id, value, baseline, as_of, fetched_at, '新浪财经', source_url)
    else:
        if len(fields) < 14:
            raise ValueError('Incomplete futures quote')
        expected = {'gold': '黄金', 'silver': '白银', 'copper': '铜', 'brent': '布伦特'}[indicator_id]
        if expected not in fields[13]:
            raise ValueError('Mismatched futures quote')
        divisor = 100 if indicator_id == 'copper' else 1
        value, baseline, day, clock = float(fields[0]) / divisor, float(fields[7]) / divisor, fields[12], fields[6]
        source_url = 'https://finance.sina.com.cn/money/future/hf.html'
    as_of = datetime.fromisoformat(f'{day}T{clock}').replace(tzinfo=ZoneInfo('Asia/Shanghai'))
    return quote_record(indicator_id, value, baseline, as_of, fetched_at, '新浪财经', source_url)


def read_url(url, host, referer):
    for attempt in range(2):
        try:
            request = Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': referer, 'Accept': '*/*'})
            with urlopen(request, timeout=8) as response:
                if urlsplit(response.geturl()).hostname != host:
                    raise ValueError('Unexpected response host')
                return response.read(100_000)
        except Exception:
            if attempt:
                raise
            time.sleep(1)


def fetch_domestic_quote(indicator_id, fetched_at):
    if indicator_id in SINA:
        try:
            raw = read_url('https://hq.sinajs.cn/?list=' + SINA[indicator_id], 'hq.sinajs.cn', 'https://finance.sina.com.cn/')
            return parse_sina_quote(raw.decode('gb18030'), indicator_id, datetime.now(timezone.utc).isoformat())
        except Exception:
            if indicator_id not in EASTMONEY:
                raise
    if indicator_id in EASTMONEY:
        params = {'secid': EASTMONEY[indicator_id][0], 'invt': '2', 'fltt': '2', 'fields': 'f43,f57,f58,f59,f60,f86,f107'}
        raw = read_url('https://push2.eastmoney.com/api/qt/stock/get?' + urlencode(params), 'push2.eastmoney.com', 'https://quote.eastmoney.com/')
        return parse_eastmoney_quote(json.loads(raw), indicator_id, datetime.now(timezone.utc).isoformat())
    raise ValueError('Unsupported market indicator')


def cached_history(item):
    points = {}
    for point in item.get('history', []) if isinstance(item.get('history'), list) else []:
        if not isinstance(point, dict) or not isinstance(point.get('date'), str) or not finite_number(point.get('value')) or point['value'] <= 0:
            continue
        try:
            if date.fromisoformat(point['date']).isoformat() != point['date']:
                continue
        except ValueError:
            continue
        points[point['date']] = {'date': point['date'], 'value': point['value']}
    return [points[key] for key in sorted(points)]


def refresh_domestic_snapshot(previous, fetcher=fetch_domestic_quote):
    previous = previous if isinstance(previous, dict) else {}
    items = previous.get('indicators', [])
    cached = {item['id']: item for item in items if isinstance(item, dict) and isinstance(item.get('id'), str)} if isinstance(items, list) else {}
    now = datetime.now(timezone.utc).isoformat()
    def load(indicator):
        indicator_id, symbol, unit = indicator
        old = cached.get(indicator_id, {})
        if old.get('symbol') != symbol:
            old = {}
        try:
            item = fetcher(indicator_id, now)
            history = cached_history(old)
            item = {**item, 'history': history, 'historySource': old.get('historySource') or old.get('source') or None, 'historyAsOf': history[-1]['date'] if history else None}
            return item, True
        except Exception as error:
            log.warning('%s refresh failed (%s); retaining cache', indicator_id, type(error).__name__)
            item = dict(old or {'id': indicator_id, 'symbol': symbol, 'unit': unit, 'value': None, 'history': []})
            if not finite_number(item.get('value')) or item['value'] <= 0:
                item.update(value=None, change=None, changePercent=None, history=[])
            item['stale'] = True
            return item, False
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(load, INDICATORS))
    succeeded = sum(success for _, success in results)
    if not succeeded:
        raise RuntimeError('No fresh domestic quotes; existing output preserved')
    return {'version': 1, 'source': 'domestic', 'updatedAt': max(item['fetchedAt'] for item, success in results if success), 'checkedAt': now, 'refreshIntervalSeconds': 300, 'historyRange': previous.get('historyRange', 'cached'), 'indicators': [item for item, _ in results]}, succeeded
