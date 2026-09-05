import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DcaChart from './DcaChart'
import styles from './DcaSimulator.module.css'

// 返回值自带单位（元/万/亿），调用处不要再拼「 元」，避免「10.1 万 元」这类空隙。
const fmtMoney = (v) => {
  const n = Math.round(v ?? 0)
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)} 亿元`
  if (Math.abs(n) >= 1e5) return `${(n / 1e4).toFixed(1)} 万元`
  return `${n.toLocaleString('zh-CN')} 元`
}

function fmtYm(ym) {
  if (!ym) return '—'
  const [year, month] = ym.split('-')
  return `${year} 年 ${Number(month)} 月`
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

// 播放器：唯一计时器、控制按钮、固定状态栏与非阻断轻提示。
export default function JourneyPlayer({
  curve,
  events,
  state,
  dispatch,
  onAdjustAmount,
  onYearEntered,
  yearTip,
  restoreTip,
  onReviewEvent,
}) {
  const prefersReducedMotion = usePrefersReducedMotion()

  const frameDelay = Math.min(300, Math.max(60, Math.round(25000 / Math.max(1, curve.length - 1))))
  const impactDelay = Math.min(500, Math.max(frameDelay * 3, 200))
  const delay = state.phase === 'eventImpact' ? impactDelay : frameDelay

  const eventByStartYm = useMemo(() => new Map(events.map((event) => [event.startYm, event])), [events])

  const advance = useCallback(() => {
    const nextIndex = state.cursor + 1
    const nextPoint = curve[nextIndex]
    if (!nextPoint) {
      dispatch({ type: 'COMPLETE' })
      return
    }
    const eventId = eventByStartYm.get(nextPoint.ym)?.id ?? null
    if (state.phase === 'eventImpact' && nextIndex === state.impactEndIndex) {
      dispatch({ type: 'TICK', nextIndex, eventId })
      dispatch({ type: 'REACH_EVENT_END' })
      return
    }
    dispatch({ type: 'TICK', nextIndex, eventId })
    if (!eventId && nextIndex >= state.endIndex) dispatch({ type: 'COMPLETE' })
    if (!eventId && nextIndex > 0 && nextPoint.ym.endsWith('-01')) onYearEntered?.(nextPoint)
  }, [curve, dispatch, eventByStartYm, onYearEntered, state.cursor, state.endIndex, state.impactEndIndex, state.phase])

  // 单一 rAF 时钟驱动播放：按真实流逝时间累计，到点前进一步。
  // 不用 setTimeout 链，节奏不受渲染负载抖动影响，绘制速度均匀。
  const accRef = useRef(0)
  useEffect(() => {
    if (!['playing', 'eventImpact'].includes(state.phase)) return undefined
    let rafId
    let last = performance.now()
    const loop = (now) => {
      accRef.current += now - last
      last = now
      if (accRef.current >= delay) {
        accRef.current = 0
        advance()
        return
      }
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [state.phase, state.cursor, delay, prefersReducedMotion, advance])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) dispatch({ type: 'PAUSE' })
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [dispatch])

  const currentPoint = curve[state.cursor]
  const hasNextMonth = Boolean(curve[state.cursor + 1])
  const dialogOpen = ['eventIntro', 'eventOutcome', 'adjustingAmount'].includes(state.phase)
  // playing 与 eventImpact 都可暂停；paused 恢复到原 phase（可能是事件影响窗口）
  const canPlayPause = ['playing', 'eventImpact', 'paused'].includes(state.phase)
  const isPlayingLike = state.phase === 'playing' || state.phase === 'eventImpact'
  const profit = currentPoint ? currentPoint.value - currentPoint.invested : 0

  return (
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
        cursor={state.cursor}
        playing={isPlayingLike}
        frameDelay={delay}
        reducedMotion={prefersReducedMotion}
        events={events}
        onReviewEvent={onReviewEvent}
      />

      {!dialogOpen && state.phase !== 'completed' && (yearTip || restoreTip) && (
        <div className={styles.toastArea} role="status" aria-live="polite">
          {yearTip && (
            <p className={styles.toast}>
              进入 {yearTip.year} 年 · 当前每月投入 {fmtMoney(yearTip.amount)}
              {hasNextMonth && (
                <button type="button" className={styles.toastBtn} onClick={onAdjustAmount}>
                  调整
                </button>
              )}
            </p>
          )}
          {restoreTip && (
            <p className={styles.toast}>
              {fmtYm(restoreTip.ym)}，账户资产重新回到累计投入之上。
            </p>
          )}
        </div>
      )}

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.controlBtn}
          disabled={!canPlayPause}
          onClick={() => dispatch({ type: isPlayingLike ? 'PAUSE' : 'RESUME' })}
        >
          {isPlayingLike ? '暂停' : '继续'}
        </button>
        <button type="button" className={styles.ghostBtn} onClick={() => dispatch({ type: 'RESTART' })}>
          重新开始
        </button>
        <span className={styles.playHint}>
          {state.phase === 'eventImpact' ? '正在播放事件影响窗口…' : null}
          {state.phase === 'paused' ? '已暂停，播放停在 ' + fmtYm(currentPoint?.ym) : null}
          {prefersReducedMotion && state.phase === 'playing' ? '已按系统设置减少动态效果' : null}
        </span>
      </div>
    </div>
  )
}
