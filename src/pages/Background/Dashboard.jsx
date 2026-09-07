import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { fetchStats } from './api'

const TrendChart = lazy(() => import('./TrendChart'))

const DAYS_OPTIONS = [
  { value: 7, label: '近 7 天' },
  { value: 30, label: '近 30 天' },
  { value: 0, label: '累计' },
]

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0 秒'
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds} 秒`
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 60) {
    const rest = totalSeconds % 60
    return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分`
  }
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes ? `${hours} 小时 ${restMinutes} 分` : `${hours} 小时`
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/** 看板分区数据 hook：分区级降级，单分区失败不影响其他分区（spec §9） */
function useStats(section, days) {
  const [state, setState] = useState({ status: 'loading', data: null })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchStats(section, days)
      .then((payload) => {
        if (!cancelled) setState({ status: 'ready', data: payload })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', data: null })
      })
    return () => {
      cancelled = true
    }
  }, [section, days, reloadKey])

  const retry = useCallback(() => {
    setState({ status: 'loading', data: null })
    setReloadKey((k) => k + 1)
  }, [])
  return { ...state, retry }
}

function Section({ title, note, status, onRetry, children, empty }) {
  return (
    <section className="bg-section">
      <header className="bg-sectionHead">
        <h2 className="bg-sectionTitle">{title}</h2>
        {note ? <span className="bg-sectionNote">{note}</span> : null}
      </header>
      {status === 'loading' ? <p className="bg-hint">正在加载…</p> : null}
      {status === 'error' ? (
        <div className="bg-stateBox">
          <p>读取失败</p>
          <button type="button" className="bg-btnGhost" onClick={onRetry}>
            重试
          </button>
        </div>
      ) : null}
      {status === 'ready' && empty ? <p className="bg-hint">暂无数据</p> : null}
      {status === 'ready' && !empty ? children : null}
    </section>
  )
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-statCard">
      <p className="bg-statValue">{value}</p>
      <p className="bg-statLabel">{label}</p>
      {sub ? <p className="bg-statSub">{sub}</p> : null}
    </div>
  )
}

function isAllZeroSummary(data) {
  return data && data.pv === 0 && data.uv === 0 && data.newsTotal === 0 && data.outboundTotal === 0
}

// ---------- 分区 A：全站流量 ----------
function TrafficSection({ days }) {
  const { status, data, retry } = useStats('summary', days)
  const showStartLabel = days === 0 && data?.range?.startLabel
  return (
    <Section
      title="全站流量"
      note={showStartLabel ? `累计（自 ${showStartLabel} 起）` : null}
      status={status}
      onRetry={retry}
      empty={status === 'ready' && data.pv === 0 && data.uv === 0 && data.trend.length === 0}
    >
      {status === 'ready' ? (
        <>
          <div className="bg-statGrid">
            <StatCard label="浏览量 PV" value={data.pv} />
            <StatCard label="访客数 UV" value={data.uv} />
            <StatCard label="独立 IP" value={data.ip} />
            <StatCard label="次均停留" value={formatDuration(data.avgDwellMsPerVisit)} />
          </div>
          <p className="bg-line">
            首页：{data.homepage.pv} 次访问 · 次均停留 {formatDuration(data.homepage.avgDwellMs)}
          </p>
          {data.trend.length > 0 ? (
            <Suspense fallback={<p className="bg-hint">正在加载图表…</p>}>
              <TrendChart trend={data.trend} />
            </Suspense>
          ) : (
            <p className="bg-hint">暂无趋势数据</p>
          )}
        </>
      ) : null}
    </Section>
  )
}

