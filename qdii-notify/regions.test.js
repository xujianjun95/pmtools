import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyRegion } from './regions.js'

test('纳斯达克科技基金归入纳斯达克100订阅范围', () => {
  assert.equal(classifyRegion('景顺长城纳斯达克科技ETF联接(QDII)A人民币'), 'nd100')
})

test('现有地区分类保持不变', () => {
  assert.equal(classifyRegion('广发纳斯达克100ETF联接人民币A'), 'nd100')
  assert.equal(classifyRegion('博时标普500ETF联接A'), 'sp500')
  assert.equal(classifyRegion('某全球精选基金'), 'other')
})
