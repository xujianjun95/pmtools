import { useState } from 'react'
import { MAX_MONTHLY_AMOUNT } from '../../utils/dca'
import { createFutureAnchor, FUTURE_ASSETS, FUTURE_YEARS } from '../../utils/scenarioEngine'
import styles from './DcaSimulator.module.css'

/** @param {{initialAssets: number, monthlyAmount: number, initialConfig: import('../../utils/scenarioEngine').FutureConfig, loading: boolean, error: string | null, onStart: (anchor: import('../../utils/scenarioEngine').FutureAnchor, config: import('../../utils/scenarioEngine').FutureConfig) => void}} props */
export default function FutureSetup({ initialAssets, monthlyAmount, initialConfig, loading, error, onStart }) {
  const [assetsText, setAssetsText] = useState(String(initialAssets))
  const [amountText, setAmountText] = useState(String(monthlyAmount))
  const [formError, setFormError] = useState(null)
  const [assetKey, setAssetKey] = useState(initialConfig.assetKey)
  const [years, setYears] = useState(initialConfig.years)
  const assets = assetsText === '' ? NaN : Number(assetsText)
  const amount = amountText === '' ? NaN : Number(amountText)
  const assetsValid = Number.isSafeInteger(assets) && assets >= 0
  const amountValid = Number.isSafeInteger(amount) && amount > 0 && amount <= MAX_MONTHLY_AMOUNT
  const valid = assetsValid && amountValid

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!valid || loading) return
    try {
      const anchor = createFutureAnchor({ initialAssets: assets, monthlyAmount: amount })
      setFormError(null)
      onStart(anchor, { assetKey, years })
    } catch (cause) {
      setFormError(cause.message)
    }
  }

  return (
    <form className={styles.setup} onSubmit={handleSubmit} noValidate>
      <span className="section-label">知来</span>
      <h1 className={styles.setupTitle}>未来有很多种走法</h1>
      <p className={styles.setupDesc}>
        以指数的历史长期收益为基准，从当前资产和每月投入出发，看看定投计划如何经历上涨与大跌。
      </p>
      <div className={`${styles.setupForm} ${styles.futureSetupForm}`}>
        <div className={styles.setupField}>
          <span className={styles.ctlLabel} id="future-asset-label">定投标的</span>
          <div className={styles.seg} role="group" aria-labelledby="future-asset-label">
            {FUTURE_ASSETS.map(option => (
              <button key={option.key} type="button" disabled={loading}
                className={`${styles.segBtn} ${assetKey === option.key ? styles.segOn : ''}`}
                aria-pressed={assetKey === option.key} onClick={() => setAssetKey(option.key)}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.setupField}>
          <span className={styles.ctlLabel} id="future-years-label">推演年限</span>
          <div className={styles.seg} role="group" aria-labelledby="future-years-label">
            {FUTURE_YEARS.map(option => (
              <button key={option} type="button" disabled={loading}
                className={`${styles.segBtn} ${years === option ? styles.segOn : ''}`}
                aria-pressed={years === option} onClick={() => setYears(option)}>
                {option} 年
              </button>
            ))}
          </div>
        </div>
        <div className={styles.setupField}>
          <label className={styles.ctlLabel} htmlFor="future-assets">当前资产</label>
          <div className={styles.inputWrap}>
            <input
              id="future-assets" className={`${styles.input} ${styles.inputWithUnit}`}
              type="text" inputMode="numeric" value={assetsText} disabled={loading}
              aria-invalid={!assetsValid} aria-describedby="future-assets-hint"
              onChange={(event) => setAssetsText(event.target.value.replace(/\D/g, ''))}
            />
            <span className={styles.inputUnit} aria-hidden="true">元</span>
          </div>
          <p className={styles.fieldHint} id="future-assets-hint">作为本次推演的起始本金，可填 0，不带入历史盈亏。</p>
          {!assetsValid && <p className={styles.fieldError}>请输入有效的非负整数金额。</p>}
        </div>
        <div className={styles.setupField}>
          <label className={styles.ctlLabel} htmlFor="future-amount">每月投入</label>
          <div className={styles.inputWrap}>
            <input
              id="future-amount" className={`${styles.input} ${styles.inputWithUnit}`}
              type="text" inputMode="numeric" value={amountText} disabled={loading}
              aria-invalid={!amountValid} aria-describedby="future-amount-hint"
              placeholder={`1 – ${MAX_MONTHLY_AMOUNT.toLocaleString('zh-CN')}`}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, '')
                setAmountText(digits ? String(Math.min(Number(digits), MAX_MONTHLY_AMOUNT)) : '')
              }}
            />
            <span className={styles.inputUnit} aria-hidden="true">元</span>
          </div>
          <p className={styles.fieldHint} id="future-amount-hint">从下月开始投入，推演期间保持不变，上限 10 万元/月。</p>
          {!amountValid && <p className={styles.fieldError}>请输入 1 至 100,000 元的月投金额。</p>}
        </div>
      </div>
      {(error || formError) && <p className={styles.fieldError} role="alert">{error || formError}，请重试。</p>}
      <button type="submit" className={styles.primaryBtn} disabled={!valid || loading}>
        {loading ? '生成中…' : '开始推演'}
      </button>
      <p className={styles.foot}>人民币口径，包含历史汇率变化。波动次数与结果随路径变化，历史收益不代表未来收益。</p>
    </form>
  )
}
