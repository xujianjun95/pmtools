// 「知来」历史收益驱动的未来路径；纯函数，不读取预设剧本。
// 人民币月收益沿用鉴往口径。历史月对数收益均值提供长期增长中枢，
// 连续 120 个月的残差块随机重采样，保留较完整的涨跌与恢复过程。
// 不给每年指定收益，不修正终点，不强制大跌次数或回本。
import { MAX_MONTHLY_AMOUNT, SPX_DIV_DEFAULT } from './dca.js'

export const FUTURE_YEARS = [10, 20, 30]
export const FUTURE_ASSETS = [{ key: 'ndx', label: '纳斯达克 100' }, { key: 'spx', label: '标普 500' }]
export const RETURN_BLOCK_MONTHS = 120
export const LARGE_DRAWDOWN = -0.2

/** @typedef {{ym: string, value: number, invested: number, amount: number, profit: number, profitRate: number, marketLevel: number}} FutureAnchor */
/** @typedef {{assetKey: 'ndx' | 'spx', years: 10 | 20 | 30}} FutureConfig */
/** @typedef {{ym: string, ndx: number | null, spx: number | null, fx: number | null}} HistoryMonth */
/** @typedef {{monthly: HistoryMonth[], updated_at?: string, dividend_assumption?: {spx_annual?: number | null}}} HistoryData */
/** @typedef {{assetKey: string, assetLabel: string, startYm: string, endYm: string, updatedAt: string | null, dividendAnnual: number, meanLogReturn: number, annualReturn: number, annualVolatility: number, residuals: number[]}} ReturnModel */
/** @typedef {{index: number, peakIndex: number, endIndex: number, drawdown: number, recovered: boolean}} DrawdownEvent */

/**
 * 独立推演以当前资产作为起始本金，不继承历史盈亏；首笔新投入发生在下月。
 * @param {{initialAssets: number, monthlyAmount: number}} config
 * @param {Date} [now]
 * @returns {FutureAnchor}
 */
export function createFutureAnchor({ initialAssets, monthlyAmount }, now = new Date()) {
  if (!Number.isSafeInteger(initialAssets) || initialAssets < 0) throw new Error('当前资产必须为有效的非负整数')
  if (!Number.isSafeInteger(monthlyAmount) || monthlyAmount <= 0 || monthlyAmount > MAX_MONTHLY_AMOUNT) {
    throw new Error('每月投入必须为 1 至 100,000 元的整数')
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('推演起始日期无效')
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).formatToParts(now)
  const year = parts.find((part) => part.type === 'year').value
  const month = parts.find((part) => part.type === 'month').value
  return { ym: `${year}-${month}`, value: initialAssets, invested: initialAssets, amount: monthlyAmount, profit: 0, profitRate: 0, marketLevel: 1 }
}

// mulberry32：确定性伪随机，种子可复现同一段未来（便于排查与回放）
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed() {
  const buf = new Uint32Array(1)
  window.crypto.getRandomValues(buf)
  return buf[0]
}

function monthOrdinal(ym) {
  if (typeof ym !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) throw new Error('行情月份格式无效')
  const [year, month] = ym.split('-').map(Number)
  return year * 12 + month - 1
}

function nextYm(ym) {
  const ordinal = monthOrdinal(ym) + 1
  return `${Math.floor(ordinal / 12)}-${String(ordinal % 12 + 1).padStart(2, '0')}`
}

