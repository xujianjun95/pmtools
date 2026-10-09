import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildFutureCurve, calibrateReturnModel, createFutureAnchor, createFutureRun, findDrawdowns,
  generateMonthlyReturns, mulberry32, summarizeFutureYears,
} from '../src/pages/QdiiMonitor/utils/scenarioEngine.js'

const history = JSON.parse(readFileSync(new URL('../public/qdii/simulation-data.json', import.meta.url), 'utf8'))
const startDate = new Date('2026-10-09T00:00:00Z')
const anchor = createFutureAnchor({ initialAssets: 50000, monthlyAmount: 2000 }, startDate)
const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`)

function fixture(factor = 1.01, fxFactor = 1) {
  return {
    dividend_assumption: { spx_annual: 0.012 },
    monthly: Array.from({ length: 121 }, (_, index) => ({
      ym: `${2000 + Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`,
      ndx: 100 * factor ** index, spx: 100 * factor ** index, fx: 7 * fxFactor ** index,
    })),
  }
}

test('独立起点按北京时间取月，当前资产作为本金，不包含历史盈亏', () => {
  const point = createFutureAnchor({ initialAssets: 50000, monthlyAmount: 2000 }, new Date('2026-09-30T16:05:00Z'))
  assert.deepEqual(point, { ym: '2026-10', value: 50000, invested: 50000, amount: 2000, profit: 0, profitRate: 0, marketLevel: 1 })
})

test('基准用复合年化，月收益包含汇率，标普股息沿用鉴往口径', () => {
  const input = fixture(1.01, 0.999)
  const ndx = calibrateReturnModel(input, 'ndx', '2011-01')
  const spx = calibrateReturnModel(input, 'spx', '2011-01')
  close(ndx.annualReturn, (1.01 * 0.999) ** 12 - 1)
  close(spx.annualReturn, (1.011 * 0.999) ** 12 - 1)
  close(ndx.annualVolatility, 0)
  assert.equal(ndx.startYm, '2000-01')
  assert.equal(ndx.endYm, '2010-01')
})

test('当前未完成月份及未来行情不会进入基准', () => {
  const original = calibrateReturnModel(history, 'ndx', '2026-08')
  const changed = structuredClone(history)
  changed.monthly.at(-1).ndx *= 10
  assert.deepEqual(calibrateReturnModel(changed, 'ndx', '2026-08'), original)
  assert.equal(original.endYm, '2026-07')
})

test('允许上市前空值，上市后缺值、错序、缺月、短样本不能静默跳过', () => {
  assert.ok(calibrateReturnModel(history, 'ndx', anchor.ym).residuals.length > 120)
  const changes = [
    input => { input.monthly[50].fx = null },
    input => { input.monthly[50].ndx = 0 },
    input => { input.monthly[50].ym = input.monthly[49].ym },
    input => { input.monthly.splice(50, 1) },
    input => { input.monthly.splice(100) },
    input => { input.dividend_assumption.spx_annual = NaN },
  ]
  for (const change of changes) {
    const input = fixture()
    change(input)
    assert.throws(() => calibrateReturnModel(input, 'ndx', anchor.ym))
  }
  assert.throws(() => calibrateReturnModel(history, 'unknown', anchor.ym))
  assert.throws(() => calibrateReturnModel(null, 'ndx', anchor.ym))
})

test('抽取连续月收益块，保留顺序，不强制每年归一到年化基准', () => {
  const residuals = Array.from({ length: 120 }, (_, index) => (index - 59.5) / 1000)
  const model = { meanLogReturn: 0.01, residuals }
  const returns = generateMonthlyReturns(model, 24, () => 0)
  returns.forEach((value, index) => close(Math.log1p(value), 0.01 + residuals[index]))
  assert.ok(returns.every(value => value < 0)) // 基准为正，这条路径仍可以持续下跌。
  assert.notEqual(returns.slice(0, 12).reduce((factor, value) => factor * (1 + value), 1), Math.exp(0.01 * 12))
  assert.throws(() => generateMonthlyReturns(model, 24, () => 1))
})

test('采样片段保持十年连续顺序，包含样本尾部但不绕回历史开头', () => {
  const model = calibrateReturnModel(history, 'ndx', anchor.ym)
  const tail = generateMonthlyReturns(model, 120, () => 1 - Number.EPSILON)
  for (let index = 1; index < tail.length; index++) {
    close(Math.log1p(tail[index]) - Math.log1p(tail[index - 1]),
      model.residuals[model.residuals.length - 120 + index] - model.residuals[model.residuals.length - 121 + index])
  }
  assert.notDeepEqual(generateMonthlyReturns(model, 240, mulberry32(1)), generateMonthlyReturns(model, 240, mulberry32(2)))
})

test('完整窗口的中部偏重被修正，不把增长中枢抬高，也不修改单条路径终点', () => {
  const residuals = Array.from({ length: 180 }, (_, index) => index >= 60 && index < 120 ? 0.04 : -0.02)
  const model = { meanLogReturn: 0.005, residuals }
  const eligibleStarts = residuals.length - 120 + 1
  let totalLog = 0
  const sums = []
  for (let start = 0; start < eligibleStarts; start++) {
    const returns = generateMonthlyReturns(model, 120, () => (start + 0.5) / eligibleStarts)
    const sum = returns.reduce((sum, value) => sum + Math.log1p(value), 0)
    totalLog += sum
    sums.push(sum)
  }
  close(totalLog / (eligibleStarts * 120), model.meanLogReturn)
  // 换成非对称样本验证不同窗口仍有不同结果，没有强制拉齐每条路径。
  const varied = { meanLogReturn: 0.005, residuals: Array.from({ length: 180 }, (_, index) => (index - 89.5) / 1000) }
  assert.notDeepEqual(generateMonthlyReturns(varied, 120, () => 0), generateMonthlyReturns(varied, 120, () => 0.99))
  assert.ok(sums.every(Number.isFinite))
  for (const blockMonths of [0, -1, 0.5, NaN, Infinity, 181]) assert.throws(() => generateMonthlyReturns(model, 120, () => 0, blockMonths))
})

test('连续低收益的历史仍能产生亏损，不设置强制回本或回撤上限', () => {
  const run = createFutureRun(fixture(0.98), anchor, { assetKey: 'ndx', years: 20 }, 77)
  assert.ok(run.curve.at(-1).profit < 0)
  assert.ok(run.events.some(event => event.drawdown < -0.9 && !event.recovered))
})

test('随机路径的长期增长中枢保持历史对数均值', () => {
  const model = calibrateReturnModel(history, 'ndx', anchor.ym)
  let totalLog = 0
  const samples = 1000
  for (let seed = 0; seed < samples; seed++) {
    const returns = generateMonthlyReturns(model, 240, mulberry32(seed))
    totalLog += returns.reduce((sum, value) => sum + Math.log1p(value), 0)
  }
  assert.ok(Math.abs(totalLog / (samples * 240) - model.meanLogReturn) < 0.001)
})

test('零本金跨年开始，先投入再参与当月收益', () => {
  const point = createFutureAnchor({ initialAssets: 0, monthlyAmount: 1000 }, new Date('2026-12-10T00:00:00Z'))
  const curve = buildFutureCurve([0.1, -0.2], point)
  assert.equal(curve[1].ym, '2027-01')
  close(curve[1].value, 1100)
  close(curve[2].value, 1680)
  assert.equal(curve[2].invested, 2000)
  close(curve[2].profit, -320)
})

test('已有资产不重复计入本金，零收益只有新增投入', () => {
  const curve = buildFutureCurve(Array(24).fill(0), anchor)
  assert.equal(curve.at(-1).value, 98000)
  assert.equal(curve.at(-1).invested, 98000)
  assert.equal(curve.at(-1).profit, 0)
})

test('大幅回撤依据市场水位：恢复后另算一次，不受新注资影响', () => {
  const curve = buildFutureCurve([0.25, -0.4, 1, -0.3, 1], anchor)
  const events = findDrawdowns(curve)
  assert.equal(events.length, 2)
  assert.deepEqual(events.map(item => item.index), [2, 4])
  close(events[0].drawdown, -0.4)
  close(events[1].drawdown, -0.3)
  assert.ok(events.every(item => item.recovered))
  const changed = buildFutureCurve([0.25, -0.4, 1, -0.3, 1], { ...anchor, value: 0, invested: 0, amount: 100000 })
  assert.deepEqual(findDrawdowns(changed), events)
})

test('同轮下跌只提醒一次，末月谷底与未恢复的长期亏损均保留', () => {
  const curve = buildFutureCurve([-0.2, 0.1, -0.3], anchor)
  const events = findDrawdowns(curve)
  assert.equal(events.length, 1)
  assert.equal(events[0].index, 3)
  assert.equal(events[0].recovered, false)
  assert.ok(curve.at(-1).marketLevel < 1)
  assert.equal(findDrawdowns(buildFutureCurve([-0.1, 0.2], anchor)).length, 0)
  assert.equal(findDrawdowns(buildFutureCurve([-0.2], anchor)).length, 1)
})

test('逐年明细按自然年含首尾部分年，年度盈亏之和等于总盈亏', () => {
  const curve = buildFutureCurve(Array(24).fill(0.01), anchor)
  const annual = summarizeFutureYears(curve)
  assert.deepEqual(annual.map(item => [item.year, item.months]), [['2026', 2], ['2027', 12], ['2028', 10]])
  assert.equal(annual.reduce((sum, year) => sum + year.addedInvested, 0), 48000)
  close(annual.reduce((sum, year) => sum + year.profit, 0), curve.at(-1).profit)
  close(annual[1].marketReturn, 1.01 ** 12 - 1)
})

test('两指数及三种年限均可重复推演，结果有限，大跌次数随路径变化', () => {
  const counts = new Set()
  for (const assetKey of ['ndx', 'spx']) {
    for (const years of [10, 20, 30]) {
      const config = { assetKey, years }
      const run = createFutureRun(history, anchor, config, 77)
      assert.deepEqual(createFutureRun(history, anchor, config, 77), run)
      assert.equal(run.curve.length, years * 12 + 1)
      assert.ok(run.curve.every(point => Number.isFinite(point.value) && point.value >= 0))
      assert.equal(run.curve.at(-1).invested, 50000 + years * 12 * 2000)
    }
    for (let seed = 0; seed < 30; seed++) counts.add(createFutureRun(history, anchor, { assetKey, years: 20 }, seed).events.length)
  }
  assert.ok(counts.size > 1)
})

test('非法本金、月投、日期、年限、种子或收益不能进入推演', () => {
  for (const initialAssets of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => createFutureAnchor({ initialAssets, monthlyAmount: 1000 }))
  for (const monthlyAmount of [0, -1, 0.5, NaN, Infinity, 100001]) assert.throws(() => createFutureAnchor({ initialAssets: 0, monthlyAmount }))
  assert.throws(() => createFutureAnchor({ initialAssets: 0, monthlyAmount: 1000 }, new Date('invalid')))
  assert.throws(() => createFutureRun(history, anchor, { assetKey: 'ndx', years: 15 }, 77))
  assert.throws(() => createFutureRun(history, anchor, { assetKey: 'ndx', years: 20 }, -1))
  for (const value of [-1, NaN, Infinity]) assert.throws(() => buildFutureCurve([value], anchor))
})
