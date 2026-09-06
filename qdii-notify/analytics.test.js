import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { parseTrackPayload, initAnalyticsDb, recordTrackEvent, recordTrackEvents, getAnalyticsDbPath } from './analytics.js'

const VALID_ID = '0123abcd-4567-4ef0-ab89-cdef01234567'

test('合法载荷解析：事件、访客、时长与 meta 白名单', () => {
  const row = parseTrackPayload({
    event: 'dca_start',
    visitor_id: VALID_ID,
    duration_ms: 65432.7,
    meta: { year: 2010, asset: 'ndx', amount: 1000, junk: 'x', evil: { a: 1 } },
  })
  assert.equal(row.event, 'dca_start')
  assert.equal(row.visitor_id, VALID_ID)
  assert.equal(row.duration_ms, 65433)
  assert.deepEqual(JSON.parse(row.meta), { year: '2010', asset: 'ndx', amount: '1000' })
  assert.match(row.created_at, /^\d{4}-\d{2}-\d{2}T/)
})

test('未知事件被丢弃', () => {
  assert.equal(parseTrackPayload({ event: 'bogus_page', visitor_id: VALID_ID }), null)
  assert.equal(parseTrackPayload({ event: '', visitor_id: VALID_ID }), null)
  assert.equal(parseTrackPayload({ visitor_id: VALID_ID }), null)
  assert.equal(parseTrackPayload(null), null)
})

test('站点事件解析：ip 由服务端补记，path 进 meta', () => {
  const row = parseTrackPayload(
    { event: 'page_view', visitor_id: VALID_ID, visit_id: VALID_ID, meta: { path: '/project/demo' } },
    '203.0.113.9'
  )
  assert.equal(row.event, 'page_view')
  assert.equal(row.ip, '203.0.113.9')
  assert.deepEqual(JSON.parse(row.meta), { path: '/project/demo' })
})

test('鉴往事件不落 IP（保持既有形态），round_id 进 meta', () => {
  const row = parseTrackPayload(
    { event: 'dca_start', visitor_id: VALID_ID, meta: { year: 2015, round_id: 'abc' } },
    '203.0.113.9'
  )
  assert.equal(row.ip, '')
  assert.equal(JSON.parse(row.meta).round_id, 'abc')
})

test('ip 超长截断、缺失为空串', () => {
  const long = parseTrackPayload({ event: 'outbound_click', visitor_id: VALID_ID, meta: { url: 'https://a.com' } }, 'x'.repeat(100))
  assert.equal(long.ip.length, 64)
  const none = parseTrackPayload({ event: 'news_quickview', visitor_id: VALID_ID, meta: { news_id: 'n1' } })
  assert.equal(none.ip, '')
})

test('访客 ID 必须是 UUID 形态，杜绝注入与乱值', () => {
  assert.equal(parseTrackPayload({ event: 'dca_view', visitor_id: "x'; DROP TABLE subscribers;--" }), null)
  assert.equal(parseTrackPayload({ event: 'dca_view', visitor_id: 'short' }), null)
  assert.equal(parseTrackPayload({ event: 'dca_view', visitor_id: VALID_ID.toUpperCase() }), null)
})

test('非法时长归零：负数、NaN、超 6 小时都按 0 落库', () => {
  for (const duration of [-5, NaN, Infinity, 1000 * 60 * 60 * 7, 'abc']) {
    const row = parseTrackPayload({ event: 'dca_leave', visitor_id: VALID_ID, duration_ms: duration })
    assert.equal(row.duration_ms, 0)
  }
})

test('meta 值截断到 40 字符，非白名单键剔除', () => {
  const row = parseTrackPayload({
    event: 'dca_view',
    visitor_id: VALID_ID,
    meta: { year: 'y'.repeat(100), months: 3, phase: 'completed' },
  })
  const meta = JSON.parse(row.meta)
  assert.equal(meta.year.length, 40)
  assert.equal(meta.months, '3')
  assert.equal(meta.phase, 'completed')
})

