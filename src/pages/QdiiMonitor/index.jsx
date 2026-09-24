import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import HeroSection from './components/HeroSection'
import RecentChanges from './components/RecentChanges'
import Disclaimer from './components/Disclaimer'
import FilterBar from './components/FilterBar'
import FundTable from './components/FundTable'
import { statusLabel } from './utils'
import { CROSS_MARKET, OTHER_MARKET_COUNTRIES } from './worldFunds'
import styles from './QdiiMonitor.module.css'

const STATUS_ORDER = ['开放申购', '限大额', '暂停申购']
const OTHER_MARKET_FUNDS = [
  ...OTHER_MARKET_COUNTRIES.flatMap((country) => country.funds),
  ...CROSS_MARKET.funds,
]

const DEV_RECENT_CHANGES = [
  {
    code: '000834',
    name: '大成纳斯达克100ETF联接(QDII)A',
    field: 'direct_limit_amount',
    old_val: 100,
    new_val: 200,
    region: '美国',
  },
]

// 「鉴往」旅程总结会通过 /qdii?index=nasdaq100|sp500 跳转回来；
// 非法值一律回落为 all，不修改监控数据接口与基金字段。
const VALID_INDEX_KEYS = new Set(['nasdaq100', 'sp500'])

function QdiiMonitorPage() {
  const [searchParams] = useSearchParams()
  const requestedIndex = searchParams.get('index')
  const [data, setData] = useState(null)
  const [worldLiveFunds, setWorldLiveFunds] = useState([])
  const [error, setError] = useState(null)
  const [indexKey, setIndexKey] = useState(
    VALID_INDEX_KEYS.has(requestedIndex) ? requestedIndex : 'all',
  )
  const [status, setStatus] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [filterVersion, setFilterVersion] = useState(0)

  useEffect(() => {
    fetch('/qdii/data.json', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((json) => {
        const usFundCodes = new Set(json.funds.map((fund) => fund.code))
        const recentChanges = json.recent_changes.map((change) => ({
          ...change,
          region: change.region || (usFundCodes.has(change.code) ? '美国' : undefined),
        }))
        setData({
          ...json,
          recent_changes:
            import.meta.env.DEV && recentChanges.length === 0
              ? DEV_RECENT_CHANGES.map((change) => ({
                  ...change,
                  date: json.updated_at,
                }))
              : recentChanges,
          // 去掉无有效限额的份额（美元现汇/封闭期等）与美元现汇/现钞份额，只看人民币可买
          funds: json.funds.filter((f) => {
            if (/美元|美汇|美钞|现汇|现钞/.test(f.name)) return false
            return (
              String(f.status).includes('暂停') ||
              Number(f.limit_amount) > 0 ||
              Number(f.direct_limit_amount) > 0
            )
          }),
        })
      })
      .catch((err) => setError(String(err)))
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/qdii/worldpage-data.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then((json) => {
        if (!cancelled && Array.isArray(json.funds)) setWorldLiveFunds(json.funds)
      })
      .catch(() => {}) // 与其他市场页面一致：扫描文件不可用时使用静态快照
    return () => { cancelled = true }
  }, [])

  const metaLine = useMemo(() => {
    if (error) return '数据加载失败'
    if (!data) return '数据加载中…'
    return `数据日期 ${data.updated_at} · 每日扫描`
  }, [data, error])

  const stats = useMemo(() => {
    if (!data) return []
    const fundsByCode = new Map(data.funds.map((fund) => [fund.code, fund]))
    const worldLiveByCode = new Map(worldLiveFunds.map((fund) => [fund.code, fund]))
    for (const fund of OTHER_MARKET_FUNDS) {
      if (fundsByCode.has(fund.code)) continue
      fundsByCode.set(fund.code, {
        ...fund,
        status: worldLiveByCode.get(fund.code)?.status || fund.status,
      })
    }
    const monitoredFunds = [...fundsByCode.values()]
    const count = (s) => monitoredFunds.filter((fund) => fund.status === s).length
    return [
      { cls: 'all', num: monitoredFunds.length, label: '监控基金' },
      { cls: 'open', num: count('开放申购'), label: '开放申购' },
      { cls: 'limited', num: count('限大额'), label: statusLabel('限大额') },
      { cls: 'suspended', num: count('暂停申购'), label: '暂停申购' },
    ]
  }, [data, worldLiveFunds])

  const indexOptions = useMemo(() => {
    if (!data) return []
    const opts = [{ key: 'all', label: '全部', count: data.funds.length }]
    for (const [key, label] of Object.entries(data.rules)) {
      opts.push({
        key,
        label,
        count: data.funds.filter((f) => f.index_key === key).length,
      })
    }
    return opts
  }, [data])

  const statusOptions = useMemo(() => {
    if (!data) return []
    const counts = {}
    for (const f of data.funds) counts[f.status] = (counts[f.status] || 0) + 1
    const keys = [
      ...STATUS_ORDER,
      ...Object.keys(counts).filter((s) => !STATUS_ORDER.includes(s)),
    ]
    return [
      { key: 'all', label: '全部', count: data.funds.length },
      ...keys.map((s) => ({ key: s, label: statusLabel(s), count: counts[s] })),
    ]
  }, [data])

  const filteredFunds = useMemo(() => {
    if (!data) return []
    const kw = keyword.trim().toLowerCase()
    return data.funds.filter((f) => {
      if (indexKey !== 'all' && f.index_key !== indexKey) return false
      if (status !== 'all' && f.status !== status) return false
      if (kw && !f.code.includes(kw) && !f.name.toLowerCase().includes(kw)) return false
      return true
    })
  }, [data, indexKey, status, keyword])

  return (
    <div className={styles.page}>
      <HeroSection metaLine={metaLine} stats={stats} />

      {error && (
        <div className={styles.errorBox}>
          <strong>无法加载监控数据</strong>
          <br />
          {error}
          <br />
          请先运行 <code>python3 scanner.py --out public/qdii/data.json</code> 生成数据，或刷新重试。
        </div>
      )}

      {data && (
        <>
          <RecentChanges changes={data.recent_changes.slice(0, 30)} />

          <section id="us-funds" className={`${styles.section} fi d8`}>
            <div className={styles.titleRow}>
              <h2 className="section-title">美国</h2>
            </div>
            <FilterBar
              indexOptions={indexOptions}
              statusOptions={statusOptions}
              indexKey={indexKey}
              status={status}
              onIndexChange={(k) => {
                setIndexKey(k)
                setFilterVersion((v) => v + 1)
              }}
              onStatusChange={(s) => {
                setStatus(s)
                setFilterVersion((v) => v + 1)
              }}
              trailing={
                <input
                  className={styles.search}
                  type="search"
                  placeholder="搜索代码 / 名称…"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              }
            />
            <FundTable
              funds={filteredFunds}
              filterVersion={filterVersion}
            />
          </section>
          <Disclaimer />
        </>
      )}
    </div>
  )
}

export default QdiiMonitorPage
