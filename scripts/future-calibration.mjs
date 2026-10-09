// node scripts/future-calibration.mjs
// 校准诊断：同一数据/人民币收益/回撤定义；候选种子与最终检验种子分开。
import { readFileSync } from 'node:fs'
import { calibrateReturnModel, findDrawdowns, generateMonthlyReturns, mulberry32, RETURN_BLOCK_MONTHS } from '../src/pages/QdiiMonitor/utils/scenarioEngine.js'

const history = JSON.parse(readFileSync(new URL('../public/qdii/simulation-data.json', import.meta.url), 'utf8'))
const AS_OF_YM = '2026-10'
const CANDIDATE_SAMPLES = 2000
const VALIDATION_SAMPLES = 10000
const VALIDATION_SEED_START = 100000
const CANDIDATE_BLOCK_MONTHS = [36, 60, 84, 120]

/** @param {number[]} monthlyReturns */
function measurePath(monthlyReturns) {
  let marketLevel = 1
  let peak = 1
  let underwaterMonths = 0
  let longestUnderwaterMonths = 0
  let maxDrawdown = 0
  let logReturn = 0
  const curve = [{ marketLevel }]
  for (const monthlyReturn of monthlyReturns) {
    marketLevel *= 1 + monthlyReturn
    logReturn += Math.log1p(monthlyReturn)
    peak = Math.max(peak, marketLevel)
    maxDrawdown = Math.max(maxDrawdown, 1 - marketLevel / peak)
    underwaterMonths = marketLevel < peak * (1 - 1e-12) ? underwaterMonths + 1 : 0
    longestUnderwaterMonths = Math.max(longestUnderwaterMonths, underwaterMonths)
    curve.push({ marketLevel })
  }
  const events = findDrawdowns(curve)
  return { drawdownCount: events.length, maxDrawdown, longestUnderwaterMonths,
    severeCount: events.filter(event => event.drawdown <= -0.4).length,
    annualReturn: Math.expm1(logReturn * 12 / monthlyReturns.length) }
}

function summarize(rows) {
  const average = key => rows.reduce((sum, row) => sum + row[key], 0) / rows.length
  const quantile = (key, probability) => rows.map(row => row[key]).sort((a, b) => a - b)[Math.floor((rows.length - 1) * probability)]
  return {
    samples: rows.length, meanDrawdownCount: average('drawdownCount'),
    medianMaxDrawdown: quantile('maxDrawdown', 0.5), p95MaxDrawdown: quantile('maxDrawdown', 0.95),
    fractionWith60pctDrawdown: rows.filter(row => row.maxDrawdown >= 0.6).length / rows.length,
    mean40pctDrawdownCount: average('severeCount'),
    medianUnderwaterMonths: quantile('longestUnderwaterMonths', 0.5),
    p95UnderwaterMonths: quantile('longestUnderwaterMonths', 0.95),
    p05AnnualReturn: quantile('annualReturn', 0.05), p95AnnualReturn: quantile('annualReturn', 0.95),
  }
}

// 原版 12 月环形采样，仅供比较，不用于产品。
function legacyReturns(model, months, rng) {
  const monthlyReturns = []
  while (monthlyReturns.length < months) {
    const start = Math.floor(rng() * model.residuals.length)
    for (let offset = 0; offset < 12 && monthlyReturns.length < months; offset++) {
      monthlyReturns.push(Math.expm1(model.meanLogReturn + model.residuals[(start + offset) % model.residuals.length]))
    }
  }
  return monthlyReturns
}

function simulationSummary(model, years, samples, seedStart, generate) {
  return summarize(Array.from({ length: samples }, (_, index) => measurePath(generate(model, years * 12, mulberry32(seedStart + index)))))
}

// 等权衡量次数、幅度中位数/尾部、未恢复时间中位数/尾部；尺度只用于比较候选方案。
// 不按单条路径的跌幅筛选、截断或拒绝采样。
function distance(simulated, observed) {
  return Math.abs(simulated.meanDrawdownCount - observed.meanDrawdownCount) / 0.5
    + Math.abs(simulated.medianMaxDrawdown - observed.medianMaxDrawdown) / 0.1
    + Math.abs(simulated.p95MaxDrawdown - observed.p95MaxDrawdown) / 0.1
    + Math.abs(simulated.medianUnderwaterMonths - observed.medianUnderwaterMonths) / 24
    + Math.abs(simulated.p95UnderwaterMonths - observed.p95UnderwaterMonths) / 48
}

const assets = []
const candidateScores = CANDIDATE_BLOCK_MONTHS.map(blockMonths => ({ blockMonths, score: 0 }))
for (const assetKey of ['ndx', 'spx']) {
  const model = calibrateReturnModel(history, assetKey, AS_OF_YM)
  const observedReturns = model.residuals.map(residual => Math.expm1(model.meanLogReturn + residual))
  const horizons = []
  for (const years of [10, 20, 30]) {
    const months = years * 12
    const historicalPaths = []
    for (let start = 0; start + months <= observedReturns.length; start++) {
      historicalPaths.push(measurePath(observedReturns.slice(start, start + months)))
    }
    const observed = historicalPaths.length ? summarize(historicalPaths) : null
    const candidates = observed ? CANDIDATE_BLOCK_MONTHS.map((blockMonths, index) => {
      const metrics = simulationSummary(model, years, CANDIDATE_SAMPLES, 0,
        (model, months, rng) => generateMonthlyReturns(model, months, rng, blockMonths))
      const score = distance(metrics, observed)
      candidateScores[index].score += score / 4 // 两个标的 × 两个可观测年限。
      return { blockMonths, distance: score, metrics }
    }) : []
    horizons.push({ years, observed, candidates,
      before: simulationSummary(model, years, VALIDATION_SAMPLES, VALIDATION_SEED_START, legacyReturns),
      after: simulationSummary(model, years, VALIDATION_SAMPLES, VALIDATION_SEED_START, generateMonthlyReturns),
    })
  }
  assets.push({ assetKey, historicalStartYm: model.startYm, historicalEndYm: model.endYm,
    annualReturn: model.annualReturn, horizons })
}

console.log(JSON.stringify({ asOfYm: AS_OF_YM, historyUpdatedAt: history.updated_at, blockMonths: RETURN_BLOCK_MONTHS,
  candidateSamples: CANDIDATE_SAMPLES, validationSamples: VALIDATION_SAMPLES, validationSeedStart: VALIDATION_SEED_START,
  candidateScores, assets,
  limitations: ['历史滚动窗口高度重叠，不是独立观测。', '只做现有样本内的诊断与种子分离检验，不是未来概率或样本外市场验证。',
    '不足完整 30 年历史，30 年结果仅为外推。', '纳指代理从 2001 年起，缺少互联网泡沫最初阶段；月线遗漏月内峰谷。',
    '仍允许历史片段重复，未设置回撤次数、跌幅上限或恢复保证。'] }, null, 2))
