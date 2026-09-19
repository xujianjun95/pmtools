import test from 'node:test'
import assert from 'node:assert/strict'
import * as limits from '../src/pages/QdiiMonitor/utils.js'

test('明确的直销零额度不回退代销，只有缺失值才回退', () => {
  assert.equal(typeof limits.getChannelLimit, 'function')
  const fund = { status: '开放申购', limit_amount: 1e11, direct_limit_amount: 0 }
  assert.equal(limits.getChannelLimit(fund, 'direct_limit_amount'), 0)
  assert.equal(limits.getChannelLimit({ ...fund, direct_limit_amount: null }, 'direct_limit_amount'), 1e11)
  assert.equal(limits.getChannelLimit({ ...fund, status: '暂停申购' }, 'direct_limit_amount'), null)
})

test('未知额度不显示为不限，非有限值不能显示为无限额', () => {
  assert.equal(limits.fmtChangeVal('limit_amount', null), '—')
  assert.equal(limits.fmtChangeVal('limit_amount', 'None'), '—')
  assert.equal(limits.fmtLimit(Infinity), '—')
  assert.equal(limits.fmtChangeVal('limit_amount', 1e11), '无限额')
})
