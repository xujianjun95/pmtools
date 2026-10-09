/** @typedef {{assets: number, annualRate: number, years: number}} RetirementConfig */
/** @typedef {{year: number, openingAssets: number, income: number, withdrawal: number, closingAssets: number}} RetirementYear */

/**
 * 固定年收益、每年末提取的退休预算。月额仅为年提取额 / 12。
 * 本金与收益一起取，按等额年金在指定年限用完。
 * 不计退休后的新增投入、通胀、税费或收益顺序风险。
 * @param {RetirementConfig} config 年收益用小数，例如 0.04 = 4%。
 */
export function calculateRetirementBudget({ assets, annualRate, years }) {
  if (!Number.isFinite(assets) || assets < 0) throw new Error('退休资产必须为有效的非负金额')
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 1) throw new Error('退休期预期年收益率须为 0% 至 100%')
  if (!Number.isInteger(years) || years < 1 || years > 100) throw new Error('退休年限须为 1 至 100 年的整数')

  const discountDenominator = -Math.expm1(-years * Math.log1p(annualRate))
  // log1p/expm1 避免接近零的年收益产生严重相消；零收益退化为本金 / 年数。
  const spendAnnual = annualRate === 0
    ? assets / years
    : assets * (annualRate / discountDenominator)
  if (!Number.isFinite(spendAnnual)) throw new Error('退休预算超出有效范围')

  /** @type {RetirementYear[]} */
  const schedule = []
  let balance = assets
  for (let year = 1; year <= years; year++) {
    const income = balance * annualRate
    const available = balance + income
    if (!Number.isFinite(available)) throw new Error('退休资产超出有效范围')
    // 最后一年提完剩余资产，消除浮点误差；中途不提前四舍五入。
    const withdrawal = year === years ? available : spendAnnual
    // 直接由剩余年金的现值求余额，避免高收益、长年限下递推误差被复利放大。
    const closingAssets = annualRate === 0
      ? assets * ((years - year) / years)
      : assets * (-Math.expm1(-(years - year) * Math.log1p(annualRate)) / discountDenominator)
    schedule.push({ year, openingAssets: balance, income, withdrawal, closingAssets })
    balance = closingAssets
  }
  return {
    spendAnnual, spendMonthly: spendAnnual / 12, remainingPrincipal: balance, schedule,
  }
}