// ---------- 分区 B：内容行为 ----------
function ContentSection({ days }) {
  const projects = useStats('projects', days)
  const content = useStats('content', days)
  const empty =
    projects.status === 'ready' &&
    content.status === 'ready' &&
    projects.data.clicks.length === 0 &&
    projects.data.details.length === 0 &&
    isAllZeroSummary({ ...content.data, pv: 0, uv: 0 })
  const status =
    projects.status === 'loading' || content.status === 'loading'
      ? 'loading'
      : projects.status === 'error' || content.status === 'error'
        ? 'error'
        : 'ready'
  const retry = () => {
    projects.retry()
    content.retry()
  }
  return (
    <Section title="内容行为" status={status} onRetry={retry} empty={empty}>
      {projects.status === 'ready' && content.status === 'ready' ? (
        <div className="bg-cols">
          <div className="bg-col">
            <h3 className="bg-subTitle">造物点击</h3>
            {projects.data.clicks.length === 0 ? (
              <p className="bg-hint">暂无数据</p>
            ) : (
              <ol className="bg-rank">
                {projects.data.clicks.map((row) => (
                  <li key={row.projectId || '(未知)'}>
                    <span className="bg-rankName">{row.projectId || '(未知)'}</span>
                    <span className="bg-rankValue">{row.clicks} 次</span>
                  </li>
                ))}
              </ol>
            )}
            <h3 className="bg-subTitle">详情页访问</h3>
            {projects.data.details.length === 0 ? (
              <p className="bg-hint">暂无数据</p>
            ) : (
              <ol className="bg-rank">
                {projects.data.details.map((row) => (
                  <li key={row.path}>
                    <span className="bg-rankName">{row.path}</span>
                    <span className="bg-rankValue">
                      {row.visits} 次 · {formatDuration(row.avgDwellMs)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="bg-col">
            <h3 className="bg-subTitle">新闻速览（{content.data.newsTotal} 次）</h3>
            {content.data.topNews.length === 0 ? (
              <p className="bg-hint">暂无数据</p>
            ) : (
              <ol className="bg-rank">
                {content.data.topNews.map((row) => (
                  <li key={row.newsId || '(未知)'}>
                    <span className="bg-rankName">{row.newsId || '(未知)'}</span>
                    <span className="bg-rankValue">{row.clicks} 次</span>
                  </li>
                ))}
              </ol>
            )}
            <h3 className="bg-subTitle">外链跳转（{content.data.outboundTotal} 次）</h3>
            {content.data.topOutbound.length === 0 ? (
              <p className="bg-hint">暂无数据</p>
            ) : (
              <ol className="bg-rank">
                {content.data.topOutbound.map((row) => (
                  <li key={row.url || '(未知)'}>
                    <span className="bg-rankName bg-rankUrl" title={row.url}>
                      {row.url || '(未知)'}
                    </span>
                    <span className="bg-rankValue">{row.clicks} 次</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      ) : null}
    </Section>
  )
}

// ---------- 分区 C：QDII 订阅（实时快照，不受时间筛选影响） ----------
function QdiiSection() {
  const { status, data, retry } = useStats('qdii', 7)
  return (
    <Section
      title="QDII 订阅"
      note="实时快照 · 不受时间筛选影响"
      status={status}
      onRetry={retry}
      empty={status === 'ready' && data.total === 0}
    >
      {status === 'ready' ? (
        <div className="bg-statGrid">
          <StatCard label="在订" value={data.active} />
          <StatCard label="累计订阅" value={data.total} sub={`含已退订 ${data.unsubscribed}`} />
        </div>
      ) : null}
    </Section>
  )
}

// ---------- 分区 D：鉴往 ----------
function DcaSection({ days }) {
  const { status, data, retry } = useStats('dca', days)
  const showStartLabel = days === 0 && data?.range?.startLabel
  return (
    <Section
      title="鉴往"
      note={showStartLabel ? `累计（自 ${showStartLabel} 起）` : null}
      status={status}
      onRetry={retry}
      empty={status === 'ready' && data.players === 0 && data.totalRounds === 0}
    >
      {status === 'ready' ? (
        <div className="bg-statGrid">
          <StatCard label="游玩人数" value={data.players} />
          <StatCard label="总局数" value={data.totalRounds} sub={`人均 ${data.avgRoundsPerPlayer} 局`} />
          <StatCard label="完成局数" value={data.completedRounds} />
          <StatCard label="人均游戏时长" value={formatDuration(data.avgDurationPerPlayerMs)} />
          <StatCard label="每局平均耗时" value={formatDuration(data.avgDurationPerRoundMs)} />
        </div>
      ) : null}
    </Section>
  )
}

function Dashboard() {
  const [days, setDays] = useState(7)
  return (
    <div>
      <header className="bg-pageHead">
        <h1 className="bg-pageTitle">数据看板</h1>
        <div className="bg-days" role="group" aria-label="时间范围">
          {DAYS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`bg-daysBtn${days === opt.value ? ' is-active' : ''}`}
              onClick={() => setDays(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>
      <TrafficSection days={days} />
      <ContentSection days={days} />
      <QdiiSection />
      <DcaSection days={days} />
      <p className="bg-footnote">更新时间：{formatDate(new Date().toISOString())} · 数据口径见设计文档 §6</p>
    </div>
  )
}

export default Dashboard
