// 「知来」未来情景引擎（纯函数，无外部依赖，可单测）
// 口径：
//   - 剧本只定义年度总回报骨架（%），引擎把每年的对数收益按权重摊到 12 个月，
//     再加随机扰动后归一——任意年份的月度收益复合后严格等于骨架值，
//     同一剧本每次播放细节不同、年度弧光一致；
//   - 年度跌幅 ≤ -20% 视为「崩塌年」：收益权重前置（年初急跌、年末企稳），
//     让深谷/闪电/冰河的第一段呈现可见的悬崖形状而非匀速阴跌；
//   - 账户轨迹沿用「鉴往」口径：每月定投发生在该月初并参与当月收益，
//     月投金额固定为历史旅程终点时的金额（未来段不支持中途调金额）；
//   - marketLevel 为与注资无关的水位（月收益累乘），用于定位最深回撤月。
// 免责：剧本为虚构情景，形态取材历史、重新编排，不代表任何真实指数的未来走势。

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

// 按 weight 加权抽取剧本；权重缺失或非正数按 1 计。
export function pickScenario(scenarios, rng) {
  if (!Array.isArray(scenarios) || scenarios.length === 0) return null
  const weights = scenarios.map((s) => (Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 1))
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = rng() * total
  for (let i = 0; i < scenarios.length; i += 1) {
    roll -= weights[i]
    if (roll <= 0) return scenarios[i]
  }
  return scenarios[scenarios.length - 1]
}

const CRASH_YEAR_THRESHOLD = -20
// 崩塌年的月度权重：急跌集中在前几个月，随后企稳（总和 = 1）
const CRASH_WEIGHTS = [0.30, 0.25, 0.15, 0.08, 0.05, 0.04, 0.03, 0.03, 0.02, 0.02, 0.02, 0.01]

// 年度骨架 → 月度收益序列（小数口径，如 0.012）。
// 对数收益按权重摊月：先按剧本形状取基础权重，乘上 (1 ± jitterAmp) 的随机扰动，
// 再归一到总和为 1——扰动只改变月内节奏，不改变年度复合结果。
export function expandScenarioMonthlyReturns(scenario, rng) {
  if (!scenario || !Array.isArray(scenario.annualReturns) || scenario.annualReturns.length === 0) {
    throw new Error('剧本缺少年度收益骨架')
  }
  // monthlyNoise（2~6）映射为权重扰动幅度 0.3~0.7：越大月内节奏越颠簸
  const jitterAmp = Math.min(0.8, Math.max(0.1, 0.1 + (scenario.monthlyNoise ?? 3) / 10))
  const returns = []
  for (const annualPct of scenario.annualReturns) {
    if (!Number.isFinite(annualPct) || annualPct <= -100) throw new Error('年度收益骨架非法')
    const logTarget = Math.log1p(annualPct / 100)
    const base = annualPct <= CRASH_YEAR_THRESHOLD ? CRASH_WEIGHTS : null
    const weights = Array.from({ length: 12 }, (_, i) => {
      const b = base ? base[i] : 1 / 12
      return b * (1 + (rng() * 2 - 1) * jitterAmp)
    })
    const sum = weights.reduce((s, w) => s + w, 0)
    for (const w of weights) returns.push(Math.expm1((w / sum) * logTarget))
  }
  return returns
}

function nextYm(ym) {
  const [year, month] = ym.split('-').map(Number)
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`
}

// 未来段完整账户轨迹。curve[0] 为历史终点锚点（不施加任何收益），
// 之后每月 = 投入 + 当月情景收益；金额沿用锚点月投额。
export function buildFutureCurve(scenario, anchor, rng) {
  if (!anchor || !Number.isFinite(anchor.value) || !Number.isFinite(anchor.invested)) {
    throw new Error('缺少历史旅程终点')
  }
  const monthlyReturns = expandScenarioMonthlyReturns(scenario, rng)
  const amount = anchor.amount
  let value = anchor.value
  let invested = anchor.invested
  let marketLevel = anchor.marketLevel ?? 1
  let ym = anchor.ym
  const curve = [{ ...anchor }]
  for (const r of monthlyReturns) {
    ym = nextYm(ym)
    invested += amount
    value = (value + amount) * (1 + r)
    marketLevel *= 1 + r
    const profit = value - invested
    curve.push({
      ym,
      invested,
      value,
      amount,
      profit,
      profitRate: invested > 0 ? profit / invested : 0,
      marketLevel,
    })
  }
  return curve
}

// 最深回撤月：marketLevel 相对其运行高点的最大跌幅。
// 跌幅不足 -12% 视为没有真正的谷底（如长坡），播放中不打断。
export function findTrough(curve) {
  if (!Array.isArray(curve) || curve.length < 2) return null
  let peak = curve[0].marketLevel
  let worstIndex = null
  let worstDrawdown = 0
  for (let i = 1; i < curve.length; i += 1) {
    const level = curve[i].marketLevel
    if (level > peak) peak = level
    const drawdown = level / peak - 1
    if (drawdown < worstDrawdown) {
      worstDrawdown = drawdown
      worstIndex = i
    }
  }
  if (worstIndex == null || worstDrawdown > -0.12) return null
  return { index: worstIndex, drawdown: worstDrawdown }
}

// 一次完整的「知来」推演：抽剧本、生成轨迹、定位谷底。
// 返回 null 表示剧本库为空（调用方按加载失败处理）。
export function createFutureRun(scenarios, anchor, seed) {
  const rng = mulberry32(seed)
  const scenario = pickScenario(scenarios, rng)
  if (!scenario) return null
  const curve = buildFutureCurve(scenario, anchor, rng)
  return { scenario, curve, trough: findTrough(curve), seed }
}
