import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import DcaChart from './DcaChart'
import { createFutureRun, randomSeed } from '../../utils/scenarioEngine'
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

// 剧本卡片：开场 / 谷底 / 终幕共用。结构与 EventDialog 一致（遮罩 + 焦点圈定），
// 但内容只有一段叙述 + 三组数字，不设两幕与回顾变体。
function ScenarioDialog({ kicker, title, lead, stats, confirmLabel, onConfirm, leaving }) {
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
        aria-labelledby="scenario-dialog-title"
        ref={dialogRef}
        onKeyDown={trapTab}
      >
        <div className={styles.dialogKicker}>{kicker}</div>
        <h2 className={styles.dialogTitle} id="scenario-dialog-title" tabIndex={-1} ref={titleRef}>
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

// 「知来」未来情景推演：历史旅程终点后的可选第二幕。
// 自包含状态（idle→intro→playing→trough?→closing→done），不接入「鉴往」的旅程状态机；
// 只复用 DcaChart 的渐进式绘制与既有样式。剧本库懒加载，失败可重试、不影响历史总结。
export default function FutureJourney({ anchorPoint, onReport }) {
  const [phase, setPhase] = useState('idle')
  const [run, setRun] = useState(null)
  const [cursor, setCursor] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(false)
  const scenariosRef = useRef(null)
  const dismissTimerRef = useRef(null)
  const accRef = useRef(0)
  const reportedRef = useRef(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => () => {
    window.clearTimeout(dismissTimerRef.current)
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

  const loadScenarios = useCallback(async () => {
    if (scenariosRef.current) return scenariosRef.current
    setLoading(true)
    setLoadError(null)
    try {
      const response = await fetch('/qdii/simulation-scenarios.json', { cache: 'no-store' })
      if (!response.ok) throw new Error(`情景数据 HTTP ${response.status}`)
      const payload = await response.json()
      const list = Array.isArray(payload.scenarios) ? payload.scenarios : []
      if (list.length === 0) throw new Error('情景库为空')
      scenariosRef.current = list
      return list
    } catch (error) {
      setLoadError(error.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const roll = useCallback(async () => {
    const scenarios = await loadScenarios()
    if (!scenarios || !anchorPoint) return
    const nextRun = createFutureRun(scenarios, anchorPoint, randomSeed())
    if (!nextRun) {
      setLoadError('情景库为空')
      return
    }
    setRun(nextRun)
    setCursor(0)
    reportedRef.current = false
    setPhase('intro')
    onReport?.('dca_future_start', {
      scenario: nextRun.scenario.id,
      months: nextRun.curve.length - 1,
    })
  }, [anchorPoint, loadScenarios, onReport])

  // 播放推进：到达谷底月自动停下（一次旅程最多一次），到达终点进入终幕。
  const advance = useCallback(() => {
    const nextIndex = cursor + 1
    if (nextIndex > lastIndex) {
      setPhase('closing')
      return
    }
    setCursor(nextIndex)
    if (run?.trough && nextIndex === run.trough.index) setPhase('trough')
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
      scenario: run.scenario.id,
      months: run.curve.length - 1,
    })
  }, [phase, run, onReport])

  const backToIdle = useCallback(() => {
    window.clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = null
    setLeaving(false)
    setRun(null)
    setCursor(0)
    setPhase('idle')
  }, [])

  if (!anchorPoint) return null

  const profit = currentPoint ? currentPoint.value - currentPoint.invested : 0
  const isPlaying = phase === 'playing'
  const inRun = phase !== 'idle' && run

  // 终幕数字：这段路新增投入 / 期末账户资产 / 这段路盈亏 / 最深回撤
  const finalPoint = curve.at(-1) ?? null
  const addedInvested = finalPoint ? finalPoint.invested - anchorPoint.invested : 0
  const legProfit = finalPoint ? finalPoint.value - anchorPoint.value - addedInvested : 0

  return (
    <section className={styles.future} aria-labelledby="future-title">
      <span className="section-label">知来</span>

      {phase === 'idle' && (
        <div className={styles.futureCard}>
          <h2 className={styles.futureTitle} id="future-title">再往前走一段</h2>
          <p className={styles.futureText}>
            历史放完了，你的定投却没有停。从这里抽一段虚构但真实的未来——大跌、爬坡，
            或者漫长的原地踏步，都可能发生。
          </p>
          {loadError && (
            <p className={styles.fieldError}>情景数据加载失败（{loadError}），请重试。</p>
          )}
          <div className={styles.summaryActions}>
            <button type="button" className={styles.primaryBtn} onClick={roll} disabled={loading}>
              {loading ? '抽取中…' : '抽取一段未来'}
            </button>
          </div>
        </div>
      )}

      {inRun && (
        <>
          <h2 className={styles.journeyTitle} id="future-title">
            {run.scenario.name} · {run.scenario.subtitle}
          </h2>
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

            <DcaChart
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
                放弃这段未来
              </button>
              <span className={styles.playHint}>
                {phase === 'paused' ? `已暂停，播放停在 ${fmtYm(currentPoint?.ym)}` : null}
              </span>
            </div>
          </div>

          {phase === 'done' && finalPoint && (
            <div className={styles.futureCard}>
              <span className={styles.compoundKicker}>{run.scenario.name} · 终幕</span>
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
                {run.trough && (
                  <div>
                    <dt>最深市场回撤</dt>
                    <dd className={styles.neg}>{fmtSignedPct(run.trough.drawdown)}</dd>
                  </div>
                )}
              </dl>
              <div className={styles.summaryActions}>
                <button type="button" className={styles.primaryBtn} onClick={roll} disabled={loading}>
                  {loading ? '抽取中…' : '换一段未来'}
                </button>
                <button type="button" className={styles.ghostBtn} onClick={backToIdle}>
                  收起
                </button>
              </div>
            </div>
          )}

          <p className={styles.foot}>
            未来剧本为虚构情景：形态取材真实历史，重新编排并叠加随机细节，不代表任何指数的未来走势，不构成投资建议。
          </p>
        </>
      )}

      {phase === 'intro' &&
        createPortal(
          <ScenarioDialog
            kicker={`知来 · 从 ${fmtYm(anchorPoint.ym)}之后开始`}
            title={`${run.scenario.name} · ${run.scenario.subtitle}`}
            lead={run.scenario.copy?.intro}
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
          <ScenarioDialog
            kicker={`${fmtYm(currentPoint?.ym)} · 最深的一页`}
            title={run.scenario.name}
            lead={run.scenario.copy?.trough}
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
          <ScenarioDialog
            kicker={`${fmtYm(finalPoint?.ym)} · 这段路走完了`}
            title={run.scenario.name}
            lead={run.scenario.copy?.closing}
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
