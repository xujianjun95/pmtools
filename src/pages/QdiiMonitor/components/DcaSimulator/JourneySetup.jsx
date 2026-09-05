import { useEffect, useId, useRef, useState } from 'react'
import { MAX_MONTHLY_AMOUNT } from '../../utils/dca'
import styles from './DcaSimulator.module.css'

const ASSET_OPTIONS = [
  { key: 'ndx', label: '纳斯达克 100' },
  { key: 'spx', label: '标普 500' },
]

const YEAR_STEP_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'])

// 自绘年份下拉：触发钮 + 年份宫格弹层。
// 焦点始终停留在触发钮上，键盘导航通过 aria-activedescendant 指示当前项（ARIA combobox 模式）。
function YearPicker({ years, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef(null)
  const listId = useId()

  // 打开期间监听外部点击，点外面即收起。
  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  // 当前键盘指示项滚动进可视区。
  useEffect(() => {
    if (!open) return
    const menuEl = rootRef.current?.querySelector('[role="listbox"]')
    menuEl?.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  const openMenu = () => {
    setActiveIndex(Math.max(0, years.indexOf(Number(value))))
    setOpen(true)
  }

  const commit = (index) => {
    if (years[index] == null) return
    onChange(String(years[index]))
    setOpen(false)
  }

  const handleTriggerKeyDown = (event) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        openMenu()
      }
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      return
    }
    if (event.key === 'Tab') {
      setOpen(false)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      commit(activeIndex)
      return
    }
    if (YEAR_STEP_KEYS.has(event.key)) {
      event.preventDefault()
      const last = years.length - 1
      setActiveIndex((current) => {
        if (event.key === 'Home') return 0
        if (event.key === 'End') return last
        const step = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1
        return Math.min(last, Math.max(0, current + step))
      })
    }
  }

  return (
    <div className={styles.yearPicker} ref={rootRef}>
      <button
        type="button"
        id="journey-start-year"
        className={styles.yearTrigger}
        role="combobox"
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${listId}-option-${activeIndex}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={styles.yearValue}>{value} 年</span>
        <svg
          className={`${styles.yearChevron} ${open ? styles.yearChevronOpen : ''}`}
          width="14"
          height="14"
          viewBox="0 0 14 14"
          aria-hidden="true"
        >
          <path
            d="M3 5.2 7 9.2 11 5.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby="journey-start-year-label"
          className={styles.yearMenu}
        >
          {years.map((year, index) => (
            <li
              key={year}
              role="option"
              id={`${listId}-option-${index}`}
              aria-selected={year === Number(value)}
              data-selected={year === Number(value)}
              data-active={index === activeIndex}
              className={styles.yearOption}
              onClick={() => commit(index)}
            >
              {year}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// 开始页：出发年份、定投标的、起始月投金额，仅三个输入项。
export default function JourneySetup({ years, onStart }) {
  const [startYear, setStartYear] = useState(years[0] ? String(years[0]) : '')
  const [assetKey, setAssetKey] = useState('ndx')
  const [amountText, setAmountText] = useState('1000')

  // 只放行数字并钳制在上限内：输入即合法，无需报错文案
  const handleAmountChange = (raw) => {
    const digits = raw.replace(/\D/g, '')
    if (!digits) {
      setAmountText('')
      return
    }
    setAmountText(String(Math.min(Number(digits), MAX_MONTHLY_AMOUNT)))
  }
  const amountValid = amountText !== ''
  const yearValid = years.includes(Number(startYear))
  const assetValid = ASSET_OPTIONS.some((option) => option.key === assetKey)
  const valid = yearValid && assetValid && amountValid

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!valid) return
    onStart({ startYear: Number(startYear), assetKey, initialAmount: Number(amountText) })
  }

  return (
    <form className={styles.setup} onSubmit={handleSubmit} noValidate>
      <span className="section-label">鉴往</span>
      <h1 className={styles.setupTitle}>以史为鉴，可以知兴替</h1>
      <p className={styles.setupDesc}>
        选择一个年份出发，看看你的定投计划如何穿越真实历史，一直走到今天。
      </p>

      <div className={styles.setupForm}>
        <div className={styles.setupField}>
          <label className={styles.ctlLabel} id="journey-start-year-label" htmlFor="journey-start-year">
            开始年份
          </label>
          {yearValid ? (
            <YearPicker years={years} value={startYear} onChange={setStartYear} />
          ) : (
            <p className={styles.fieldError}>请选择可用的出发年份。</p>
          )}
        </div>

        <div className={styles.setupField}>
          <span className={styles.ctlLabel} id="journey-asset-label">定投标的</span>
          <div className={styles.seg} role="group" aria-labelledby="journey-asset-label">
            {ASSET_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`${styles.segBtn} ${assetKey === option.key ? styles.segOn : ''}`}
                aria-pressed={assetKey === option.key}
                onClick={() => setAssetKey(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.setupField}>
          <label className={styles.ctlLabel} htmlFor="journey-amount">
            起始月投金额
          </label>
          <div className={styles.inputWrap}>
            <input
              id="journey-amount"
              className={`${styles.input} ${styles.inputWithUnit}`}
              type="text"
              inputMode="numeric"
              placeholder={`1 – ${MAX_MONTHLY_AMOUNT.toLocaleString('zh-CN')}`}
              value={amountText}
              onChange={(event) => handleAmountChange(event.target.value)}
              aria-invalid={!amountValid}
            />
            <span className={styles.inputUnit} aria-hidden="true">元</span>
          </div>
        </div>
      </div>

      <button type="submit" className={styles.primaryBtn} disabled={!valid}>
        开始穿越
      </button>
    </form>
  )
}
