import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createCompoundRun, planWithdrawal } from '../src/pages/QdiiMonitor/utils/compoundEngine.js'
import { calibrateReturnModel } from '../src/pages/QdiiMonitor/utils/scenarioEngine.js'

const history = JSON.parse(readFileSync(new URL('../public/qdii/simulation-data.json', import.meta.url), 'utf8'))
const now = new Date('2026-10-14T00:00:00Z')
const config = { investmentMode: 'lumpSum', initialAssets: 100000, monthlyAmount: 1000, years: 20, annualRate: 0.1, includeDrawdowns: false, assetKey: 'ndx' }
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < Math.max(1, Math.abs(expected)) * 1e-9, `${actual} != ${expected}`)

test('一次性投入两年 10% 年化，期末为 121000 元，本金不重复加入', () => {
  const run = createCompoundRun({ ...config, years: 2 }, null, 0, now)
  close(run.curve.at(-1).value, 121000)
  assert.equal(run.curve.at(-1).invested, 100000)
  close(run.curve.at(-1).profit, 21000)
  assert.equal(run.events.length, 0)
})

test('月末投入不参与当月收益；1% 月收益时首月1000、第二月2010', () => {
  const run = createCompoundRun({ ...config, investmentMode: 'monthly', initialAssets: 0, years: 1, annualRate: 1.01 ** 12 - 1 }, null, 0, now)
  close(run.curve[1].value, 1000)
  close(run.curve[2].value, 2010)
  close(run.curve.at(-1).value, 12682.503013196974)
  assert.equal(run.curve.at(-1).invested, 12000)
})

test('零收益只累计初始本金和月投，兼容50年，零本金首次计算不产生NaN', () => {
  const run = createCompoundRun({ ...config, investmentMode: 'monthly', initialAssets: 0, years: 50, annualRate: 0 }, null, 0, now)
  assert.equal(run.curve.length, 601)
  assert.equal(run.curve[0].profitRate, 0)
  assert.equal(run.curve.at(-1).value, 600000)
  assert.equal(run.curve.at(-1).profit, 0)
  const withInitial = createCompoundRun({ ...config, investmentMode: 'monthly', years: 1, annualRate: 0 }, null, 0, now)
  assert.equal(withInitial.curve.at(-1).value, 112000)
})

test('负收益按复利递减，不用正收益或历史参考覆盖用户输入', () => {
  const run = createCompoundRun({ ...config, years: 2, annualRate: -0.5 }, null, 0, now)
  close(run.curve.at(-1).value, 25000)
  close(run.curve.at(-1).profit, -75000)
})

test('随机波动沿用历史残差，同种子可复现，用户年化替代历史增长中枢', () => {
  const options = { ...config, includeDrawdowns: true, years: 50 }
  const first = createCompoundRun(options, history, 77, now)
  assert.deepEqual(createCompoundRun(options, history, 77, now), first)
  assert.notDeepEqual(createCompoundRun(options, history, 78, now).curve, first.curve)
  assert.equal(first.curve.length, 601)
  assert.ok(first.events.length > 0)
  assert.ok(first.curve.every(point => Number.isFinite(point.value) && point.value >= 0))
  const higher = createCompoundRun({ ...options, annualRate: 0.2 }, history, 77, now)
  close(higher.curve[12].marketLevel / first.curve[12].marketLevel, 1.2 / 1.1)
  close(higher.model.meanLogReturn, Math.log1p(0.2) / 12)
  assert.equal(first.reference.annualReturn, calibrateReturnModel(history, 'ndx', '2026-10').annualReturn)
})

test('随机回撤按市场水位识别，不受月投资金或一次性本金规模掩盖', () => {
  const options = { ...config, includeDrawdowns: true, years: 20 }
  const lumpSum = createCompoundRun(options, history, 77, now)
  const monthly = createCompoundRun({ ...options, investmentMode: 'monthly', initialAssets: 0 }, history, 77, now)
  assert.deepEqual(monthly.events, lumpSum.events)
})

test('验证空值、非法金额、年限、收益率、随机选项、日期与损坏行情', () => {
  for (const change of [
    { investmentMode: 'other' }, { initialAssets: -1 }, { initialAssets: 0.1 },
    { investmentMode: 'lumpSum', initialAssets: 0 }, { investmentMode: 'monthly', monthlyAmount: 0 },
    { investmentMode: 'monthly', monthlyAmount: 100001 }, { initialAssets: Infinity },
    { years: 0 }, { years: 51 }, { years: 1.5 }, { annualRate: NaN }, { annualRate: -1 },
    { annualRate: 1.01 }, { includeDrawdowns: 'yes' }, { includeDrawdowns: true, assetKey: 'unknown' },
  ]) assert.throws(() => createCompoundRun({ ...config, ...change }, history, 77, now))
  assert.throws(() => createCompoundRun({ ...config, includeDrawdowns: true }, null, 77, now))
  assert.throws(() => createCompoundRun(config, null, 77, new Date('invalid')))
  assert.throws(() => createCompoundRun({ ...config, includeDrawdowns: true }, history, -1, now))
})

test('取用测算：零收益退化为等额除法，正收益时余额继续复利', () => {
  const zero = planWithdrawal({ initialAssets: 120000, monthlyWithdrawal: 1000, annualRate: 0 })
  assert.equal(zero.perpetual, false)
  assert.equal(zero.months, 120)
  // 月率 1%（年化 1.01^12-1）：10000 元每月取 300，可足额取 40 个月
  const growth = planWithdrawal({ initialAssets: 10000, monthlyWithdrawal: 300, annualRate: 1.01 ** 12 - 1 })
  assert.equal(growth.perpetual, false)
  assert.equal(growth.months, 40)
})

test('取用测算：取用不超过月增值时本金不降（花不完），超过则有限年限', () => {
  const annualRate = 1.01 ** 12 - 1 // 月率恰好 1%
  const perpetual = planWithdrawal({ initialAssets: 100000, monthlyWithdrawal: 1000, annualRate })
  assert.equal(perpetual.perpetual, true)
  assert.equal(perpetual.months, Infinity)
  close(perpetual.threshold, 1000)
  // B_m = 200000 - 100000*1.01^m，可取到 B*1.01 >= 2000 的最后一个月，共 69 个月
  const finite = planWithdrawal({ initialAssets: 100000, monthlyWithdrawal: 2000, annualRate })
  assert.equal(finite.perpetual, false)
  assert.equal(finite.months, 69)
})

test('取用测算：参数非法抛错，月数上限封顶', () => {
  assert.throws(() => planWithdrawal({ initialAssets: 0, monthlyWithdrawal: 100, annualRate: 0.05 }))
  assert.throws(() => planWithdrawal({ initialAssets: 100000, monthlyWithdrawal: 0.5, annualRate: 0.05 }))
  assert.throws(() => planWithdrawal({ initialAssets: 100000, monthlyWithdrawal: 100, annualRate: 2 }))
  const capped = planWithdrawal({ initialAssets: 1e9, monthlyWithdrawal: 1, annualRate: 0, maxMonths: 500 })
  assert.equal(capped.months, 500)
})
