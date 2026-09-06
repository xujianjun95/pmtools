/**
 * 看板聚合测试：fixture 库 + HTTP 集成（登录 → stats 端点）。
 * 覆盖口径：distinct 去重、次均停留 MAX 去重、北京时间日期边界、
 * 鉴往 round_id 配对/重放去重/旧数据顺序配对/中途退出、累计与区间、零值与分区失败。
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'

const DIR = mkdtempSync(join(tmpdir(), 'admin-stats-'))
const TEST_PASSWORD = ['pmtools', 'test', randomUUID().slice(0, 8)].join('-')
const TEST_SECRET = ['session', 'secret', randomUUID()].join('-')
const ORIGIN = 'http://localhost:5173'
const ANALYTICS_DB_PATH = join(DIR, 'analytics.db')
const SUBS_DB_PATH = join(DIR, 'subscribers.db')

process.env.ADMIN_PASSWORD = TEST_PASSWORD
process.env.SESSION_SECRET = TEST_SECRET
process.env.DB_PATH = join(DIR, 'articles.db')
process.env.QDII_DB_PATH = SUBS_DB_PATH
process.env.QDII_ANALYTICS_DB_PATH = ANALYTICS_DB_PATH
process.env.ADMIN_ALLOWED_ORIGINS = ORIGIN

const { createApp, closeStatsDbs } = await import('./server.js')
const { getSummary, parseDays, beijingDate, getDca } = await import('./stats.js')
const { createArticle } = await import('./articles.js')
const { config } = await import('./config.js')

const HOUR = 3600 * 1000
const T_NOW = Date.now() - HOUR
const T_10D = Date.now() - 10 * 24 * HOUR
const T_20D = Date.now() - 20 * 24 * HOUR
const iso = (t) => new Date(t).toISOString()

// 事件 meta 常量（fixture 复用）
const M_HOME = JSON.stringify({ path: '/' })
const M_FOO_DETAIL = JSON.stringify({ path: '/project/foo' })
const M_BAR_DETAIL = JSON.stringify({ path: '/project/bar' })
const M_CLICK_FOO = JSON.stringify({ project_id: 'foo' })
const M_CLICK_BAR = JSON.stringify({ project_id: 'bar' })
const M_NEWS1 = JSON.stringify({ news_id: 'n1' })
const M_NEWS2 = JSON.stringify({ news_id: 'n2' })
const M_OUT = JSON.stringify({ url: 'https://github.com/x' })
const M_R1 = JSON.stringify({ round_id: 'r1' })
const M_R2 = JSON.stringify({ round_id: 'r2' })
const M_R3 = JSON.stringify({ round_id: 'r3' })
const M_R0 = JSON.stringify({ round_id: 'r0' })
const M_EMPTY = '{}'

function buildFixtures() {
  const analytics = new Database(ANALYTICS_DB_PATH, { timeout: 0 })
  analytics.exec(`
    CREATE TABLE site_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      visit_id TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      meta TEXT NOT NULL,
      ip TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)
  analytics.exec(`
    CREATE TABLE dca_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      visit_id TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      meta TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)
  const se = analytics.prepare(
    `INSERT INTO site_events (event, visitor_id, visit_id, duration_ms, meta, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  // 全站：pv/uv/ip（10 天前的记录不进 7 天窗口）
  se.run('page_view', 'v1', 'v1', 0, M_HOME, '1.1.1.1', iso(T_NOW))
  se.run('page_view', 'v1', 'v1', 0, M_FOO_DETAIL, '1.1.1.1', iso(T_NOW))
  se.run('page_view', 'v2', 'v2', 0, M_HOME, '2.2.2.2', iso(T_NOW))
  se.run('page_view', 'v1', 'v1', 0, M_HOME, '1.1.1.1', iso(T_10D))
  // 停留：v1 两次 leave 取 MAX=3000，v2 一次 5000 → 次均 (3000+5000)/2 = 4000
  se.run('page_leave', 'v1', 'v1', 1000, M_HOME, '', iso(T_NOW))
  se.run('page_leave', 'v1', 'v1', 3000, M_HOME, '', iso(T_NOW))
  se.run('page_leave', 'v2', 'v2', 5000, M_HOME, '', iso(T_NOW))
  // 造物：卡片点击、详情访问、详情停留
  se.run('project_click', 'v1', 'v1', 0, M_CLICK_FOO, '', iso(T_NOW))
  se.run('project_click', 'v2', 'v2', 0, M_CLICK_FOO, '', iso(T_NOW))
  se.run('project_click', 'v2', 'v2', 0, M_CLICK_BAR, '', iso(T_NOW))
  se.run('page_view', 'v2', 'v2', 0, M_BAR_DETAIL, '2.2.2.2', iso(T_NOW))
  se.run('page_leave', 'v1', 'v1', 2000, M_FOO_DETAIL, '', iso(T_NOW))
  // 新闻与外链（外链放在 10 天前：7 天窗口内应为 0，累计口径可见）
  se.run('news_quickview', 'v1', 'v1', 0, M_NEWS1, '', iso(T_NOW))
  se.run('news_quickview', 'v2', 'v2', 0, M_NEWS1, '', iso(T_NOW))
  se.run('news_quickview', 'v2', 'v2', 0, M_NEWS2, '', iso(T_NOW))
  se.run('outbound_click', 'v1', 'v1', 0, M_OUT, '', iso(T_10D))
  se.run('outbound_click', 'v2', 'v2', 0, M_OUT, '', iso(T_10D))

  // 鉴往：round_id 配对、重放去重、中途退出、旧数据顺序配对、跨窗口
  const de = analytics.prepare(
    `INSERT INTO dca_events (event, visitor_id, visit_id, duration_ms, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
  de.run('dca_start', 'v1', 'v1', 1000, M_R1, iso(T_NOW))
  de.run('dca_start', 'v1', 'v1', 1000, M_R1, iso(T_NOW)) // 重放，应去重
  de.run('dca_complete', 'v1', 'v1', 61000, M_R1, iso(T_NOW)) // 局时长 60000
  de.run('dca_start', 'v1', 'v1', 70000, M_R2, iso(T_NOW)) // 中途退出
  de.run('dca_start', 'v2', 'v2', 0, M_R3, iso(T_NOW))
  de.run('dca_complete', 'v2', 'v2', 45000, M_R3, iso(T_NOW)) // 局时长 45000
  de.run('dca_start', 'v3', 'v3', 5000, M_EMPTY, iso(T_NOW)) // 旧数据：无 round_id，顺序配对
  de.run('dca_complete', 'v3', 'v3', 25000, M_EMPTY, iso(T_NOW)) // 局时长 20000
  de.run('dca_start', 'v4', 'v4', 0, M_EMPTY, iso(T_NOW)) // 旧数据中途退出
  de.run('dca_start', 'v0', 'v0', 0, M_R0, iso(T_20D)) // 窗口外
  de.run('dca_complete', 'v0', 'v0', 100000, M_R0, iso(T_20D))
  analytics.close()

  const subs = new Database(SUBS_DB_PATH, { timeout: 0 })
  subs.exec(`
    CREATE TABLE subscribers (
      email TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      active INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      unsubscribed_at TEXT
    );
  `)
  const sub = subs.prepare(
    `INSERT INTO subscribers (email, token, active, created_at) VALUES (?, ?, ?, ?)`
  )
  sub.run('a@x.com', 't1', 1, iso(T_NOW))
  sub.run('b@x.com', 't2', 1, iso(T_NOW))
  sub.run('c@x.com', 't3', 0, iso(T_NOW))
  sub.run('d@x.com', 't4', 0, iso(T_NOW))
  sub.run('e@x.com', 't5', 0, iso(T_NOW))
  subs.close()

  // 前台可见性 fixture：一篇上架 + 一篇草稿
  createArticle({ id: 'pub-1', title: '已上架', status: 'published', content_md: '正文' })
  createArticle({ id: 'draft-1', title: '草稿' })
}

async function loginAndCall(path, options = {}) {
  return fetch(`${base}${path}`, { headers: { Cookie: sessionCookie, Origin: ORIGIN }, ...options })
}

let server, base, sessionCookie

before(async () => {
  buildFixtures()
  server = createApp().listen(0, '127.0.0.1')
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}/background-api`
  // 整个文件共用一次登录（登录限流 10 次/分钟，逐用例登录会撞限）
  const login = await fetch(`${base}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ password: TEST_PASSWORD }),
  })
  assert.equal(login.status, 200)
  sessionCookie = (login.headers.get('set-cookie') || '').split(';')[0]
})

after(() => {
  closeStatsDbs()
  return new Promise((r) => server.close(r))
})

test('公开文章端点：仅上架可见，草稿 404', async () => {
  const list = await (await fetch(`${base}/articles`)).json()
  assert.deepEqual(list.articles.map((a) => a.id), ['pub-1'])

  const draft = await fetch(`${base}/articles/draft-1`)
  assert.equal(draft.status, 404)
})

test('summary：distinct 去重 + 次均停留 MAX 去重 + 北京时间趋势', async () => {
  const body = await (await loginAndCall('/admin/stats/summary?days=7')).json()
  assert.equal(body.ok, true)
  assert.equal(body.pv, 4) // 首页×2 + /project/foo + /project/bar
  assert.equal(body.uv, 2)
  assert.equal(body.ip, 2)
  assert.equal(body.avgDwellMsPerVisit, 5000) // (首页 3000+5000 + 详情 2000) ÷ 2 个 visit
  assert.equal(body.homepage.pv, 2)
  assert.equal(body.homepage.avgDwellMs, 4000)
  assert.equal(body.range.startLabel, beijingDate(iso(T_10D)))
  const today = beijingDate(iso(T_NOW))
  assert.deepEqual(
    body.trend.map((r) => ({ d: r.d, pv: r.pv, uv: r.uv })),
    [{ d: today, pv: 4, uv: 2 }]
  )
})

test('summary：累计（days=0）纳入窗口外记录并标注起始日', async () => {
  const body = await (await loginAndCall('/admin/stats/summary?days=0')).json()
  assert.equal(body.pv, 5)
  assert.equal(body.range.startLabel, beijingDate(iso(T_10D)))
})

test('days 参数非法时回落 7 天', async () => {
  const bad = await (await loginAndCall('/admin/stats/summary?days=abc')).json()
  const week = await (await loginAndCall('/admin/stats/summary?days=7')).json()
  assert.equal(bad.pv, week.pv)
  assert.equal(parseDays('abc'), 7)
})

test('projects：卡片点击与详情访问/停留分开统计', async () => {
  const body = await (await loginAndCall('/admin/stats/projects?days=7')).json()
  assert.deepEqual(body.clicks, [
    { projectId: 'foo', clicks: 2 },
    { projectId: 'bar', clicks: 1 },
  ])
  const foo = body.details.find((d) => d.path === '/project/foo')
  const bar = body.details.find((d) => d.path === '/project/bar')
  assert.equal(foo.visits, 1)
  assert.equal(foo.avgDwellMs, 2000)
  assert.equal(bar.visits, 1)
  assert.equal(bar.avgDwellMs, 0)
})

test('qdii：实时快照，不随时间筛选变化', async () => {
  const a = await (await loginAndCall('/admin/stats/qdii?days=7')).json()
  const b = await (await loginAndCall('/admin/stats/qdii?days=0')).json()
  assert.deepEqual(a, { ok: true, section: 'qdii', snapshot: true, total: 5, active: 2, unsubscribed: 3 })
  assert.deepEqual(b, a)
})

test('dca：round_id 配对 + 重放去重 + 中途退出计次不计时长 + 旧数据顺序配对', async () => {
  const body = await (await loginAndCall('/admin/stats/dca?days=7')).json()
  // 局数：r1、r2、r3（新）+ 2 局旧数据 = 5；完成：r1(60000)+r3(45000)+旧(20000) = 3 局，共 125000ms
  assert.equal(body.players, 4)
  assert.equal(body.totalRounds, 5)
  assert.equal(body.completedRounds, 3)
  assert.equal(body.avgRoundsPerPlayer, 1.25)
  assert.equal(body.avgDurationPerPlayerMs, Math.round(125000 / 4))
  assert.equal(body.avgDurationPerRoundMs, Math.round(125000 / 3))
})

test('dca：累计口径纳入窗口外对局', async () => {
  const body = await (await loginAndCall('/admin/stats/dca?days=0')).json()
  assert.equal(body.totalRounds, 6)
  assert.equal(body.completedRounds, 4)
  assert.equal(body.avgDurationPerPlayerMs, Math.round(225000 / 5))
})

test('content：零值与 TOP 列表并存（数据为零 ≠ 读取失败）', async () => {
  const week = await (await loginAndCall('/admin/stats/content?days=7')).json()
  assert.equal(week.ok, true)
  assert.equal(week.newsTotal, 3)
  assert.deepEqual(week.topNews, [
    { newsId: 'n1', clicks: 2 },
    { newsId: 'n2', clicks: 1 },
  ])
  assert.equal(week.outboundTotal, 0) // 外链都在 10 天前
  assert.deepEqual(week.topOutbound, [])

  const all = await (await loginAndCall('/admin/stats/content?days=0')).json()
  assert.equal(all.outboundTotal, 2)
  assert.deepEqual(all.topOutbound, [{ url: 'https://github.com/x', clicks: 2 }])
})

test('模块级：分区数据源不可用时抛错（由路由层转为错误态）', async () => {
  closeStatsDbs() // 先释放已缓存的连接，路径切换才会生效
  const saved = config.qdii.analyticsDbPath
  config.qdii.analyticsDbPath = join(DIR, 'not-exist.db')
  try {
    assert.throws(() => getSummary(7))
    assert.throws(() => getDca(7))
  } finally {
    config.qdii.analyticsDbPath = saved
    closeStatsDbs()
  }
  // 恢复后重新打开可用
  const again = getSummary(7)
  assert.equal(again.pv, 4)
})
