# -*- coding: utf-8 -*-
"""
定投模拟历史数据抓取 — 月频

来源（国内 cron 可达，实测）：
- 纳指100：QQQ 复权月线（东财 105.QQQ klt=103，2001-01 起，含真实分红再投资，
  跟踪误差 <0.2%/年，代理纳指100总回报）
- 标普500：东财 100.SPX 月线（价格指数，1986 起）+ 1.35%/年股息近似总回报
- USDCNYC 美元人民币中间价：ak.forex_hist_em（东财，2005-07 起）；
  2005-07 前人民币盯住美元按 8.27 补齐（2000-2005 固定汇率 regime，事实值）
- H00922 中证红利全收益指数：ak.stock_zh_index_hist_csindex（含分红，2005 起）
- 000012 上证国债指数：ak.stock_zh_index_hist_csindex（含票息，2003 起）
- 1年定存基准：脚本内硬编码历史表（模拟工具精度，页面会标注近似）

对齐方式：全部按自然月（Period M）对齐，取每月最后一个有数据的收盘。
人民币口径：(1 + 美元总回报) × (1 + 汇率变化) - 1。
指数级模拟，不代表任何单只QDII基金，不构成投资建议。

输出：public/qdii/simulation-data.json（原子替换）
用法：python3 fetch_simulation.py --out ../public/qdii/simulation-data.json
"""
import argparse
import json
import logging
import time
from datetime import date
from pathlib import Path

import akshare as ak
import pandas as pd
import requests

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_OUT = BASE_DIR.parent / "public" / "qdii" / "simulation-data.json"

SPX_DIV_ANNUAL = 0.0135
FX_PEG_PRE2005 = 8.27
UA = {"User-Agent": "Mozilla/5.0"}

# 1年定存基准历史（生效月 -> 年利率 %），模拟精度
DEPOSIT_STEPS = [
    ("2000-01", 2.25), ("2002-02", 1.98), ("2004-10", 2.25),
    ("2006-08", 2.52), ("2007-03", 2.79), ("2007-05", 3.06),
    ("2007-07", 3.33), ("2007-08", 3.60), ("2007-09", 3.87),
    ("2007-12", 4.14), ("2008-10", 3.87), ("2008-11", 2.52),
    ("2008-12", 2.25), ("2010-10", 2.50), ("2010-12", 2.75),
    ("2011-02", 3.00), ("2011-04", 3.25), ("2011-07", 3.50),
    ("2012-06", 3.25), ("2012-07", 3.00), ("2014-11", 2.75),
    ("2015-03", 2.50), ("2015-05", 2.25), ("2015-06", 2.00),
    ("2015-08", 1.75), ("2015-10", 1.50), ("2024-07", 1.35),
]

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("fetch-sim")


def with_retry(fn, what, tries=5, wait=25):
    last = None
    for i in range(1, tries + 1):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001
            last = e
            log.warning("%s 第 %d/%d 次失败: %s", what, i, tries, str(e)[:200])
            if i < tries:
                time.sleep(wait)
    raise RuntimeError(f"{what}失败，已重试{tries}次: {last}")


def eastmoney_monthly(secid, what):
    """东财月K直连，返回以 Period(M) 为索引的月末收盘序列。"""
    def _fetch():
        url = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
        params = {
            "secid": secid, "klt": "103", "fqt": "1", "lmt": "500",
            "end": "20500000",
            "fields1": "f1,f2,f3,f4,f5", "fields2": "f51,f52,f53,f54,f55,f56,f57",
        }
        r = requests.get(url, params=params, headers=UA, timeout=30)
        r.raise_for_status()
        data = r.json()["data"]
        if not data or not data.get("klines"):
            raise RuntimeError(f"{what} 返回空")
        dates, closes = [], []
        for line in data["klines"]:
            parts = line.split(",")
            dates.append(pd.to_datetime(parts[0]))
            closes.append(float(parts[2]))
        s = pd.Series(closes, index=pd.DatetimeIndex(dates)).sort_index()
        monthly = s.groupby(s.index.to_period("M")).tail(1)
        monthly.index = pd.PeriodIndex(monthly.index, freq="M")
        return monthly

    return with_retry(_fetch, what)


def ak_monthly(fetch_fn, col, what):
    def _fetch():
        df = fetch_fn()
        dcol = "日期" if "日期" in df.columns else "date"
        vcol = col
        df[dcol] = pd.to_datetime(df[dcol])
        df = df.sort_values(dcol)
        s = pd.Series(
            pd.to_numeric(df[vcol], errors="coerce").to_numpy(),
            index=pd.DatetimeIndex(df[dcol]),
        ).sort_index()
        monthly = s.groupby(s.index.to_period("M")).tail(1)
        monthly.index = pd.PeriodIndex(monthly.index, freq="M")
        if len(monthly) < 12:
            raise RuntimeError(f"{what} 数据过少: {len(monthly)}")
        return monthly.astype(float)

    return with_retry(_fetch, what)