/** @param {HistoryData} data @param {string} assetKey @param {string} asOfYm @returns {ReturnModel} */
export function calibrateReturnModel(data, assetKey, asOfYm) {
  const asset = FUTURE_ASSETS.find(item => item.key === assetKey)
  if (!asset) throw new Error('不支持的定投标的')
  if (!Array.isArray(data?.monthly) || !data.monthly.length) throw new Error('缺少历史行情数据')
  const asOf = monthOrdinal(asOfYm)
  const dividend = data.dividend_assumption?.spx_annual ?? SPX_DIV_DEFAULT
  if (!Number.isFinite(dividend) || dividend < 0) throw new Error('股息假设无效')
  const logs = []
  let previous = null
  let startYm = null
  let endYm = null
  let lastOrdinal = -Infinity
  for (const row of data.monthly) {
    if (!row) throw new Error('历史行情存在空记录')
    const ordinal = monthOrdinal(row.ym)
    if (ordinal <= lastOrdinal) throw new Error('历史月份重复或未按时间排序')
    lastOrdinal = ordinal
    // 不把当前未完成月份或未来记录用于估计。
    if (ordinal >= asOf) continue
    const valid = Number.isFinite(row[assetKey]) && row[assetKey] > 0 && Number.isFinite(row.fx) && row.fx > 0
    if (!valid) {
      if (previous) throw new Error(`${row.ym} 缺少连续行情`)
      continue // 允许上市前无数据，开始后的缺口则不能跳过。
    }
    if (previous) {
      if (ordinal !== monthOrdinal(previous.ym) + 1) throw new Error(`${row.ym} 历史行情不连续`)
      const usdFactor = row[assetKey] / previous[assetKey] + (assetKey === 'spx' ? dividend / 12 : 0)
      const factor = usdFactor * row.fx / previous.fx
      if (!Number.isFinite(factor) || factor <= 0) throw new Error(`${row.ym} 历史收益无效`)
      logs.push(Math.log(factor))
    } else startYm = row.ym
    previous = row
    endYm = row.ym
  }
  if (logs.length < 120) throw new Error('连续历史收益不足 10 年，无法建立长期推演基准')
  const meanLogReturn = logs.reduce((sum, value) => sum + value, 0) / logs.length
  const residuals = logs.map(value => value - meanLogReturn)
  const variance = residuals.reduce((sum, value) => sum + value ** 2, 0) / (logs.length - 1)
  return {
    assetKey, assetLabel: asset.label, startYm, endYm, updatedAt: data.updated_at ?? null, dividendAnnual: dividend,
    meanLogReturn, annualReturn: Math.expm1(meanLogReturn * 12), annualVolatility: Math.sqrt(variance * 12), residuals,
  }
}

// 非环形移动块采样：只抽取样本内完整的连续长片段，不在片段内部拼接历史首尾。
// 完整窗口会偏重样本中部。扣除候选窗口的平均残差，让采样期望仍以历史均值为中枢。
// 修正是抽样前对所有路径相同的偏差项，不对单条路径指定年收益、终点或回撤次数。
/** @param {ReturnModel} model @param {number} months @param {() => number} rng @param {number} [blockMonths] */
export function generateMonthlyReturns(model, months, rng, blockMonths = RETURN_BLOCK_MONTHS) {
  if (!Number.isInteger(months) || months < 1 || months > 360) throw new Error('推演月份无效')
  if (!Number.isFinite(model?.meanLogReturn) || !Array.isArray(model.residuals) || model.residuals.length < 120 || !model.residuals.every(Number.isFinite)) {
    throw new Error('历史收益模型无效')
  }
  if (!Number.isInteger(blockMonths) || blockMonths < 1 || blockMonths > model.residuals.length) throw new Error('历史采样片段长度无效')
  const eligibleStarts = model.residuals.length - blockMonths + 1
  const prefixSums = [0]
  for (const residual of model.residuals) prefixSums.push(prefixSums.at(-1) + residual)
  let residualSum = 0
  for (let start = 0; start < eligibleStarts; start++) {
    residualSum += prefixSums[start + blockMonths] - prefixSums[start]
  }
  const samplingBias = residualSum / (eligibleStarts * blockMonths)
  const returns = []
  while (returns.length < months) {
    const draw = rng()
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('随机源无效')
    const start = Math.floor(draw * eligibleStarts)
    for (let offset = 0; offset < blockMonths && returns.length < months; offset++) {
      returns.push(Math.expm1(model.meanLogReturn + model.residuals[start + offset] - samplingBias))
    }
  }
  return returns
}

