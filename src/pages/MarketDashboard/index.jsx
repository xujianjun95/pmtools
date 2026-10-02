import { useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react'
import MarketTrendChart from './MarketTrendChart'
import MarketHelpButton, { MarketHelpProvider } from './MarketHelp'
import { historyForRange, normalizeMarketSnapshot } from './marketData'
import styles from './MarketDashboard.module.css'

/**
 * @typedef {Object} MarketIndicator
 * @property {string} id
 * @property {string} name
 * @property {string} caption
 * @property {string} symbol
 * @property {string} [unitLabel]
 */

/** @type {MarketIndicator[]} */
const INDICES = [
  { id: 'dow', name: '道琼斯工业指数', caption: 'DOW JONES', symbol: 'DJ:DJI' },
  { id: 'nasdaq', name: '纳斯达克综合', caption: 'NASDAQ COMPOSITE', symbol: 'NASDAQ:IXIC' },
  { id: 'sp500', name: '标普 500', caption: 'S&P 500', symbol: 'SP:SPX' },
  { id: 'hangseng', name: '恒生指数', caption: 'HANG SENG', symbol: 'HSI' },
  { id: 'ftse', name: '英国富时 100', caption: 'FTSE 100', symbol: 'FTSE' },
  { id: 'dax', name: '德国 DAX', caption: 'DAX', symbol: 'GDAXI' },
  { id: 'nikkei', name: '日经 225', caption: 'NIKKEI 225', symbol: 'N225' },
  { id: 'cac', name: '法国 CAC 40', caption: 'CAC 40', symbol: 'FCHI' },
]

/** @type {MarketIndicator[]} */
const ENVIRONMENT = [
  { id: 'vix', name: 'VIX 恐慌指数', caption: 'VOLATILITY', symbol: 'CBOE:VIX' },
  { id: 'treasury', name: '美国 10 年期国债收益率', caption: 'TREASURY YIELD', symbol: 'TVC:US10Y' },
  { id: 'dollar', name: '美元指数', caption: 'DOLLAR INDEX', symbol: 'TVC:DXY' },
  { id: 'usdcny', name: '美元兑人民币', caption: 'USD / CNY', symbol: 'FX_IDC:USDCNY' },
]

/** @type {MarketIndicator[]} */
const COMMODITIES = [
  { id: 'gold', name: 'COMEX 黄金期货', caption: 'GC · 期货连续报价', symbol: 'GC=F', unitLabel: '美元 / 盎司' },
  { id: 'silver', name: 'COMEX 白银期货', caption: 'SI · 期货连续报价', symbol: 'SI=F', unitLabel: '美元 / 盎司' },
  { id: 'copper', name: 'COMEX 铜期货', caption: 'HG · 期货连续报价', symbol: 'HG=F', unitLabel: '美元 / 磅' },
  { id: 'brent', name: '布伦特原油', caption: 'BRENT · 期货连续报价', symbol: 'BZ=F', unitLabel: '美元 / 桶' },
]

function readWidgetTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function subscribeToTheme(onChange) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}

function useWidgetTheme() {
  return useSyncExternalStore(subscribeToTheme, readWidgetTheme, () => 'light')
}

function useMarketSnapshot() {
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let disposed = false
    let controller = null
    let inFlight = false
    async function load() {
      if (inFlight) return
      inFlight = true
      controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 10000)
      try {
        const response = await fetch('/qdii/market-dashboard.json', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('Market data unavailable')
        const result = normalizeMarketSnapshot(await response.json())
        if (!disposed) { setSnapshot(result); setError(false) }
      } catch {
        if (!disposed) setError(true)
      } finally {
        window.clearTimeout(timeout)
        inFlight = false
        if (!disposed) setLoading(false)
      }
    }
    load()
    const timer = window.setInterval(() => { if (!document.hidden) load() }, 60000)
    return () => { disposed = true; controller?.abort(); window.clearInterval(timer) }
  }, [revision])
  const refresh = () => { setLoading(true); setRevision((value) => value + 1) }
  return { snapshot, error, loading, refresh }
}

function formatTime(value) {
  if (!value) return '暂无更新时间'
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}

