import { calculateRetirementBudget } from '../../utils/retirement'
import styles from './DcaSimulator.module.css'

const formatMoney = value => `${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 元`
const formatRate = value => `${(value * 100).toFixed(2)}%`

/** @param {{assets: number, annualRate: number, assetLabel: string, historyStartYm: string, historyEndYm: string, yearsText: string, onYearsChange: (value: string) => void}} props */
export default function RetirementBudget({ assets, annualRate, assetLabel, historyStartYm, historyEndYm, yearsText, onYearsChange }) {
  const years = yearsText === '' ? NaN : Number(yearsText)
  const yearsValid = /^\d+$/.test(yearsText) && Number.isInteger(years) && years >= 1 && years <= 100
  let budget = null
  let error = null
  if (yearsValid) {
    try {
      budget = calculateRetirementBudget({ assets, annualRate, years })
    } catch (cause) {
      error = cause instanceof Error ? cause.message : '退休预算计算失败'
    }
  }

  return (
    <section className={styles.retirement} aria-labelledby="retirement-title">
      <span className={styles.compoundKicker}>退休之后</span>
      <h3 className={styles.futureTitle} id="retirement-title">每月能花多少钱</h3>
      <p className={styles.fieldHint}>
        以本次推演的期末资产 {formatMoney(assets)} 作为退休本金。收益沿用{assetLabel}历史年化 {formatRate(annualRate)}
        （样本 {historyStartYm} — {historyEndYm}），退休后不再新增投入。
      </p>
      <div className={styles.retirementSettings}>
        <label className={styles.ctlLabel} htmlFor="retirement-years">退休后计划花多少年</label>
        <div className={styles.inputWrap}>
          <input id="retirement-years" className={`${styles.input} ${styles.inputWithUnit}`} type="text"
            inputMode="numeric" value={yearsText} placeholder="1 – 100"
            aria-invalid={!yearsValid} aria-describedby="retirement-years-hint"
            onChange={event => onYearsChange(event.target.value)} />
          <span className={styles.inputUnit} aria-hidden="true">年</span>
        </div>
        <p className={styles.fieldHint} id="retirement-years-hint">可填写 1 至 100 年，修改后自动重新计算。</p>
      </div>
      {!yearsValid && <p className={styles.fieldError} role="alert">请输入 1 至 100 年的整数。</p>}
      {error && <p className={styles.fieldError} role="alert">{error}，当前假设下无法计算退休预算。</p>}
      {budget && (
        <>
          <div className={styles.retirementOption}>
            <h4>本金与收益一起花</h4>
            <dl>
              <div><dt>平均每月可花</dt><dd className={styles.retirementMonthly}>{formatMoney(budget.spendMonthly)}</dd></div>
              <div><dt>每年可取</dt><dd>{formatMoney(budget.spendAnnual)}</dd></div>
              <div><dt>{years} 年后剩余本金</dt><dd>{formatMoney(budget.remainingPrincipal)}</dd></div>
            </dl>
            <p className={styles.fieldHint}>剩余本金继续产生收益，每年提取等额资金，计划在 {years} 年末取完。</p>
          </div>
          <details className={styles.futureAnnual}>
            <summary>查看逐年取款与剩余本金</summary>
            <div className={styles.futureTableWrap}>
              <table className={styles.futureTable}>
                <caption className={styles.retirementCaption}>本金与收益一起花 · 每年末取款</caption>
                <thead><tr><th scope="col">退休年份</th><th scope="col">年初本金</th><th scope="col">当年收益</th><th scope="col">当年提取</th><th scope="col">年末剩余</th></tr></thead>
                <tbody>{budget.schedule.map(row => (
                  <tr key={row.year}>
                    <th scope="row">第 {row.year} 年</th>
                    <td>{formatMoney(row.openingAssets)}</td>
                    <td>{formatMoney(row.income)}</td>
                    <td>{formatMoney(row.withdrawal)}</td>
                    <td>{formatMoney(row.closingAssets)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </details>
        </>
      )}
      <p className={styles.fieldHint}>按固定年收益、每年末取款测算，平均月额 = 年提取额 ÷ 12。这里的“收益”不是固定利息；未计通胀、税费及退休期市场波动，实际可取金额会变化。</p>
    </section>
  )
}
