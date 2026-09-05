// QDII「鉴往」历史定投旅程纯计算引擎（无外部依赖，可单测）
// 口径：每月定投发生在该月第一个可投资时点，并参与当月收益；
//   纳指月总回报 = QQQ 复权月涨跌（含真实分红），作为纳斯达克100总回报代理；
//   标普月总回报 = 价格月涨跌 + 年化股息/12；
//   人民币月回报 = (1 + 美元总回报) * (1 + 汇率变化) - 1；
//   不扣除基金费率、跟踪误差及实际申购成本。

export const SPX_DIV_DEFAULT = 0.0135

const MIN_START_YEAR = 2001

// 开始年份：2001 起至最近一个已经开始且拥有行情数据的完整历史年份。
// 最新数据月份不是 12 月时，上限为最新数据年份的上一年；覆盖 12 月时允许该年份。
export function getAvailableStartYears(monthly) {
  if (!Array.isArray(monthly) || monthly.length === 0) return []
  const lastYm = monthly.at(-1)?.ym
  const [lastYear, lastMonth] = String(lastYm).split('-').map(Number)
  if (!Number.isInteger(lastYear) || !Number.isInteger(lastMonth)) return []
  const maxYear = lastMonth === 12 ? lastYear : lastYear - 1
  return Array.from({ length: Math.max(0, maxYear - MIN_START_YEAR + 1) }, (_, index) => MIN_START_YEAR + index)
}

function monthlyAmountFor(ym, initialAmount, amountChanges) {
  let amount = initialAmount
  for (const change of [...amountChanges].sort((a, b) => a.effectiveYm.localeCompare(b.effectiveYm))) {
    if (change.effectiveYm <= ym) amount = change.amount
  }
  return amount
}

// 完整月度账户轨迹。amountChanges 只影响生效月份及之后，不追溯历史投入。
// marketLevel：与投入金额无关的指数人民币口径水位（同一人民币月收益累乘），
// 用于事件窗口内计算市场回撤，避免持续注资掩盖真实跌幅。
export function buildJourneyCurve(monthly, config, spxDivAnnual = SPX_DIV_DEFAULT) {
  const { assetKey, startYear, initialAmount, amountChanges = [] } = config
  if (!['ndx', 'spx'].includes(assetKey)) throw new Error('不支持的定投标的')
  if (!Number.isFinite(initialAmount) || initialAmount <= 0) throw new Error('月投金额必须大于 0')
  if (!Array.isArray(monthly) || monthly.length === 0) throw new Error('缺少行情数据')
  const div = Number.isFinite(spxDivAnnual) ? spxDivAnnual : SPX_DIV_DEFAULT
  const startIndex = monthly.findIndex((row) => row.ym === `${startYear}-01`)
  if (startIndex < 0) throw new Error('所选年份缺少 1 月行情')
  const rows = monthly.slice(startIndex)
  let value = 0
  let invested = 0
  let marketLevel = 1
  return rows.map((row, index) => {
    const amount = monthlyAmountFor(row.ym, initialAmount, amountChanges)
    invested += amount
    let monthlyReturn = 0
    if (index > 0) {
      const previous = rows[index - 1]
      if (previous[assetKey] == null || row[assetKey] == null || previous.fx == null || row.fx == null) {
        throw new Error(`${row.ym} 缺少连续行情`)
      }
      const usdReturn = row[assetKey] / previous[assetKey] - 1 + (assetKey === 'spx' ? div / 12 : 0)
      monthlyReturn = (1 + usdReturn) * (row.fx / previous.fx) - 1
      marketLevel *= 1 + monthlyReturn
    }
    value = (value + amount) * (1 + monthlyReturn)
    const profit = value - invested
    return {
      ym: row.ym,
      invested,
      value,
      amount,
      profit,
      profitRate: invested > 0 ? profit / invested : 0,
      marketLevel,
    }
  })
}

// 旅程总结：整条曲线的累计投入、期末资产、最差浮盈亏、最长连续低于本金等。
export function summarizeJourney(curve) {
  if (!Array.isArray(curve) || curve.length === 0) return null
  let worstProfit = Infinity
  let worstProfitRate = Infinity
  let longest = 0
  let current = 0
  let amountChangeCount = 0
  for (let i = 0; i < curve.length; i += 1) {
    const point = curve[i]
    if (point.profit < worstProfit) worstProfit = point.profit
    if (point.profitRate < worstProfitRate) worstProfitRate = point.profitRate
    if (point.value < point.invested) {
      current += 1
      longest = Math.max(longest, current)
    } else {
      current = 0
    }
    if (i > 0 && curve[i - 1].amount !== point.amount) amountChangeCount += 1
  }
  return {
    startYm: curve[0].ym,
    endYm: curve.at(-1).ym,
    months: curve.length,
    invested: curve.at(-1).invested,
    finalValue: curve.at(-1).value,
    worstProfit,
    worstProfitRate,
    longestBelowPrincipalMonths: longest,
    startAmount: curve[0].amount,
    finalAmount: curve.at(-1).amount,
    amountChangeCount,
  }
}

// 事件影响窗口内的账户结果：浮盈亏用累计投入做分母；市场回撤用窗口内
// marketLevel 的运行高点做分母（指数人民币口径，与注资无关），两者不混用。
export function calculateEventOutcome(curve, event) {
  if (!Array.isArray(curve) || curve.length === 0 || !event) return null
  const win = curve.filter((p) => p.ym >= event.startYm && p.ym <= event.impactEndYm)
  if (win.length === 0) return null
  let worst = win[0]
  let marketPeak = win[0].marketLevel
  let marketDrawdown = 0
  let dippedBelowPrincipal = false
  let valuePeak = win[0].value
  let valueTrough = win[0].value
  for (const point of win) {
    if (point.profitRate < worst.profitRate) worst = point
    if (point.profit < 0) dippedBelowPrincipal = true
    if (point.value > valuePeak) valuePeak = point.value
    if (point.value < valueTrough) valueTrough = point.value
    if (point.marketLevel > marketPeak) marketPeak = point.marketLevel
    const drawdown = point.marketLevel / marketPeak - 1
    if (drawdown < marketDrawdown) marketDrawdown = drawdown
  }
  const end = win.at(-1)
  return {
    worstYm: worst.ym,
    invested: worst.invested,
    value: worst.value,
    profit: worst.profit,
    profitRate: worst.profitRate,
    marketDrawdown,
    valuePeak,
    valueTrough,
    endYm: end.ym,
    endProfit: end.profit,
    endValue: end.value,
    endInvested: end.invested,
    recovered: end.profit >= 0,
    dippedBelowPrincipal,
  }
}

// 精选事件筛选：只选旅程区间内、影响结束月不超出最新数据的事件；
// 按 priority 降序取不重叠窗口，默认不设上限（有重叠时高优先级优先），再按时间排序返回。
export function selectJourneyEvents(events, { startYm, endYm, limit = Number.POSITIVE_INFINITY }) {
  if (!Array.isArray(events)) return []
  const candidates = events
    .filter((event) => event.startYm >= startYm && event.impactEndYm <= endYm)
    .sort((a, b) => b.priority - a.priority || a.startYm.localeCompare(b.startYm))
  const selected = []
  for (const event of candidates) {
    const overlaps = selected.some((chosen) =>
      event.startYm <= chosen.impactEndYm && chosen.startYm <= event.impactEndYm)
    if (!overlaps) selected.push(event)
    if (selected.length === limit) break
  }
  return selected.sort((a, b) => a.startYm.localeCompare(b.startYm))
}