/** @param {{history: import('./marketData').MarketHistoryPoint[], name: string}} props */
function Sparkline({ history, name }) {
  const gradientId = useId()
  if (history.length < 2) return null
  const recent = history.slice(-30)
  const values = recent.map((point) => point.value)
  const min = Math.min(...values)
  const span = Math.max(...values) - min || 1
  const points = values.map((value, i) => `${(4 + i / (values.length - 1) * 312).toFixed(1)},${(50 - (value - min) / span * 42).toFixed(1)}`).join(' ')
  const lastY = 50 - (values.at(-1) - min) / span * 42
  return <svg className={styles.sparkline} viewBox="0 0 320 64" preserveAspectRatio="none" role="img" aria-label={`${name}最近 30 个交易日走势`}>
    <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.18" /><stop offset="100%" stopColor="currentColor" stopOpacity="0.01" /></linearGradient></defs>
    <g className={styles.sparklineGrid} fill="none" stroke="currentColor" strokeWidth="0.5" vectorEffect="non-scaling-stroke">
      {[8, 28, 48, 63].map((y) => <line key={`h${y}`} x1="0" y1={y} x2="320" y2={y} />)}
      {[64, 128, 192, 256].map((x) => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="64" />)}
    </g>
    <polygon points={`4,64 ${points} 316,64`} fill={`url(#${gradientId})`} />
    <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    <line x1="316" y1={lastY} x2="316.01" y2={lastY} stroke="currentColor" strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
  </svg>
}

/** @param {{indicator: MarketIndicator, quote: import('./marketData').MarketQuote | undefined}} props */
function IndicatorCard({ indicator, quote }) {
  const isYield = indicator.id === 'treasury'
  const isForex = indicator.id === 'usdcny'
  const digits = isForex || indicator.id === 'copper' ? 4 : isYield ? 3 : 2
  const displayValue = quote?.value == null ? '——' : quote.value.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  const signed = (value, places = 2) => `${value > 0 ? '+' : ''}${value.toFixed(places)}`
  const delta = quote?.change == null ? '暂无涨跌数据' : isYield
    ? `${signed(quote.change * 100)} bp`
    : `${signed(quote.change, digits)}  (${signed(quote.changePercent ?? 0)}%)`
  const stale = quote?.stale
  return (
    <article className={styles.indicatorCard} aria-label={indicator.name}>
      <div className={styles.cardTitle}><h3>{indicator.name}</h3>{indicator.id === 'vix' && <MarketHelpButton topic="vix" />}</div>
      <p className={styles.caption}>{indicator.caption}</p>
      <p className={styles.quoteValue}>{displayValue}{isYield && quote?.value != null ? <span>%</span> : null}</p>
      <p className={`${styles.quoteChange} ${quote?.change > 0 ? styles.rising : quote?.change < 0 ? styles.falling : ''}`}>{delta}</p>
      {quote?.history?.length > 1 ? <Sparkline history={quote.history} name={indicator.name} /> : <p className={styles.historyUnavailable}>暂无日线数据</p>}
      <p className={styles.quoteTime}>{indicator.unitLabel && <>{indicator.unitLabel} · </>}行情 {quote?.asOfDate || formatTime(quote?.asOf)}{stale ? <span className={styles.stale}> · 更新延迟</span> : null}</p>
    </article>
  )
}

