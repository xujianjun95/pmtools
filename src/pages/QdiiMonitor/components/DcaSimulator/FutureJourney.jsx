import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import DcaChart from './DcaChart'
import FutureSetup from './FutureSetup'
import RetirementBudget from './RetirementBudget'
import { createFutureRun, randomSeed, RETURN_BLOCK_MONTHS } from '../../utils/scenarioEngine'
import styles from './DcaSimulator.module.css'

// 返回值自带单位（元/万/亿），调用处不要再拼「 元」，避免「10.1 万 元」这类空隙。
const fmtMoney = (v) => {
  const n = Math.round(v ?? 0)
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)} 亿元`
  if (Math.abs(n) >= 1e5) return `${(n / 1e4).toFixed(1)} 万元`
  return `${n.toLocaleString('zh-CN')} 元`
}

const fmtPct = (v) => `${((v ?? 0) * 100).toFixed(1)}%`
const fmtSignedPct = (v) => `${(v ?? 0) >= 0 ? '+' : ''}${fmtPct(v)}`

function fmtYm(ym) {
  if (!ym) return '—'
  const [year, month] = ym.split('-')
  return `${year} 年 ${Number(month)} 月`
}

function fmtDuration(months) {
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years <= 0) return `${months} 个月`
  return rest ? `${years} 年 ${rest} 个月` : `${years} 年`
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

// 推演开场、大幅回撤、结果共用弹窗，数字均由生成的账户轨迹派生。
function FutureDialog({ kicker, title, lead, stats, confirmLabel, onConfirm, leaving }) {
  const dialogRef = useRef(null)
  const titleRef = useRef(null)

  useEffect(() => {
    const previous = document.activeElement
    titleRef.current?.focus()
    return () => {
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])

  const trapTab = (event) => {
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusables = dialogRef.current.querySelectorAll(
      'button, a[href], input, select, [tabindex]:not([tabindex="-1"])',
    )
    if (!focusables.length) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className={`${styles.overlay} ${leaving ? styles.overlayLeave : ''}`} role="presentation">
      <div
        className={`${styles.dialog} ${leaving ? styles.dialogLeave : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="future-dialog-title"
        ref={dialogRef}
        onKeyDown={trapTab}
      >
        <div className={styles.dialogKicker}>{kicker}</div>
        <h2 className={styles.dialogTitle} id="future-dialog-title" tabIndex={-1} ref={titleRef}>
          {title}
        </h2>
        <div className={styles.dialogBody}>
          <p className={styles.dialogText}>{lead}</p>
        </div>
        {stats && (
          <dl className={styles.dialogStats}>
            {stats.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.primaryBtn} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// 「知来」独立推演：加载历史月收益，生成随机路径，逐个停在大幅回撤谷底。
/** @param {{onReport?: (event: string, meta: {assetKey: string, months: number}) => void}} props */
export default function FutureJourney({ onReport }) {
  const [anchorPoint, setAnchorPoint] = useState(null)
  const [config, setConfig] = useState({ assetKey: 'ndx', years: 20 })
  const [retirementYearsText, setRetirementYearsText] = useState('30')
  const [phase, setPhase] = useState('idle')
  const [run, setRun] = useState(null)
  const [cursor, setCursor] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(false)
  const historyRef = useRef(null)
  const dismissTimerRef = useRef(null)
  const accRef = useRef(0)
  const reportedRef = useRef(false)
  const loadControllerRef = useRef(null)
  const disposedRef = useRef(false)
  const startingRef = useRef(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    disposedRef.current = false
    return () => {
      disposedRef.current = true
      loadControllerRef.current?.abort()
      window.clearTimeout(dismissTimerRef.current)
    }
  }, [])

  const curve = run?.curve ?? []
  const lastIndex = Math.max(0, curve.length - 1)
  const currentPoint = curve[cursor] ?? null

  // 弹窗确认统一走这里：先退场动画，再切相位（与「鉴往」弹窗同一节奏）。
  const dismissTo = useCallback((nextPhase) => {
    if (dismissTimerRef.current) return
    setLeaving(true)
    dismissTimerRef.current = window.setTimeout(() => {
      setLeaving(false)
      dismissTimerRef.current = null
      setPhase(nextPhase)
    }, 200)
  }, [])

  const loadHistory = useCallback(async () => {
    if (historyRef.current) return historyRef.current
    const controller = new AbortController()
    loadControllerRef.current = controller
    const timer = window.setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch('/qdii/simulation-data.json', { cache: 'no-store', signal: controller.signal })
      if (!response.ok) throw new Error(`历史行情 HTTP ${response.status}`)
      const payload = await response.json()
      if (!Array.isArray(payload?.monthly) || !payload.monthly.length) throw new Error('历史行情为空')
      historyRef.current = payload
      return payload
    } finally {
      window.clearTimeout(timer)
      if (loadControllerRef.current === controller) loadControllerRef.current = null
    }
  }, [])

  const roll = useCallback(async (nextAnchor = anchorPoint, nextConfig = config) => {
    if (!nextAnchor || startingRef.current) return
    startingRef.current = true
    setLoading(true)
    setLoadError(null)
    try {
      const history = await loadHistory()
      if (disposedRef.current) return
      const nextRun = createFutureRun(history, nextAnchor, nextConfig, randomSeed())
      setAnchorPoint(nextAnchor)
      setConfig(nextConfig)
      setRun(nextRun)
      setCursor(0)
      accRef.current = 0
      reportedRef.current = false
      setPhase('intro')
      onReport?.('dca_future_start', {
        assetKey: nextRun.config.assetKey,
        months: nextRun.curve.length - 1,
      })
    } catch (error) {
      historyRef.current = null
      if (!disposedRef.current) setLoadError(error instanceof Error
        ? (error.name === 'AbortError' ? '历史行情加载超时' : error.message)
        : '推演生成失败')
    } finally {
      startingRef.current = false
      if (!disposedRef.current) setLoading(false)
    }
  }, [anchorPoint, config, loadHistory, onReport])

  // 播放推进：每次大幅回撤到达谷底时停下，最后一月的谷底确认后再进入终幕。
  const advance = useCallback(() => {
    const nextIndex = cursor + 1
    if (nextIndex > lastIndex) {
      setPhase('closing')
      return
    }
    setCursor(nextIndex)
    if (run?.events.some(event => nextIndex === event.index)) setPhase('trough')
    else if (nextIndex >= lastIndex) setPhase('closing')
  }, [cursor, lastIndex, run])

  // 与「鉴往」播放器同一时钟方案：rAF 按真实流逝时间累计，节奏不随渲染抖动。
  const frameDelay = Math.min(300, Math.max(60, Math.round(25000 / Math.max(1, lastIndex))))
  useEffect(() => {
    if (phase !== 'playing') return undefined
    let rafId
    let last = performance.now()
    const loop = (now) => {
      accRef.current += now - last
      last = now
      if (accRef.current >= frameDelay) {
        accRef.current = 0
        advance()
        return
      }
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [phase, cursor, frameDelay, advance])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) setPhase((p) => (p === 'playing' ? 'paused' : p))
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  // 走完只上报一次（换剧本重新计）。
  useEffect(() => {
    if (phase !== 'done' || reportedRef.current || !run) return
    reportedRef.current = true
    onReport?.('dca_future_complete', {
      assetKey: run.config.assetKey,
      months: run.curve.length - 1,
    })
  }, [phase, run, onReport])

  const backToIdle = useCallback(() => {
    window.clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = null
    setLeaving(false)
    setRun(null)
    setCursor(0)
    setLoadError(null)
    accRef.current = 0
    setPhase('idle')
  }, [])


  const profit = currentPoint ? currentPoint.value - currentPoint.invested : 0
  const isPlaying = phase === 'playing'
  const inRun = phase !== 'idle' && run

  // 终幕数字：这段路新增投入 / 期末账户资产 / 这段路盈亏 / 最深回撤
  const finalPoint = curve.at(-1) ?? null
  const addedInvested = finalPoint ? finalPoint.invested - anchorPoint.invested : 0
  const legProfit = finalPoint ? finalPoint.value - anchorPoint.value - addedInvested : 0

  return (
    <section className={styles.section} aria-label="知来 · 未来情景推演">
      {phase !== 'idle' && <span className="section-label">知来</span>}

      {phase === 'idle' && (
        <FutureSetup
          initialAssets={anchorPoint?.value ?? 0}
          monthlyAmount={anchorPoint?.amount ?? 1000}
          initialConfig={config}
          loading={loading}
          error={loadError}
          onStart={roll}
        />
      )}

      {inRun && (
        <>
          {loadError && <p className={styles.fieldError} role="alert">{loadError}，请重试。</p>}
          <h2 className={styles.journeyTitle} id="future-title">
            {run.model.assetLabel} · {run.config.years} 年定投推演
          </h2>
          <p className={styles.fieldHint}>
            历史样本 {run.model.startYm} — {run.model.endYm} · 长期年化 {fmtPct(run.model.annualReturn)}
            {' · '}年化波动 {fmtPct(run.model.annualVolatility)} · 人民币口径
          </p>
          <details className={styles.futureMethod}>
            <summary>计算依据</summary>
            <p>历史月收益的复合年化作为增长中枢，随机抽取样本内连续 {RETURN_BLOCK_MONTHS / 12} 年的收益片段，保留较完整的下跌与恢复过程，片段内部不跨历史首尾。采样偏差已修正，片段仍可能重复；每年收益和终点不固定，不保证恢复前高。大幅回撤按市场较前高下跌至少 20% 识别，同一轮未恢复的下跌只计一次。</p>
            <p>已对照同口径历史滚动 10 年、20 年区间检验；现有样本不足 30 年，30 年结果属于外推。月线会遗漏月内极端跌幅，模拟中的出现比例不代表真实未来概率。</p>
            <p>纳斯达克 100 使用现有 QQQ 月线代理；标普 500 使用价格月线加年化 {(run.model.dividendAnnual * 100).toFixed(2)}% 的股息近似。收益包含历史美元兑人民币变化，不扣费用。</p>
          </details>
          <div className={styles.player}>
            <div className={styles.statBar}>
              <div>
                <span className={styles.statLabel}>当前年月</span>
                <span className={styles.statValue}>{fmtYm(currentPoint?.ym)}</span>
              </div>
              <div>
                <span className={styles.statLabel}>当前每月投入</span>
                <span className={styles.statValue}>{fmtMoney(currentPoint?.amount)}</span>
              </div>
              <div>
                <span className={styles.statLabel}>累计投入</span>
                <span className={styles.statValue}>{fmtMoney(currentPoint?.invested)}</span>
              </div>
              <div>
                <span className={styles.statLabel}>账户资产</span>
                <span className={styles.statValue}>{fmtMoney(currentPoint?.value)}</span>
              </div>
              <div>
                <span className={styles.statLabel}>浮盈亏</span>
                <span className={`${styles.statValue} ${profit >= 0 ? styles.pos : styles.neg}`}>
                  {profit >= 0 ? '+' : '-'}
                  {fmtMoney(Math.abs(profit))}
                </span>
              </div>
            </div>
            <p className={styles.fieldHint}>已经历大幅回撤 {run.events.filter(event => event.index <= cursor).length} 次</p>

            <DcaChart
              ariaLabel="未来情景推演折线图"
              curve={curve}
              cursor={cursor}
              playing={isPlaying}
              frameDelay={frameDelay}
              reducedMotion={prefersReducedMotion}
              events={[]}
            />

            <div className={styles.controls}>
              {(phase === 'playing' || phase === 'paused') && (
                <button
                  type="button"
                  className={styles.controlBtn}
                  onClick={() => setPhase(isPlaying ? 'paused' : 'playing')}
                >
                  {isPlaying ? '暂停' : '继续'}
                </button>
              )}
              <button type="button" className={styles.ghostBtn} onClick={backToIdle}>
                重新设置
              </button>
              <span className={styles.playHint}>
                {phase === 'paused' ? `已暂停，播放停在 ${fmtYm(currentPoint?.ym)}` : null}
              </span>
            </div>
          </div>

          {phase === 'done' && finalPoint && (
            <div className={styles.futureCard}>
              <span className={styles.compoundKicker}>{run.model.assetLabel} · 推演结果</span>
              <dl className={styles.summaryGrid}>
                <div>
                  <dt>这段路走了</dt>
                  <dd>{fmtDuration(curve.length - 1)}</dd>
                </div>
                <div>
                  <dt>这段路新增投入</dt>
                  <dd>{fmtMoney(addedInvested)}</dd>
                </div>
                <div>
                  <dt>期末账户资产</dt>
                  <dd>{fmtMoney(finalPoint.value)}</dd>
                </div>
                <div>
                  <dt>这段路盈亏</dt>
                  <dd className={legProfit >= 0 ? styles.pos : styles.neg}>
                    {legProfit >= 0 ? '+' : '-'}
                    {fmtMoney(Math.abs(legProfit))}
                  </dd>
                </div>
                {run.events.length > 0 && (
                  <div>
                    <dt>最深市场回撤</dt>
                    <dd className={styles.neg}>{fmtSignedPct(Math.min(...run.events.map(event => event.drawdown)))}</dd>
                  </div>
                )}
              </dl>
              <div className={styles.summaryActions}>
                <button type="button" className={styles.primaryBtn} onClick={() => roll()} disabled={loading}>
                  {loading ? '生成中…' : '重新生成路径'}
                </button>
                <button type="button" className={styles.ghostBtn} onClick={backToIdle}>
                  重新设置
                </button>
              </div>
              <details className={styles.futureAnnual}>
                <summary>逐年投入与收益</summary>
                <p className={styles.fieldHint}>当年盈亏 = 年末资产 − 年初资产 − 当年新增投入；市场涨跌为该年模拟市场回报。首尾不足一年的部分按实际月份统计。</p>
                <div className={styles.futureTableWrap}>
                  <table className={styles.futureTable}>
                    <thead><tr><th scope="col">年份</th><th scope="col">新增投入</th><th scope="col">当年盈亏</th><th scope="col">年末资产</th><th scope="col">市场涨跌</th></tr></thead>
                    <tbody>{run.annual.map(year => (
                      <tr key={year.year}>
                        <th scope="row">{year.year}{year.months < 12 ? ` · ${year.months} 个月` : ''}</th>
                        <td>{fmtMoney(year.addedInvested)}</td>
                        <td className={year.profit >= 0 ? styles.pos : styles.neg}>{year.profit >= 0 ? '+' : '-'}{fmtMoney(Math.abs(year.profit))}</td>
                        <td>{fmtMoney(year.finalValue)}</td>
                        <td className={year.marketReturn >= 0 ? styles.pos : styles.neg}>{fmtSignedPct(year.marketReturn)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </details>
            </div>
          )}

          {phase === 'done' && finalPoint && (
            <RetirementBudget
              assets={finalPoint.value}
              annualRate={run.model.annualReturn}
              assetLabel={run.model.assetLabel}
              historyStartYm={run.model.startYm}
              historyEndYm={run.model.endYm}
              yearsText={retirementYearsText}
              onYearsChange={setRetirementYearsText}
            />
          )}

          <p className={styles.foot}>
            本路径按历史人民币月收益随机生成，包含历史汇率变化，不代表未来实际走势。未扣除基金费率、跟踪误差及申购成本。
          </p>
        </>
      )}

      {phase === 'intro' &&
        createPortal(
          <FutureDialog
            kicker={`知来 · 从 ${fmtYm(anchorPoint.ym)}之后开始`}
            title={`${run.model.assetLabel} · ${run.config.years} 年推演`}
            lead={`历史样本的长期年化为 ${fmtPct(run.model.annualReturn)}。本次路径会有自己的涨跌与结果，大跌次数不固定，也不保证回到本金之上。`}
            stats={[
              { label: '当前每月投入', value: fmtMoney(anchorPoint.amount) },
              { label: '当前账户资产', value: fmtMoney(anchorPoint.value) },
              { label: '这段路大约', value: fmtDuration(curve.length - 1) },
            ]}
            confirmLabel="出发"
            onConfirm={() => dismissTo('playing')}
            leaving={leaving}
          />,
          document.body,
        )}

      {phase === 'trough' &&
        createPortal(
          <FutureDialog
            kicker={`${fmtYm(currentPoint?.ym)} · 第 ${run.events.findIndex(event => event.index === cursor) + 1} 次大幅回撤`}
            title="市场大幅回落"
            lead={`截至本月，模拟市场较这一轮前高回落 ${fmtPct(Math.abs(run.events.find(event => event.index === cursor)?.drawdown))}。每月投入仍在继续，但新增本金并不意味着市场已经恢复。`}
            stats={[
              { label: '累计投入', value: fmtMoney(currentPoint?.invested) },
              { label: '账户资产', value: fmtMoney(currentPoint?.value) },
              {
                label: '浮盈亏',
                value: `${profit >= 0 ? '+' : '-'}${fmtMoney(Math.abs(profit))}`,
              },
            ]}
            confirmLabel="继续走"
            onConfirm={() => dismissTo('playing')}
            leaving={leaving}
          />,
          document.body,
        )}

      {phase === 'closing' &&
        createPortal(
          <FutureDialog
            kicker={`${fmtYm(finalPoint?.ym)} · 这段路走完了`}
            title="这条路径走完了"
            lead={`这 ${run.config.years} 年经历了 ${run.events.length} 次达到 20% 的市场回撤。结果来自这一次生成的月度行情，换一条路径会有不同结果。`}
            stats={[
              { label: '这段路走了', value: fmtDuration(curve.length - 1) },
              { label: '期末账户资产', value: fmtMoney(finalPoint?.value) },
              {
                label: '这段路盈亏',
                value: `${legProfit >= 0 ? '+' : '-'}${fmtMoney(Math.abs(legProfit))}`,
              },
            ]}
            confirmLabel="看看数字"
            onConfirm={() => dismissTo('done')}
            leaving={leaving}
          />,
          document.body,
        )}
    </section>
  )
}
