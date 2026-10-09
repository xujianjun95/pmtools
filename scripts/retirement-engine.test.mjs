import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateRetirementBudget } from '../src/pages/QdiiMonitor/utils/retirement.js'

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`)

test('本金收益一起取按年末等额年金计算，每年本金下降，最后一年取完', () => {
  const assets = 1000000
  const annualRate = 0.04
  const years = 30
  const result = calculateRetirementBudget({ assets, annualRate, years })
  close(result.spendAnnual, 57830.09913366133)
  close(result.spendMonthly * 12, result.spendAnnual)
  let balance = assets
  for (const row of result.schedule) {
    close(row.openingAssets, balance)
    close(row.income, balance * annualRate)
    close(row.withdrawal, result.spendAnnual)
    close(row.closingAssets, balance + row.income - row.withdrawal)
    assert.ok(row.closingAssets < row.openingAssets)
    balance = row.closingAssets
  }
  assert.equal(result.remainingPrincipal, 0)
  close(result.schedule.reduce((sum, row) => sum + row.withdrawal, 0), assets + result.schedule.reduce((sum, row) => sum + row.income, 0))
})

test('零收益时本金按年限平摊', () => {
  const result = calculateRetirementBudget({ assets: 1200000, annualRate: 0, years: 20 })
  assert.equal(result.spendAnnual, 60000)
  assert.equal(result.spendMonthly, 5000)
  assert.equal(result.remainingPrincipal, 0)
})

test('零资产及一年退休期限可计算，极小年收益不会数值失真', () => {
  const empty = calculateRetirementBudget({ assets: 0, annualRate: 0.04, years: 30 })
  assert.equal(empty.spendMonthly, 0)
  const oneYear = calculateRetirementBudget({ assets: 1000000, annualRate: 0.04, years: 1 })
  close(oneYear.spendAnnual, 1040000)
  const nearZero = calculateRetirementBudget({ assets: 1200000, annualRate: 1e-15, years: 30 })
  close(nearZero.spendAnnual, 40000)
  assert.equal(nearZero.remainingPrincipal, 0)
})

test('相同退休假设下，可花金额随资产等比例变化', () => {
  const first = calculateRetirementBudget({ assets: 1000000, annualRate: 0.04, years: 30 })
  const doubled = calculateRetirementBudget({ assets: 2000000, annualRate: 0.04, years: 30 })
  close(doubled.spendMonthly, first.spendMonthly * 2)
})

test('高收益长年限仍按等额取款，不在最后一年留下递推误差导致的巨额余款', () => {
  const result = calculateRetirementBudget({ assets: 1000000, annualRate: 1, years: 100 })
  for (const row of result.schedule) {
    close(row.withdrawal, result.spendAnnual)
    close(row.openingAssets + row.income - row.withdrawal, row.closingAssets)
  }
  assert.equal(result.remainingPrincipal, 0)
})

test('同一资产较短年限可花更多，提高收益会提高月度预算', () => {
  const base = calculateRetirementBudget({ assets: 1000000, annualRate: 0.03, years: 30 })
  const shorter = calculateRetirementBudget({ assets: 1000000, annualRate: 0.03, years: 20 })
  const higher = calculateRetirementBudget({ assets: 1000000, annualRate: 0.05, years: 30 })
  assert.ok(shorter.spendMonthly > base.spendMonthly)
  assert.ok(higher.spendMonthly > base.spendMonthly)
})

test('无效资产、收益、年限拒绝计算，不返回 NaN 或 Infinity', () => {
  const valid = { assets: 1000000, annualRate: 0.04, years: 30 }
  for (const assets of [-1, NaN, Infinity]) assert.throws(() => calculateRetirementBudget({ ...valid, assets }))
  for (const annualRate of [-0.01, NaN, Infinity, 1.01]) assert.throws(() => calculateRetirementBudget({ ...valid, annualRate }))
  for (const years of [0, -1, 1.5, NaN, Infinity, 101]) assert.throws(() => calculateRetirementBudget({ ...valid, years }))
  assert.throws(() => calculateRetirementBudget({ ...valid, assets: Number.MAX_VALUE, annualRate: 1 }))
})
