"""Refresh the local market dashboard without touching fund scans or notifications.

Yahoo Finance chart data supplies the original indices (not CFD proxies).
Prices and daily history are unadjusted; ^TNX is reported as a yield in percent.
Run once, or use --watch to keep the local JSON refreshed every five minutes.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import fcntl
import json
import logging
import math
from pathlib import Path
import tempfile
import time
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

DEFAULT_OUT = Path(__file__).resolve().parent.parent / "public/qdii/market-dashboard.json"
INDICATORS = (
    ("dow", "^DJI", "points"),
    ("nasdaq", "^IXIC", "points"),
    ("sp500", "^GSPC", "points"),
    ("hangseng", "^HSI", "points"),
    ("ftse", "^FTSE", "points"),
    ("dax", "^GDAXI", "points"),
    ("nikkei", "^N225", "points"),
    ("cac", "^FCHI", "points"),
    ("gold", "GC=F", "usd-ounce"),
    ("silver", "SI=F", "usd-ounce"),
    ("copper", "HG=F", "usd-pound"),
    ("brent", "BZ=F", "usd-barrel"),
    ("vix", "^VIX", "points"),
    ("treasury", "^TNX", "percent"),
    ("dollar", "DX-Y.NYB", "points"),
    ("usdcny", "CNY=X", "rate"),
)
log = logging.getLogger("market-dashboard")


def finite_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def parse_indicator(payload, indicator, fetched_at):
    """Reject malformed responses; compare the quote to the preceding trading day.

    chartPreviousClose is the close before the *requested range*, not yesterday.
    Derive the daily baseline from exchange-local dates in the daily history.
    """
    indicator_id, symbol, unit = indicator
    chart = payload.get("chart", {})
    results = chart.get("result")
    if chart.get("error") or not isinstance(results, list) or not results:
        raise ValueError("Missing chart result")
    result = results[0]
    meta = result.get("meta", {})
    price, market_time = meta.get("regularMarketPrice"), meta.get("regularMarketTime")
    if meta.get("symbol") != symbol or not finite_number(price) or price <= 0:
        raise ValueError("Invalid quote or mismatched symbol")
    if not finite_number(market_time) or market_time <= 0:
        raise ValueError("Missing quote timestamp")
    exchange_zone = ZoneInfo(meta.get("exchangeTimezoneName", "UTC"))
    as_of = datetime.fromtimestamp(market_time, timezone.utc)
    if as_of > datetime.fromisoformat(fetched_at):
        raise ValueError("Quote timestamp is in the future")
    trading_date = as_of.astimezone(exchange_zone).date().isoformat()
    timestamps = result.get("timestamp", [])
    quotes = result.get("indicators", {}).get("quote", [])
    closes = quotes[0].get("close", []) if quotes else []
    daily = {}
    for timestamp, close in zip(timestamps, closes):
        if not finite_number(timestamp) or not finite_number(close) or close <= 0:
            continue
        day = datetime.fromtimestamp(timestamp, exchange_zone).date().isoformat()
        if day <= trading_date:
            daily[day] = round(close, 6)
    history = [{"date": day, "value": value} for day, value in sorted(daily.items())]
    previous = [point["value"] for point in history if point["date"] < trading_date]
    if len(history) < 2 or not previous:
        raise ValueError("Insufficient daily history")
    previous_close = previous[-1]
    change = price - previous_close
    return {
        "id": indicator_id, "symbol": symbol, "unit": unit,
        "source": "Yahoo Finance", "sourceUrl": "https://finance.yahoo.com/quote/" + quote(symbol, safe="") + "/",
        "value": round(price, 6), "previousClose": previous_close,
        "change": round(change, 6), "changePercent": round(change / previous_close * 100, 6),
        "asOf": as_of.isoformat(), "tradingDate": trading_date,
        "fetchedAt": fetched_at, "history": history, "stale": False,
    }


def fetch_indicator(indicator, fetched_at):
    symbol = indicator[1]
    query = urlencode({"interval": "1d", "range": "5y"})
    # The host and symbols are code constants; no user-provided URLs are accepted.
    url = "https://query1.finance.yahoo.com/v8/finance/chart/" + quote(symbol, safe="") + "?" + query
    for attempt in range(2):
        try:
            request = Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
            with urlopen(request, timeout=15) as response:
                if response.geturl().split("/")[2] != "query1.finance.yahoo.com":
                    raise ValueError("Unexpected response host")
                payload = json.loads(response.read(4_000_000))
            # Record the actual response time, since the upstream quote can advance during a request.
            return parse_indicator(payload, indicator, datetime.now(timezone.utc).isoformat())
        except Exception:
            if attempt == 1:
                raise
            time.sleep(1)


def refresh_snapshot(previous, fetcher=fetch_indicator):
    previous = previous if isinstance(previous, dict) else {}
    now = datetime.now(timezone.utc).isoformat()
    previous_items = previous.get("indicators", [])
    previous_items = previous_items if isinstance(previous_items, list) else []
    cached = {item["id"]: item for item in previous_items if isinstance(item, dict) and "id" in item}
    def load(indicator):
        try:
            return fetcher(indicator, now), True
        except Exception as error:
            # Log only the fixed indicator id and exception type, never request headers.
            log.warning("%s refresh failed (%s); retaining cache", indicator[0], type(error).__name__)
            compatible_cache = cached.get(indicator[0], {})
            if compatible_cache.get("symbol") != indicator[1]:
                compatible_cache = {}
            item = dict(compatible_cache or {"id": indicator[0], "symbol": indicator[1], "unit": indicator[2], "value": None, "history": []})
            if not finite_number(item.get("value")) or item["value"] <= 0:
                item.update(value=None, change=None, changePercent=None, history=[])
            item["stale"] = True
            return item, False
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(load, INDICATORS))
    succeeded = sum(success for _, success in results)
    if not succeeded and not any(finite_number(item.get("value")) for item, _ in results):
        raise RuntimeError("No valid market data available")
    return {
        "version": 1, "updatedAt": max(item["fetchedAt"] for item, success in results if success) if succeeded else previous.get("updatedAt"),
        "checkedAt": now, "refreshIntervalSeconds": 300,
        "historyRange": "5y", "indicators": [item for item, _ in results],
    }, succeeded


def write_snapshot(path, snapshot):
    text = json.dumps(snapshot, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, prefix=".market-dashboard-", suffix=".tmp", delete=False) as handle:
        temporary = Path(handle.name)
        try:
            handle.write(text)
            handle.flush()
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description="Local market dashboard quote refresh")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--watch", action="store_true")
    args = parser.parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.with_suffix(".json.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            log.error("Market refresh is already running for this output")
            return 1
        while True:
            try:
                try:
                    previous = json.loads(args.out.read_text()) if args.out.exists() else {}
                except (OSError, ValueError):
                    log.warning("Existing cache is unreadable; fetching a fresh snapshot")
                    previous = {}
                snapshot, succeeded = refresh_snapshot(previous)
                write_snapshot(args.out, snapshot)
                log.info("Refreshed %d/%d indicators: %s", succeeded, len(INDICATORS), args.out)
            except Exception as error:
                log.error("Refresh failed (%s); existing output preserved", type(error).__name__)
                if not args.watch:
                    return 1
            if not args.watch:
                return 0
            time.sleep(300)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        log.info("Market refresh stopped")
