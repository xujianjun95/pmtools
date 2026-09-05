import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildJourneyCurve,
  calculateEventOutcome,
  getAvailableStartYears,
  selectJourneyEvents,
  summarizeJourney,
} from '../src/pages/QdiiMonitor/utils/dca.js'

const monthly = [
  { ym: '2020-12', ndx: 100, spx: 100, fx: 7 },
  { ym: '2021-01', ndx: 110, spx: 105, fx: 7 },
  { ym: '2021-02', ndx: 88, spx: 94.5, fx: 7 },
  { ym: '2021-03', ndx: 96.8, spx: 99.225, fx: 7 },
]

test('start years exclude an incomplete latest year', () => {
  assert.deepEqual(
    getAvailableStartYears([{ ym: '2001-01' }, { ym: '2026-08' }]),
    [2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  )
})

test('amount change affects only its effective month and later', () => {
  const curve = buildJourneyCurve(monthly, {
    assetKey: 'ndx', startYear: 2021, initialAmount: 1000,
    amountChanges: [{ effectiveYm: '2021-03', amount: 2000 }],
  })
  assert.deepEqual(curve.map((point) => point.amount), [1000, 1000, 2000])
  assert.deepEqual(curve.map((point) => point.invested), [1000, 2000, 4000])
})

test('summary counts consecutive months below invested principal', () => {
  const curve = buildJourneyCurve(monthly, {
    assetKey: 'ndx', startYear: 2021, initialAmount: 1000, amountChanges: [],
  })
  const summary = summarizeJourney(curve)
  assert.equal(summary.longestBelowPrincipalMonths, 2)
  assert.equal(summary.startAmount, 1000)
  assert.equal(summary.finalAmount, 1000)
})

test('event outcome separates loss against principal from peak drawdown', () => {
  const curve = buildJourneyCurve(monthly, {
    assetKey: 'ndx', startYear: 2021, initialAmount: 1000, amountChanges: [],
  })
  const outcome = calculateEventOutcome(curve, { startYm: '2021-01', impactEndYm: '2021-03' })
  assert.equal(outcome.worstYm, '2021-02')
  assert.ok(Number.isFinite(outcome.profitRate))
  assert.ok(Number.isFinite(outcome.marketDrawdown))
})

test('market drawdown stays negative while contributions lift the account balance', () => {
  const falling = [
    { ym: '2020-12', ndx: 100, spx: 100, fx: 7 },
    { ym: '2021-01', ndx: 100, spx: 100, fx: 7 },
    { ym: '2021-02', ndx: 90, spx: 90, fx: 7 },
    { ym: '2021-03', ndx: 81, spx: 81, fx: 7 },
  ]
  const curve = buildJourneyCurve(falling, {
    assetKey: 'ndx', startYear: 2021, initialAmount: 1000, amountChanges: [],
  })
  // 指数连跌两成（100 → 90 → 81），但账户因每月新增投入仍逐月上升
  assert.deepEqual(curve.map((point) => Math.round(point.value)), [1000, 1800, 2520])
  const outcome = calculateEventOutcome(curve, { startYm: '2021-01', impactEndYm: '2021-03' })
  assert.ok(outcome.marketDrawdown < 0, '市场下跌时 marketDrawdown 必须为负')
  assert.ok(Math.abs(outcome.marketDrawdown + 0.19) < 1e-9)
})

test('event selection keeps at most five non-overlapping high-priority events in time order', () => {
  const events = [
    { id: 'a', startYm: '2008-09', impactEndYm: '2009-03', priority: 100 },
    { id: 'b', startYm: '2008-12', impactEndYm: '2009-05', priority: 20 },
    { id: 'c', startYm: '2020-02', impactEndYm: '2020-03', priority: 95 },
    { id: 'd', startYm: '2001-09', impactEndYm: '2001-12', priority: 90 },
    { id: 'e', startYm: '2022-03', impactEndYm: '2022-10', priority: 85 },
    { id: 'f', startYm: '2015-08', impactEndYm: '2016-02', priority: 65 },
    { id: 'g', startYm: '2018-10', impactEndYm: '2018-12', priority: 55 },
  ]
  const selected = selectJourneyEvents(events, { startYm: '2001-01', endYm: '2026-08', limit: 5 })
  assert.deepEqual(selected.map((event) => event.id), ['d', 'a', 'f', 'c', 'e'])
  assert.equal(selected.some((event) => event.id === 'b'), false)
})

test('event selection drops events outside the journey range', () => {
  const events = [
    { id: 'early', startYm: '2000-03', impactEndYm: '2000-06', priority: 100 },
    { id: 'inner', startYm: '2008-09', impactEndYm: '2009-03', priority: 90 },
    { id: 'late', startYm: '2024-01', impactEndYm: '2024-06', priority: 80 },
  ]
  const selected = selectJourneyEvents(events, { startYm: '2005-01', endYm: '2012-12', limit: 5 })
  assert.deepEqual(selected.map((event) => event.id), ['inner'])
})
