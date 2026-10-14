import { MAX_MONTHLY_AMOUNT } from './dca.js'
import { calibrateReturnModel, createFutureAnchor, findDrawdowns, generateMonthlyReturns, mulberry32 } from './scenarioEngine.js'

/** @typedef {{investmentMode: 'lumpSum' | 'monthly', initialAssets: number, monthlyAmount: number, years: number, annualRate: number, includeDrawdowns: boolean, assetKey: 'ndx' | 'spx'}} CompoundConfig */
/** @typedef {import('./scenarioEngine.js').HistoryData} HistoryData */
/** @typedef {import('./scenarioEngine.js').FutureAnchor} CompoundPoint */

/**
 * 用户年化收益率为增长中枢；月投在月末加入，初始资产只计一次。
 * 随机模式使用原历史模型的残差，不固定终值或回撤次数。
 * @param {CompoundConfig} config
 * @param {HistoryData | null} history
 * @param {number} [seed]
 * @param {Date} [now]
 */
export function createCompoundRun(config, history = null, seed = 0, now = new Date()) {
  if (!config || !['lumpSum', 'monthly'].includes(config.investmentMode)) throw new Error('请选择投入方式')
  if (!Number.isSafeInteger(config.initialAssets) || config.initialAssets < 0) throw new Error('初始本金必须为有效的非负整数')
  if (config.investmentMode === 'lumpSum' && config.initialAssets === 0) throw new Error('一次性投入本金必须大于 0')
  if (!Number.isInteger(config.years) || config.years < 1 || config.years > 50) throw new Error('投资年限必须为 1 至 50 年')
  if (!Number.isFinite(config.annualRate) || config.annualRate < -0.99 || config.annualRate > 1) throw new Error('预期年化收益率必须为 -99% 至 100%')
  if (typeof config.includeDrawdowns !== 'boolean') throw new Error('随机回撤选项无效')
  const amount = config.investmentMode === 'monthly' ? config.monthlyAmount : 0
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_MONTHLY_AMOUNT || (config.investmentMode === 'monthly' && amount === 0)) {
    throw new Error('每月投入必须为 1 至 100,000 元的整数')
  }
  const anchor = { ...createFutureAnchor({ initialAssets: config.initialAssets, monthlyAmount: amount || 1 }, now), amount }
  const months = config.years * 12
  const meanLogReturn = Math.log1p(config.annualRate) / 12
  let reference = null
  let model = null
  let monthlyReturns
  if (config.includeDrawdowns) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('推演种子无效')
    reference = calibrateReturnModel(history, config.assetKey, anchor.ym)
    model = { ...reference, meanLogReturn, annualReturn: config.annualRate }
    monthlyReturns = generateMonthlyReturns(model, months, mulberry32(seed))
  } else monthlyReturns = Array(months).fill(Math.expm1(meanLogReturn))

  let value = anchor.value
  let invested = anchor.invested
  let marketLevel = 1
  const [startYear, startMonth] = anchor.ym.split('-').map(Number)
  const startOrdinal = startYear * 12 + startMonth - 1
  /** @type {CompoundPoint[]} */
  const curve = [anchor]
  for (let index = 0; index < months; index++) {
    const factor = 1 + monthlyReturns[index]
    // 月末投入：本月新增资金从下个月开始参与收益。
    value = value * factor + amount
    invested += amount
    marketLevel *= factor
    if (!Number.isFinite(value) || !Number.isFinite(invested) || !Number.isFinite(marketLevel) || marketLevel <= 0) throw new Error('推演结果超出有效范围')
    const ordinal = startOrdinal + index + 1
    const ym = `${Math.floor(ordinal / 12)}-${String(ordinal % 12 + 1).padStart(2, '0')}`
    const profit = value - invested
    curve.push({ ym, value, invested, amount, marketLevel, profit, profitRate: invested ? profit / invested : 0 })
  }
  return { config: { ...config }, curve, events: config.includeDrawdowns ? findDrawdowns(curve) : [], model, reference, seed }
}

/**
 * 取用测算：期末资产按月取用、未取走的部分继续按设定年化复利，直到无法足额取出。
 * 每月先复利再取走固定金额；月增值（资产 × 月增长率）是「本金不降」的取用上限。
 * @param {{initialAssets: number, monthlyWithdrawal: number, annualRate: number, maxMonths?: number}} params
 * @returns {{perpetual: boolean, months: number, threshold: number}} perpetual 为 true 时 months 为 Infinity，threshold 为每月可长期取用的上限。
 */
export function planWithdrawal({ initialAssets, monthlyWithdrawal, annualRate, maxMonths = 1200 }) {
  if (!Number.isFinite(initialAssets) || initialAssets <= 0) throw new Error('期末资产必须为有效的正数')
  if (!Number.isSafeInteger(monthlyWithdrawal) || monthlyWithdrawal < 1) throw new Error('每月取用必须为不小于 1 元的整数')
  if (!Number.isFinite(annualRate) || annualRate < -0.99 || annualRate > 1) throw new Error('预期年化收益率必须为 -99% 至 100%')
  if (!Number.isInteger(maxMonths) || maxMonths < 1) throw new Error('测算月数上限必须为正整数')
  const growth = Math.exp(Math.log1p(annualRate) / 12)
  const threshold = initialAssets * (growth - 1)
  if (monthlyWithdrawal <= threshold) return { perpetual: true, months: Infinity, threshold }
  let balance = initialAssets
  let months = 0
  while (months < maxMonths && balance * growth >= monthlyWithdrawal) {
    balance = balance * growth - monthlyWithdrawal
    months += 1
  }
  return { perpetual: false, months, threshold }
}
