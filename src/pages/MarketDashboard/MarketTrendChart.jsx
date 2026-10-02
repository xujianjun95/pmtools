// TradingView Lightweight Charts™
// Copyright (с) 2025 TradingView, Inc. https://www.tradingview.com/
import { useEffect, useRef, useState } from 'react'
import styles from './MarketDashboard.module.css'

const formatPrice = (value) => value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** @param {{history: import('./marketData').MarketHistoryPoint[], name: string, theme: 'light'|'dark'}} props */
export default function MarketTrendChart({ history, name, theme }) {
  const containerRef = useRef(null)
  const [failed, setFailed] = useState(false)
  const latest = history.at(-1)
  useEffect(() => {
    let chart = null
    let disposed = false
    async function initialize() {
      try {
        const { createChart, AreaSeries, ColorType, CrosshairMode } = await import('lightweight-charts')
        if (disposed || !containerRef.current) return
        const css = getComputedStyle(containerRef.current)
        const accent = css.getPropertyValue('--accent').trim()
        const border = css.getPropertyValue('--border-subtle').trim()
        const muted = css.getPropertyValue('--text-muted').trim()
        chart = createChart(containerRef.current, {
          autoSize: true,
          layout: { background: { type: ColorType.Solid, color: css.getPropertyValue('--surface').trim() }, textColor: muted, fontSize: 11, attributionLogo: true },
          grid: { vertLines: { color: border }, horzLines: { color: border } },
          rightPriceScale: { borderColor: border, scaleMargins: { top: 0.12, bottom: 0.12 } },
          timeScale: { borderColor: border, rightOffset: 0, fixLeftEdge: true, fixRightEdge: true, timeVisible: false },
          crosshair: { mode: CrosshairMode.Normal, vertLine: { color: muted, labelBackgroundColor: accent }, horzLine: { color: muted, labelBackgroundColor: accent } },
          localization: { locale: 'zh-CN', dateFormat: 'yyyy-MM-dd', priceFormatter: formatPrice },
          handleScroll: { vertTouchDrag: false },
        })
        const series = chart.addSeries(AreaSeries, {
          lineColor: accent, lineWidth: 2,
          topColor: theme === 'dark' ? 'rgba(196, 160, 112, 0.22)' : 'rgba(122, 96, 64, 0.14)',
          bottomColor: 'rgba(122, 96, 64, 0)',
          priceLineVisible: true, lastValueVisible: true,
          priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
        })
        series.setData(history.map((point) => ({ time: point.date, value: point.value })))
        chart.timeScale().fitContent()
      } catch {
        if (!disposed) setFailed(true)
      }
    }
    initialize()
    return () => {
      disposed = true
      chart?.remove()
    }
  }, [history, theme])
  if (failed) return <p className={styles.emptyState} role="status">趋势图暂时无法加载，请刷新重试。</p>
  return <div className={styles.chartShell}>
    <div ref={containerRef} className={styles.chart} role="img" aria-label={`${name}历史指数点位，${history[0]?.date} 至 ${latest?.date}，${history.length} 个交易日`} />
  </div>
}
