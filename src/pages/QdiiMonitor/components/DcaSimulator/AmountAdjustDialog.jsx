import { useEffect, useRef, useState } from 'react'
import { MAX_MONTHLY_AMOUNT } from '../../utils/dca'
import styles from './DcaSimulator.module.css'

// 返回值自带单位（元/万/亿），调用处不要再拼「 元」。
const fmtMoney = (v) => {
  const n = Math.round(v ?? 0)
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)} 亿元`
  if (Math.abs(n) >= 1e5) return `${(n / 1e4).toFixed(1)} 万元`
  return `${n.toLocaleString('zh-CN')} 元`
}

function fmtYm(ym) {
  if (!ym) return ''
  const [year, month] = ym.split('-')
  return `${year} 年 ${Number(month)} 月`
}

// 后续月投金额调整：只影响生效月份之后的定投，不追溯历史投入。
export default function AmountAdjustDialog({ currentAmount, effectiveYm, leaving, onConfirm, onCancel }) {
  const dialogRef = useRef(null)
  const titleRef = useRef(null)
  const [mode, setMode] = useState('keep')
  const [customText, setCustomText] = useState('')

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

  // 只放行数字并钳制在上限内：输入即合法
  const handleCustomChange = (raw) => {
    const digits = raw.replace(/\D/g, '')
    if (!digits) {
      setCustomText('')
      setMode('custom')
      return
    }
    setCustomText(String(Math.min(Number(digits), MAX_MONTHLY_AMOUNT)))
    setMode('custom')
  }
  const customValid = customText !== ''
  // 「提高 10%」同样受定投额度上限约束，到顶就贴着上限
  const raisedAmount = Math.min(MAX_MONTHLY_AMOUNT, Math.round(currentAmount * 1.1))
  const candidates = {
    keep: currentAmount,
    raise: raisedAmount,
    custom: customValid ? Number(customText) : null,
  }
  const nextAmount = candidates[mode]
  const canConfirm = Number.isFinite(nextAmount) && nextAmount > 0

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm({ effectiveYm, amount: nextAmount })
  }

  return (
    <div className={`${styles.overlay} ${leaving ? styles.overlayLeave : ''}`} role="presentation">
      <div
        className={`${styles.dialog} ${leaving ? styles.dialogLeave : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjust-dialog-title"
        ref={dialogRef}
        onKeyDown={trapTab}
      >
        <h2 className={styles.dialogTitle} id="adjust-dialog-title" tabIndex={-1} ref={titleRef}>
          调整后续月投金额
        </h2>
        <p className={styles.dialogLead}>
          {effectiveYm
            ? `调整从 ${fmtYm(effectiveYm)} 开始生效，不追溯已投入的月份。`
            : '旅程已到最后一个月，没有可调整的后续投入。'}
        </p>

        <div className={styles.adjustOptions}>
          <button
            type="button"
            className={`${styles.adjustOption} ${mode === 'keep' ? styles.adjustOn : ''}`}
            aria-pressed={mode === 'keep'}
            onClick={() => setMode('keep')}
          >
            维持 {fmtMoney(currentAmount)}
          </button>
          <button
            type="button"
            className={`${styles.adjustOption} ${mode === 'raise' ? styles.adjustOn : ''}`}
            aria-pressed={mode === 'raise'}
            onClick={() => setMode('raise')}
          >
            提高 10%（{fmtMoney(raisedAmount)}）
          </button>
        </div>
        <div
          className={`${styles.adjustCustom} ${mode === 'custom' ? styles.adjustCustomOn : ''}`}
          onClick={() => setMode('custom')}
        >
          <label className={styles.adjustCustomLabel} htmlFor="adjust-custom-amount">
            输入自定义金额（元/月）
          </label>
          <input
            id="adjust-custom-amount"
            className={`${styles.input} ${styles.adjustInput}`}
            type="text"
            inputMode="numeric"
            placeholder={`1 – ${MAX_MONTHLY_AMOUNT.toLocaleString('zh-CN')}`}
            value={customText}
            onFocus={() => setMode('custom')}
            onChange={(event) => handleCustomChange(event.target.value)}
          />
        </div>

        <div className={styles.dialogActions}>
          <button type="button" className={styles.primaryBtn} onClick={handleConfirm} disabled={!canConfirm}>
            确认调整
          </button>
          <button type="button" className={styles.ghostBtn} onClick={onCancel}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
