import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeMarketSnapshot } from '../src/pages/MarketDashboard/marketData.js'

test('domestic quotes keep the historical source and date separate from the new quote', () => {
  const input = { version: 1, indicators: [{ id: 'sp500', value: 110, source: '东方财富', historySource: 'Yahoo Finance', sourceUrl: 'https://quote.eastmoney.com/q/100.SPX.html', fetchedAt: new Date().toISOString(), history: [{ date: '2026-10-13', value: 100 }] }] }
  const item = normalizeMarketSnapshot(input).indicators[0]
  assert.equal(item.source, '东方财富')
  assert.equal(item.historySource, 'Yahoo Finance')
  assert.equal(item.historyAsOf, '2026-10-13')
  assert.deepEqual(item.history, input.indicators[0].history)
  assert.equal(item.stale, false)
  assert.equal(item.sourceUrl, input.indicators[0].sourceUrl)
})

test('only the known HTTPS quote providers can expose source links', () => {
  for (const sourceUrl of ['javascript:alert(1)', 'https://quote.eastmoney.com.evil.example/q/100.SPX.html', 'http://finance.sina.com.cn/']) {
    const item = normalizeMarketSnapshot({ version: 1, indicators: [{ id: 'usdcny', value: 6.7, source: '新浪财经', sourceUrl }] }).indicators[0]
    assert.equal(item.sourceUrl, null)
    assert.equal(item.stale, true)
  }
})