/** @param {number[]} monthlyReturns @param {FutureAnchor} anchor @returns {FutureAnchor[]} */
export function buildFutureCurve(monthlyReturns, anchor) {
  if (!anchor || !Number.isFinite(anchor.value) || anchor.value < 0 || !Number.isFinite(anchor.invested) || anchor.invested < 0 ||
    !Number.isSafeInteger(anchor.amount) || anchor.amount < 1 || anchor.amount > MAX_MONTHLY_AMOUNT) throw new Error('缺少有效的推演起点')
  monthOrdinal(anchor.ym)
  if (!Array.isArray(monthlyReturns) || !monthlyReturns.length) throw new Error('缺少月度收益路径')
  let value = anchor.value
  let invested = anchor.invested
  let marketLevel = 1
  let ym = anchor.ym
  const curve = [{ ...anchor, marketLevel }]
  for (const monthlyReturn of monthlyReturns) {
    if (!Number.isFinite(monthlyReturn) || monthlyReturn <= -1) throw new Error('月度收益无效')
    ym = nextYm(ym)
    invested += anchor.amount
    value = (value + anchor.amount) * (1 + monthlyReturn)
    marketLevel *= 1 + monthlyReturn
    if (!Number.isFinite(value) || !Number.isFinite(marketLevel) || marketLevel <= 0) throw new Error('推演结果超出有效范围')
    const profit = value - invested
    curve.push({ ym, invested, value, amount: anchor.amount, profit, profitRate: profit / invested, marketLevel })
  }
  return curve
}

// 每个“前高→回撤→恢复”区间最多提醒一次；尚未恢复的尾部也保留。
// 用市场水位计算，不让定投注资掩盖跌幅。提醒停在实际生成路径的谷底。
/** @param {FutureAnchor[]} curve @returns {DrawdownEvent[]} */
export function findDrawdowns(curve) {
  if (!Array.isArray(curve) || curve.length < 2) return []
  const events = []
  let peakIndex = 0
  let troughIndex = 0
  let worst = 0
  const finish = (endIndex, recovered) => {
    if (worst <= LARGE_DRAWDOWN + 1e-12) events.push({ index: troughIndex, peakIndex, endIndex, drawdown: worst, recovered })
  }
  for (let index = 1; index < curve.length; index++) {
    const drawdown = curve[index].marketLevel / curve[peakIndex].marketLevel - 1
    if (drawdown >= -1e-12) {
      finish(index, true)
      peakIndex = index
      troughIndex = index
      worst = 0
    } else if (drawdown < worst) {
      worst = drawdown
      troughIndex = index
    }
  }
  finish(curve.length - 1, false)
  return events
}

/** @param {FutureAnchor[]} curve */
export function summarizeFutureYears(curve) {
  const years = []
  for (let index = 1; index < curve.length; index++) {
    const point = curve[index]
    const year = point.ym.slice(0, 4)
    let summary = years.at(-1)
    if (summary?.year !== year) {
      const previous = curve[index - 1]
      summary = { year, months: 0, startValue: previous.value, startInvested: previous.invested, startLevel: previous.marketLevel }
      years.push(summary)
    }
    summary.months++
    summary.addedInvested = point.invested - summary.startInvested
    summary.finalValue = point.value
    summary.profit = point.value - summary.startValue - summary.addedInvested
    summary.marketReturn = point.marketLevel / summary.startLevel - 1
  }
  return years
}

/** @param {HistoryData} history @param {FutureAnchor} anchor @param {FutureConfig} config @param {number} seed */
export function createFutureRun(history, anchor, config, seed) {
  if (!FUTURE_YEARS.includes(config?.years)) throw new Error('推演年限必须为 10、20 或 30 年')
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('推演种子无效')
  if (!anchor) throw new Error('缺少有效的推演起点')
  const model = calibrateReturnModel(history, config.assetKey, anchor.ym)
  const monthlyReturns = generateMonthlyReturns(model, config.years * 12, mulberry32(seed))
  const curve = buildFutureCurve(monthlyReturns, anchor)
  return { config, model, curve, events: findDrawdowns(curve), annual: summarizeFutureYears(curve), seed }
}