def deposit_for(ym_str):
    cur = DEPOSIT_STEPS[0][1]
    for eff, rate in sorted(DEPOSIT_STEPS):
        if eff <= ym_str:
            cur = rate
        else:
            break
    return cur


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    log.info("抓取 QQQ（纳指100代理）月线 ...")
    ndx = eastmoney_monthly("105.QQQ", "QQQ月线")
    log.info("QQQ %d 月 %s~%s", len(ndx), ndx.index[0], ndx.index[-1])
    time.sleep(10)

    log.info("抓取 SPX（标普500）月线 ...")
    spx = eastmoney_monthly("100.SPX", "SPX月线")
    log.info("SPX %d 月 %s~%s", len(spx), spx.index[0], spx.index[-1])
    time.sleep(5)

    log.info("抓取 USDCNYC ...")
    try:
        fx = ak_monthly(lambda: ak.forex_hist_em(symbol="USDCNYC"), "最新价", "USDCNYC")
    except RuntimeError:
        log.warning("改用 USDCNH 离岸价兜底")
        fx = ak_monthly(lambda: ak.forex_hist_em(symbol="USDCNH"), "最新价", "USDCNH")
    log.info("FX %d 月 %s~%s", len(fx), fx.index[0], fx.index[-1])

    log.info("抓取 H00922 / 000012 ...")
    try:
        div = ak_monthly(
            lambda: ak.stock_zh_index_hist_csindex(
                symbol="H00922", start_date="19990101", end_date="20990101"),
            "收盘", "H00922")
    except RuntimeError as e:
        log.warning("H00922 失败: %s", e)
        div = pd.Series(dtype=float)
    try:
        bond = ak_monthly(
            lambda: ak.stock_zh_index_hist_csindex(
                symbol="000012", start_date="19990101", end_date="20990101"),
            "收盘", "000012")
    except RuntimeError as e:
        log.warning("000012 失败: %s", e)
        bond = pd.Series(dtype=float)
    log.info("DIV %d 月, BOND %d 月", len(div), len(bond))

    start = pd.Period("2000-01", freq="M")
    end = min(ndx.index[-1], spx.index[-1])
    # 去掉当前未走完的自然月
    cur_month = pd.Period(date.today().strftime("%Y-%m"), freq="M")
    if end >= cur_month:
        end = cur_month - 1
    idx = pd.period_range(start, end, freq="M")

    fx_full = pd.Series(FX_PEG_PRE2005, index=idx)
    fx_full.update(fx.reindex(idx).dropna())

    frame = pd.DataFrame({
        "ndx": ndx.reindex(idx),
        "spx": spx.reindex(idx),
        "fx": fx_full,
        "div": div.reindex(idx) if len(div) else None,
        "bond": bond.reindex(idx) if len(bond) else None,
    }, index=idx)
    frame["deposit_annual"] = [deposit_for(str(p)) for p in idx]

    def _num(v):
        return round(float(v), 2) if pd.notna(v) else None

    monthly = [
        {
            "date": p.to_timestamp(how="E").strftime("%Y-%m-%d"),
            "ym": str(p),
            "ndx": _num(r["ndx"]),
            "spx": _num(r["spx"]),
            "fx": round(float(r["fx"]), 4),
            "div": _num(r["div"]),
            "bond": _num(r["bond"]),
            "deposit_annual": float(r["deposit_annual"]),
        }
        for p, r in frame.iterrows()
    ]
    payload = {
        "updated_at": date.today().isoformat(),
        "method": "纳指100以QQQ复权月线代理总回报（含真实分红，跟踪误差<0.2%/年）；"
                  "标普500以东财100.SPX价格月线+1.35%/年股息近似总回报；"
                  "人民币口径=(1+美元总回报)×(1+USDCNYC中间价变化)-1"
                  "（2005-07前汇率按8.27盯住补齐）；红利=H00922全收益，"
                  "国债=000012，存款=1年定存基准近似。"
                  "指数级模拟，不代表任何单只QDII基金，不构成投资建议。",
        "sources": {
            "ndx": "105.QQQ qfq monthly via Eastmoney push2his (proxy for Nasdaq-100 TR)",
            "spx": "100.SPX monthly via Eastmoney push2his (price) + 1.35%/yr dividend",
            "fx": "USDCNYC via akshare forex_hist_em, pre-2005-07 pegged at 8.27",
            "div": "H00922 中证红利全收益 via akshare stock_zh_index_hist_csindex",
            "bond": "000012 上证国债指数 via akshare stock_zh_index_hist_csindex",
            "deposit": "1年定存基准历史硬编码（模拟精度）",
        },
        "dividend_assumption": {"ndx_annual": None, "spx_annual": SPX_DIV_ANNUAL},
        "start": monthly[0]["ym"],
        "end": monthly[-1]["ym"],
        "monthly": monthly,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    tmp = args.out.with_suffix(".tmp")
    # allow_nan=False：NaN 直接抛错，避免写出 JS 解析不了的文件
    tmp.write_text(json.dumps(payload, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    tmp.replace(args.out)
    log.info("已导出 %s，共 %d 月（%s ~ %s）", args.out, len(monthly), monthly[0]["ym"], monthly[-1]["ym"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
