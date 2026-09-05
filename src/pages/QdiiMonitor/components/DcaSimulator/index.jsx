import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  buildJourneyCurve,
  calculateEventOutcome,
  getAvailableStartYears,
  selectJourneyEvents,
} from '../../utils/dca'
import { createJourneyState, journeyReducer } from '../../utils/journeyState'
import AmountAdjustDialog from './AmountAdjustDialog'
import EventDialog from './EventDialog'
import JourneyPlayer from './JourneyPlayer'
import JourneySetup from './JourneySetup'
import JourneySummary from './JourneySummary'
import styles from './DcaSimulator.module.css'

// 「鉴往」历史定投旅程：页面级编排。一次性计算完整月度账户轨迹，
// 播放层只控制当前可见游标；金额调整后重算轨迹，事件结果始终实时派生。
export default function DcaSimulator() {
  const [simData, setSimData] = useState(null)
  const [events, setEvents] = useState([])
  const [dataError, setDataError] = useState(null)
  const [eventError, setEventError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [config, setConfig] = useState(null)
  const [amountChanges, setAmountChanges] = useState([])
  const [startError, setStartError] = useState(null)
  const [yearTip, setYearTip] = useState(null)
  // pendingRecovery：第二幕结束时仍低于本金的事件，等待后续首次回到本金之上。
  // restoreTip：实际可见的轻提示，只在真正恢复后出现一次。
  const [pendingRecovery, setPendingRecovery] = useState(null)
  const [restoreTip, setRestoreTip] = useState(null)
  // dialogLeaving：弹窗退场动画标记；确认后先播放退场再真正切 phase。
  const [dialogLeaving, setDialogLeaving] = useState(false)
  const dismissTimerRef = useRef(null)
  const [state, dispatch] = useReducer(journeyReducer, undefined, createJourneyState)

  useEffect(() => () => {
    window.clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = null
  }, [])

  // 弹窗关闭统一走这里：先退场动画，动画结束再提交状态切换。
  // 已有待处理退场时忽略重复触发，避免动画期间反复点击无限推迟 dispatch。
  const dismissDialog = useCallback((action) => {
    if (dismissTimerRef.current) return
    setDialogLeaving(true)
    dismissTimerRef.current = window.setTimeout(() => {
      setDialogLeaving(false)
      dismissTimerRef.current = null
      dispatch(action)
    }, 200)
  }, [dispatch])

  // 行情与事件拆成可独立失败的请求；行情失败停留错误页可重试，事件失败降级为无事件旅程。
  useEffect(() => {
    const controller = new AbortController()
    fetch('/qdii/simulation-data.json', { cache: 'no-store', signal: controller.signal })
      .then((response) => (response.ok
        ? response.json()
        : Promise.reject(new Error(`行情数据 HTTP ${response.status}`))))
      .then((payload) => {
        setSimData(payload)
        setDataError(null)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setDataError(error.message)
      })
    fetch('/qdii/simulation-events.json', { cache: 'no-store', signal: controller.signal })
      .then((response) => (response.ok
        ? response.json()
        : Promise.reject(new Error(`事件数据 HTTP ${response.status}`))))
      .then((payload) => {
        setEvents(payload.events ?? [])
        setEventError(null)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setEvents([])
          setEventError(error.message)
        }
      })
    return () => controller.abort()
  }, [reloadKey])

  const years = useMemo(() => (simData ? getAvailableStartYears(simData.monthly) : []), [simData])

  const curveResult = useMemo(() => {
    if (!simData || !config) return { curve: [], error: null }
    try {
      const curve = buildJourneyCurve(
        simData.monthly,
        { ...config, amountChanges },
        simData.dividend_assumption?.spx_annual,
      )
      return { curve, error: null }
    } catch (error) {
      return { curve: [], error: error.message }
    }
  }, [simData, config, amountChanges])
  const curve = curveResult.curve

  const selectedEvents = useMemo(() => (curve.length
    ? selectJourneyEvents(events, { startYm: curve[0].ym, endYm: curve.at(-1).ym })
    : []), [curve, events])

  const handleStart = useCallback((nextConfig) => {
    if (!simData) return
    try {
      const nextCurve = buildJourneyCurve(
        simData.monthly,
        { ...nextConfig, amountChanges: [] },
        simData.dividend_assumption?.spx_annual,
      )
      setAmountChanges([])
      setStartError(null)
      setYearTip(null)
      setRestoreTip(null)
      setPendingRecovery(null)
      setConfig(nextConfig)
      dispatch({ type: 'START', endIndex: Math.max(0, nextCurve.length - 1) })
    } catch (error) {
      setStartError(`所选标的在所选起点缺少连续数据（${error.message}），请更换年份或稍后重试。`)
    }
  }, [simData])

  const handleDispatch = useCallback((action) => {
    if (action.type === 'RESTART') {
      setAmountChanges([])
      setYearTip(null)
      setRestoreTip(null)
      setPendingRecovery(null)
    }
    dispatch(action)
  }, [dispatch])

  const handleYearEntered = useCallback((point) => {
    setYearTip({ year: point.ym.slice(0, 4), amount: point.amount })
  }, [])

  // 非阻断年度提示：短暂显示后自动收起。
  useEffect(() => {
    if (!yearTip) return undefined
    const timerId = window.setTimeout(() => setYearTip(null), 6000)
    return () => window.clearTimeout(timerId)
  }, [yearTip])

  const activeEvent = useMemo(
    () => selectedEvents.find((event) => event.id === state.activeEventId) ?? null,
    [selectedEvents, state.activeEventId],
  )
  const currentPoint = curve[state.cursor] ?? null

  const activeOutcome = useMemo(() => (
    state.phase === 'eventOutcome' && activeEvent
      ? calculateEventOutcome(curve, activeEvent)
      : null
  ), [state.phase, activeEvent, curve])

  const confirmEventIntro = useCallback(() => {
    if (!activeEvent || curve.length === 0) return
    const impactEndIndex = curve.findIndex((point) => point.ym === activeEvent.impactEndYm)
    dismissDialog({
      type: 'ACK_EVENT_INTRO',
      impactEndIndex: impactEndIndex < 0 ? curve.length - 1 : impactEndIndex,
    })
  }, [activeEvent, curve, dismissDialog])

  // 第二幕结束时仍低于累计本金 → 记录待恢复事件；只有后续月份首次回到本金之上才提示。
  const confirmEventOutcome = useCallback(() => {
    if (activeOutcome && activeEvent && !activeOutcome.recovered) {
      setPendingRecovery(activeEvent.id)
    }
    dismissDialog({ type: 'ACK_EVENT_OUTCOME' })
  }, [activeEvent, activeOutcome, dismissDialog])

  const nextYm = curve[state.cursor + 1]?.ym ?? null

  // 恢复本金轻提示：待恢复事件存在且当前月份首次回到累计投入之上时才显示一次；
  // 若直到旅程终点仍未恢复，则不显示。setState 放在定时器回调中，避免同步更新。
  useEffect(() => {
    if (!pendingRecovery) return undefined
    if (state.phase === 'setup' || state.phase === 'completed') return undefined
    if (!currentPoint || currentPoint.profit < 0) return undefined
    const timerId = window.setTimeout(() => {
      setRestoreTip({ id: pendingRecovery, ym: currentPoint.ym })
      setPendingRecovery(null)
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [pendingRecovery, currentPoint, state.phase])

  // 恢复本金轻提示：显示约 6 秒后自动收起。
  useEffect(() => {
    if (!restoreTip) return undefined
    const timerId = window.setTimeout(() => setRestoreTip(null), 6000)
    return () => window.clearTimeout(timerId)
  }, [restoreTip])

  const confirmAdjust = useCallback(({ effectiveYm, amount }) => {
    if (!effectiveYm || !Number.isFinite(amount) || amount <= 0) {
      dispatch({ type: 'CLOSE_AMOUNT' })
      return
    }
    setAmountChanges((changes) => [
      ...changes.filter((change) => change.effectiveYm !== effectiveYm),
      { effectiveYm, amount },
    ].sort((a, b) => a.effectiveYm.localeCompare(b.effectiveYm)))
    setYearTip(null)
    dismissDialog({ type: 'CLOSE_AMOUNT' })
  }, [dismissDialog])

  const openAdjust = useCallback(() => {
    setYearTip(null)
    dispatch({ type: 'OPEN_AMOUNT' })
  }, [dispatch])

  const restart = useCallback(() => {
    window.clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = null
    setDialogLeaving(false)
    dispatch({ type: 'RESTART' })
  }, [dispatch])

  // 图上事件标点的回顾弹窗
  const reviewEvent = useMemo(() => (
    state.phase === 'eventReview'
      ? selectedEvents.find((event) => event.id === state.activeEventId) ?? null
      : null
  ), [state.phase, state.activeEventId, selectedEvents])

  const openReviewEvent = useCallback((eventId) => {
    setYearTip(null)
    setRestoreTip(null)
    dispatch({ type: 'OPEN_EVENT_REVIEW', eventId })
  }, [dispatch])

  const closeReviewEvent = useCallback(() => {
    dismissDialog({ type: 'CLOSE_EVENT_REVIEW' })
  }, [dismissDialog])

  if (dataError || state.phase === 'error' || (curveResult.error && state.phase !== 'setup')) {
    return (
      <section className={`${styles.section} fi d8`}>
        <span className="section-label">鉴往</span>
        <h2 className="section-title">鉴往 · 历史定投旅程</h2>
        <div className={styles.errorBox}>
          <strong>无法继续这次旅程</strong>
          <br />
          {dataError || state.error || curveResult.error}
          <br />
          {dataError
            ? '行情数据加载失败，请确认 public/qdii/simulation-data.json 可访问后重试。'
            : '请重新开始，或稍后重试。'}
        </div>
        <div className={styles.errorActions}>
          {dataError && (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => setReloadKey((key) => key + 1)}
            >
              重试加载
            </button>
          )}
          <button type="button" className={styles.ghostBtn} onClick={restart}>
            返回设置页
          </button>
        </div>
      </section>
    )
  }

  if (!simData) {
    return (
      <section className={`${styles.section} fi d8`}>
        <span className="section-label">鉴往</span>
        <h2 className="section-title">鉴往 · 历史定投旅程</h2>
        <p className={styles.loading}>历史行情加载中…</p>
      </section>
    )
  }

  return (
    <section className={`${styles.section} fi d8`}>
      {state.phase !== 'setup' && <span className="section-label">鉴往 · 历史定投旅程</span>}

      {state.phase === 'setup' && (
        <>
          {eventError && (
            <p className={styles.eventNotice}>历史事件暂不可用，本次将直接播放至终点。</p>
          )}
          <JourneySetup years={years} onStart={handleStart} />
          {startError && <p className={styles.fieldError}>{startError}</p>}
          <p className={styles.foot}>
            数据更新 {simData.updated_at} · 本体验按指数历史行情与人民币汇率模拟，不包含基金费率、跟踪误差及实际申购成本。
          </p>
        </>
      )}

      {state.phase !== 'setup' && curve.length > 0 && (
        <>
          <h2 className={styles.journeyTitle}>你的历史定投旅程</h2>
          <JourneyPlayer
            curve={curve}
            events={selectedEvents}
            state={state}
            dispatch={handleDispatch}
            onAdjustAmount={openAdjust}
            onYearEntered={handleYearEntered}
            yearTip={yearTip}
            restoreTip={restoreTip}
            onReviewEvent={openReviewEvent}
          />
        </>
      )}

      {state.phase === 'eventIntro' &&
        createPortal(
          <EventDialog
            stage="intro"
            event={activeEvent}
            currentPoint={currentPoint}
            monthsPlayed={state.cursor + 1}
            leaving={dialogLeaving}
            onConfirm={confirmEventIntro}
            onAdjustAmount={openAdjust}
          />,
          document.body,
        )}

      {state.phase === 'eventOutcome' &&
        createPortal(
          <EventDialog
            stage="outcome"
            event={activeEvent}
            outcome={activeOutcome}
            leaving={dialogLeaving}
            onConfirm={confirmEventOutcome}
            onAdjustAmount={openAdjust}
          />,
          document.body,
        )}

      {state.phase === 'adjustingAmount' &&
        createPortal(
          <AmountAdjustDialog
            currentAmount={currentPoint?.amount ?? config?.initialAmount ?? 0}
            effectiveYm={nextYm}
            leaving={dialogLeaving}
            onConfirm={confirmAdjust}
            onCancel={() => dismissDialog({ type: 'CLOSE_AMOUNT' })}
          />,
          document.body,
        )}

      {state.phase === 'eventReview' && reviewEvent &&
        createPortal(
          <EventDialog
            variant="review"
            event={reviewEvent}
            outcome={calculateEventOutcome(curve, reviewEvent)}
            leaving={dialogLeaving}
            onClose={closeReviewEvent}
          />,
          document.body,
        )}

      {state.phase === 'completed' && (
        <JourneySummary config={config} curve={curve} />
      )}

      {state.phase !== 'setup' && simData && (
        <p className={styles.foot}>
          数据更新 {simData.updated_at} · 本体验按指数历史行情与人民币汇率模拟，不包含基金费率、跟踪误差及实际申购成本。
        </p>
      )}
    </section>
  )
}
