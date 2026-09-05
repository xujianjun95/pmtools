import { useEffect, useRef } from 'react'
import styles from './DcaSimulator.module.css'

function fmtYm(ym) {
  if (!ym) return '—'
  const [year, month] = ym.split('-')
  return `${year} 年 ${Number(month)} 月`
}

// 返回值自带单位（元/万/亿），调用处不要再拼「 元」，避免「10.1 万 元」这类空隙。
const fmtMoney = (v) => {
  const n = Math.round(v ?? 0)
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)} 亿元`
  if (Math.abs(n) >= 1e5) return `${(n / 1e4).toFixed(1)} 万元`
  return `${n.toLocaleString('zh-CN')} 元`
}

const fmtPct = (v) => `${((v ?? 0) * 100).toFixed(1)}%`

// 事件卡片：variant=live 为播放中触发的两幕卡片（stage=intro/outcome）；
// variant=review 为图上标点点击后的回顾弹窗（一段式，只读，带关闭按钮）。
export default function EventDialog({
  stage,
  variant = 'live',
  event,
  currentPoint,
  monthsPlayed,
  outcome,
  leaving,
  onConfirm,
  onAdjustAmount,
  onClose,
}) {
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

  if (!event) return null
  const isReview = variant === 'review'
  const isIntro = stage === 'intro'
  const isPrincipalLoss = outcome != null && outcome.profit < 0
  // 红涨绿跌：亏损用绿、盈利用红
  const accountCopy = outcome == null
    ? null
    : isPrincipalLoss
      ? (
        <>
          最低时浮亏 <span className={styles.neg}>{fmtMoney(Math.abs(outcome.profit))}（{fmtPct(outcome.profitRate)}）</span>
        </>
      )
      : (
        <>
          指数同期回落 {fmtPct(Math.abs(outcome.marketDrawdown))}，账户资产仍高于累计投入 <span className={styles.pos}>{fmtMoney(outcome.profit)}</span>
        </>
      )
  const impactNode = outcome && outcome.valuePeak > outcome.valueTrough ? (
    <>
      账户资产从 {fmtMoney(outcome.valuePeak)} 回撤至 {fmtMoney(outcome.valueTrough)}，跌去了{' '}
      <span className={styles.neg}>
        {fmtMoney(outcome.valuePeak - outcome.valueTrough)}（{fmtPct(outcome.valueTrough / outcome.valuePeak - 1)}）
      </span>
      。
    </>
  ) : (
    '冲击期间账户资产未见回撤。'
  )
  const recoveryNode = outcome?.dippedBelowPrincipal ? (
    <p className={styles.dialogText}>
      {outcome.recovered
        ? `截至 ${fmtYm(outcome.endYm)}，账户资产已回到累计投入之上。`
        : `截至 ${fmtYm(outcome.endYm)}，账户资产仍低于累计投入，之后才可能恢复。`}
    </p>
  ) : null

  return (
    <div className={`${styles.overlay} ${leaving ? styles.overlayLeave : ''}`} role="presentation">
      <div
        className={`${styles.dialog} ${leaving ? styles.dialogLeave : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-dialog-title"
        ref={dialogRef}
        onKeyDown={trapTab}
      >
        <div className={styles.dialogKicker}>{fmtYm(event.startYm)} · 历史事件{isReview ? '回顾' : ''}</div>
        <h2 className={styles.dialogTitle} id="event-dialog-title" tabIndex={-1} ref={titleRef}>
          {event.title}
        </h2>

        {isIntro ? (
          <>
            <div className={styles.dialogBody}>
              <p className={styles.dialogText}>
                <b>发生了什么</b>
                {event.what}
              </p>
              <p className={styles.dialogText}>
                <b>为什么会影响到你的账户</b>
                {event.why}
              </p>
            </div>
            <dl className={styles.dialogStats}>
              <div>
                <dt>已坚持定投</dt>
                <dd>{monthsPlayed} 个月</dd>
              </div>
              <div>
                <dt>累计投入</dt>
                <dd>{fmtMoney(currentPoint?.invested)}</dd>
              </div>
              <div>
                <dt>账户资产</dt>
                <dd>{fmtMoney(currentPoint?.value)}</dd>
              </div>
            </dl>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.primaryBtn} onClick={onConfirm}>
                看看接下来会怎样
              </button>
              <button type="button" className={styles.ghostBtn} onClick={onAdjustAmount}>
                调整后续月投金额
              </button>
            </div>
          </>
        ) : isReview ? (
          <>
            <div className={styles.dialogBody}>
              <p className={styles.dialogText}>
                <b>发生了什么</b>
                {event.what}
              </p>
              <p className={styles.dialogText}>
                <b>为什么会影响到你的账户</b>
                {event.why}
              </p>
            </div>
            {outcome && (
              <div className={styles.dialogBody}>
                <p className={styles.dialogText}>{accountCopy}</p>
                <p className={styles.dialogText}>{impactNode}</p>
                {recoveryNode}
              </div>
            )}
            <dl className={styles.dialogStats}>
              <div>
                <dt>最差出现在</dt>
                <dd>{fmtYm(outcome?.worstYm)}</dd>
              </div>
              <div>
                <dt>当时累计投入</dt>
                <dd>{fmtMoney(outcome?.invested)}</dd>
              </div>
              <div>
                <dt>当时账户资产</dt>
                <dd>{fmtMoney(outcome?.value)}</dd>
              </div>
            </dl>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.ghostBtn} onClick={onClose}>
                关闭
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.dialogLead}>{event.outcomeLead}</p>
            <div className={styles.dialogBody}>
              <p className={styles.dialogText}>{accountCopy}</p>
              <p className={styles.dialogText}>{impactNode}</p>
              {recoveryNode}
            </div>
            <dl className={styles.dialogStats}>
              <div>
                <dt>最差出现在</dt>
                <dd>{fmtYm(outcome?.worstYm)}</dd>
              </div>
              <div>
                <dt>当时累计投入</dt>
                <dd>{fmtMoney(outcome?.invested)}</dd>
              </div>
              <div>
                <dt>当时账户资产</dt>
                <dd>{fmtMoney(outcome?.value)}</dd>
              </div>
            </dl>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.primaryBtn} onClick={onConfirm}>
                继续穿越
              </button>
              <button type="button" className={styles.ghostBtn} onClick={onAdjustAmount}>
                调整后续月投金额
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
