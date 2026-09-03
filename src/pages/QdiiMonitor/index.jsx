import { useEffect, useMemo, useState } from 'react'
import HeroSection from './components/HeroSection'
import RecentChanges from './components/RecentChanges'
import FilterBar from './components/FilterBar'
import FundTable from './components/FundTable'
import { statusLabel } from './utils'
import styles from './QdiiMonitor.module.css'

const STATUS_ORDER = ['开放申购', '限大额', '暂停申购']

function QdiiMonitorPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [indexKey, setIndexKey] = useState('all')
  const [status, setStatus] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [filterVersion, setFilterVersion] = useState(0)

  useEffect(() => {
    fetch('/qdii/data.json', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((json) =>
        setData({
          ...json,
          // 去掉无有效限额的份额（美元现汇/封闭期等）与美元现汇/现钞份额，只看人民币可买
          funds: json.funds.filter((f) => {
            if (/美元|美汇|美钞|现汇|现钞/.test(f.name)) return false
            return String(f.status).includes('暂停') || Number(f.limit_amount) > 0
          }),
        })
      )
      .catch((err) => setError(String(err)))
  }, [])

  const metaLine = useMemo(() => {
    if (error) return '数据加载失败'
    if (!data) return '数据加载中…'
    return `数据日期 ${data.updated_at} · 每日扫描`
  }, [data, error])

  const stats = useMemo(() => {
    if (!data) return []
    const count = (s) => data.funds.filter((f) => f.status === s).length
    return [
      { cls: 'all', num: data.funds.length, label: '监控基金' },
      { cls: 'open', num: count('开放申购'), label: '开放申购' },
      { cls: 'limited', num: count('限大额'), label: statusLabel('限大额') },
      { cls: 'suspended', num: count('暂停申购'), label: '暂停申购' },
    ]
  }, [data])

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

          <section className={`${styles.section} fi d8`}>
            <div className={styles.titleRow}>
              <h2 className="section-title">全部基金</h2>
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
        </>
      )}
    </div>
  )
}

export default QdiiMonitorPage