test('写入与聚合：同一访问取最大停留、访客去重', () => {
  const db = new Database(':memory:')
  initAnalyticsDb(db)
  const visit = parseTrackPayload({ event: 'dca_view', visitor_id: VALID_ID, duration_ms: 0 })
  recordTrackEvent(visit)
  recordTrackEvent(parseTrackPayload({ event: 'dca_start', visitor_id: VALID_ID, duration_ms: 1000 }))
  recordTrackEvent(parseTrackPayload({ event: 'dca_leave', visitor_id: VALID_ID, duration_ms: 8000, meta: { phase: 'playing' } }))
  recordTrackEvent(parseTrackPayload({ event: 'dca_start', visitor_id: VALID_ID, duration_ms: 12000 }))
  recordTrackEvent(parseTrackPayload({ event: 'dca_view', visitor_id: '9f8e7d6c-5b4a-4938-8271-0abcdeffedcb', duration_ms: 0 }))
  // 非法事件不落库
  // 非法事件解析为 null，不落库
  assert.equal(parseTrackPayload({ event: 'bogus', visitor_id: VALID_ID }), null)

  const n = db.prepare("SELECT COUNT(*) AS n FROM dca_events").get().n
  assert.equal(n, 5)
  const users = db.prepare('SELECT COUNT(DISTINCT visitor_id) AS n FROM dca_events').get().n
  assert.equal(users, 2)
  const starts = db.prepare("SELECT COUNT(*) AS n FROM dca_events WHERE event='dca_start'").get().n
  assert.equal(starts, 2)
  const maxStay = db.prepare(
    'SELECT MAX(duration_ms) AS ms FROM dca_events GROUP BY visitor_id, visit_id ORDER BY ms DESC LIMIT 1',
  ).get()
  assert.equal(maxStay.ms, 12000)
  db.close()
})

test('批量事务写入：dca 与站点事件分流到两张表，site_events 带 ip', () => {
  const db = new Database(':memory:')
  initAnalyticsDb(db)
  recordTrackEvents([
    parseTrackPayload({ event: 'dca_view', visitor_id: VALID_ID, duration_ms: 0 }),
    parseTrackPayload(
      { event: 'page_view', visitor_id: VALID_ID, visit_id: VALID_ID, meta: { path: '/' } },
      '198.51.100.7'
    ),
    parseTrackPayload(
      { event: 'outbound_click', visitor_id: VALID_ID, meta: { url: 'https://example.com/a' } },
      '198.51.100.7'
    ),
  ])

  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM dca_events').get().n, 1)
  const site = db.prepare('SELECT event, ip, created_at FROM site_events ORDER BY id').all()
  assert.deepEqual(site.map((r) => r.event), ['page_view', 'outbound_click'])
  assert.equal(site[0].ip, '198.51.100.7')
  assert.equal(site[1].ip, '198.51.100.7')

  // 空批次是 no-op
  recordTrackEvents([])
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM site_events').get().n, 2)
  db.close()
})

test('查询脚本使用实际玩家作分母，按独立访问取时长最大值', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { execFileSync } = await import('node:child_process')
  const { default: process } = await import('node:process')
  const directory = mkdtempSync(join(tmpdir(), 'dca-analytics-test-'))
  const path = join(directory, 'events.db')
  const db = new Database(getAnalyticsDbPath(path))
  try {
    initAnalyticsDb(db)
    const other = '9f8e7d6c-5b4a-4938-8271-0abcdeffedcb'
    const record = (event, visitor, visit, ms) => recordTrackEvent(parseTrackPayload({
      event, visitor_id: visitor, visit_id: visit, duration_ms: ms,
    }))
    record('dca_view', VALID_ID, VALID_ID, 0)
    record('dca_start', VALID_ID, VALID_ID, 0)
    record('dca_start', VALID_ID, VALID_ID, 5000)
    record('dca_leave', VALID_ID, VALID_ID, 10000)
    record('dca_leave', VALID_ID, VALID_ID, 60000)
    record('dca_start', VALID_ID, other, 0)
    record('dca_leave', VALID_ID, other, 30000)
    record('dca_view', other, other, 0)
    record('dca_leave', other, other, 0)
    const output = execFileSync(process.execPath, ['qdii-notify/query-dca-analytics.mjs'], {
      cwd: new URL('../', import.meta.url), env: { ...process.env, DB_PATH: path }, encoding: 'utf8',
    })
    assert.match(output, /使用用户数\s+: 1 人/)
    assert.match(output, /页面访问次数\s+: 3 次/)
    assert.match(output, /平均停留时长\s+: 30 秒/)
    assert.match(output, /人均游玩次数\s+: 3.00 次\/人/)
  } finally {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