export default function MarketDashboardPage() {
  const theme = useWidgetTheme()
  const { snapshot, error, loading, refresh } = useMarketSnapshot()
  const [selectedIndex, setSelectedIndex] = useState('sp500')
  const [range, setRange] = useState('3m')
  const indicator = INDICES.find((item) => item.id === selectedIndex) || INDICES[2]
  const quotes = new Map(snapshot?.indicators.map((item) => [item.id, item]) || [])
  const quote = quotes.get(selectedIndex)
  const history = useMemo(() => historyForRange(quote?.history || [], range), [quote?.history, range])
  return (
    <MarketHelpProvider><div className={styles.page}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>MARKET DASHBOARD</p>
        <h1>市场看板</h1>
        <p className={styles.description}>全球指数 · 大宗商品 · 市场波动 · 利率与汇率</p>
      </header>
      {error && <div className={styles.dataError} role="status"><span>{snapshot ? '行情更新暂时失败，正在显示最近成功的数据。' : '行情数据暂时不可用，请稍后重试。'}</span><button type="button" disabled={loading} onClick={refresh}>{loading ? '加载中…' : '重新加载'}</button></div>}
      <section className={styles.section} aria-labelledby="market-indices-title">
        <div className={styles.sectionHeading}>
          <div className={styles.sectionTitle}><h2 id="market-indices-title">主要指数</h2><MarketHelpButton topic="indices" /></div>
          <span>{loading && !snapshot ? '正在加载行情…' : `Yahoo Finance · 更新 ${formatTime(snapshot?.updatedAt)}（北京时间）`}</span>
        </div>
        <div className={styles.indicatorGrid}>{INDICES.map((item) => <IndicatorCard key={item.id} indicator={item} quote={quotes.get(item.id)} />)}</div>
      </section>
      <section className={styles.section} aria-labelledby="market-environment-title">
        <div className={styles.sectionHeading}><div className={styles.sectionTitle}><h2 id="market-environment-title">风险与资金环境</h2><MarketHelpButton topic="environment" /></div></div>
        <div className={styles.indicatorGrid}>{ENVIRONMENT.map((item) => <IndicatorCard key={item.id} indicator={item} quote={quotes.get(item.id)} />)}</div>
      </section>
      <section className={styles.section} aria-labelledby="market-commodities-title">
        <div className={styles.sectionHeading}><h2 id="market-commodities-title">大宗商品</h2><span>Yahoo Finance</span></div>
        <div className={styles.indicatorGrid}>{COMMODITIES.map((item) => <IndicatorCard key={item.id} indicator={item} quote={quotes.get(item.id)} />)}</div>
      </section>
      <section className={styles.section} aria-labelledby="market-trend-title">
        <div className={styles.sectionHeading}><h2 id="market-trend-title">趋势观察</h2></div>
        <div className={styles.trendSection}>
        <div className={styles.trendHeading}>
          <div className={styles.indexButtons} aria-label="趋势指数选择">
            {INDICES.map((item) => <button key={item.id} type="button" aria-pressed={selectedIndex === item.id} onClick={() => setSelectedIndex(item.id)}>{item.name}</button>)}
          </div>
          <div className={styles.rangeButtons} aria-label="趋势时间范围">
            {[['1m', '1 月'], ['3m', '3 月'], ['12m', '1 年'], ['all', '全部']].map(([value, label]) => (
              <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)}>{label}</button>
            ))}
          </div>
        </div>
        <div className={styles.trendWidget}>
          {history.length > 1
            ? <MarketTrendChart key={`${selectedIndex}:${range}:${theme}`} history={history} name={indicator.name} theme={theme} />
            : <p className={styles.emptyState}>{loading ? '正在加载趋势…' : '暂无可用历史数据'}</p>}
        </div>
        <div className={styles.trendAttribution}><span>Yahoo Finance · 日线点位，最新交易日可能尚未收盘{range === 'all' ? ' · 最近 5 年可用历史' : ''}</span>{quote?.sourceUrl && <a href={quote.sourceUrl} target="_blank" rel="noopener noreferrer">查看数据来源 ↗</a>}</div>
        </div>
      </section>
      <dl className={styles.dataNote} aria-label="行情数据说明">
        <div><dt>数据来源</dt><dd>指数、利率、汇率与商品期货均来自 Yahoo Finance。</dd></div>
        <div><dt>报价口径</dt><dd>金银铜为 COMEX 期货连续报价，非现货；跨合约走势可能受换月影响。</dd></div>
        <div><dt>时间与涨跌</dt><dd>全部时间为北京时间。行情可能延迟，行情时间不等于缓存更新时间；涨跌相对前一交易日收盘。</dd></div>
        <div><dt>单位说明</dt><dd>美债收益率以 % 展示，变动以基点（bp）展示。</dd></div>
      </dl>
    </div></MarketHelpProvider>
  )
}
