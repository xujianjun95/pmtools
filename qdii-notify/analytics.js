/**
 * 「鉴往」与全站使用统计：解析前端上报的事件并写入 SQLite。
 *
 * 一个上报入口（POST /api/track，body: { event, visitor_id, duration_ms, meta }），两张表：
 * - dca_events（鉴往）：
 *   - dca_view     进入鉴往页（组件挂载时），meta: {}
 *   - dca_start    点击"启程"开始一次旅程，meta: { year, asset, amount, round_id }
 *   - dca_complete 播放到达终点进入总结页，meta: { year, asset, months, round_id }
 *   - dca_leave    切后台或离开页面的累计时长快照，meta: {}
 * - site_events（全站看板；ip 由服务端补记，仅用于独立 IP 去重，不做展示）：
 *   - page_view / page_leave  meta: { path }
 *   - project_click  meta: { project_id }
 *   - news_quickview meta: { news_id }
 *   - outbound_click meta: { url }
 *
 * duration_ms 为本页面会话累计停留时长；visit_id 标识一次页面访问（每次进入独立生成），
 * 与 visitor_id 一起用于计算人均游玩次数与平均停留时长。round_id 标识一局游戏，
 * start/complete 携带同一值，用于跨多局配对与重放去重。
 */
import Database from 'better-sqlite3'

const DCA_EVENTS = new Set(['dca_view', 'dca_start', 'dca_complete', 'dca_leave'])
const SITE_EVENTS = new Set(['page_view', 'page_leave', 'project_click', 'news_quickview', 'outbound_click'])
const EVENTS = new Set([...DCA_EVENTS, ...SITE_EVENTS])
// 旅程事件附带旅程参数与每局标识，站点事件附带路径/对象键；非白名单键一律剔除
const META_KEYS = new Set([
  'year', 'asset', 'amount', 'months', 'phase',
  'path', 'project_id', 'news_id', 'url', 'round_id',
])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const MAX_DURATION_MS = 1000 * 60 * 60 * 6 // 超过 6 小时的停留时长视为脏数据丢弃
const MAX_IP_LEN = 64 // IPv6 最长 45 字符，留余量

let insertDcaStmt = null
let insertSiteStmt = null
let batchWrite = null
let analyticsDb = null

// 独立文件，不在订阅库中建表或写入，也不占用其写锁。
export function getAnalyticsDbPath(subscriptionDbPath) {
  return `${subscriptionDbPath}.analytics.db`
}

export function openAnalyticsDb(subscriptionDbPath) {
  try {
    // 遇到埋点库锁冲突立即失败，避免同步 SQLite 等待拖住订阅 API。
    analyticsDb = new Database(getAnalyticsDbPath(subscriptionDbPath), { timeout: 0 })
    analyticsDb.pragma('journal_mode = WAL')
    // WAL + NORMAL：进程崩溃安全性与 FULL 一致，仅断电可能丢最后几条埋点；
    // 大幅减少 fsync，避免高负载写入拖慢同进程的订阅接口（spec §12）。
    analyticsDb.pragma('synchronous = NORMAL')
    initAnalyticsDb(analyticsDb)
  } catch (error) {
    closeAnalyticsDb()
    throw error
  }
}

export function closeAnalyticsDb() {
  insertDcaStmt = null
  insertSiteStmt = null
  batchWrite = null
  if (analyticsDb) {
    analyticsDb.close()
    analyticsDb = null
  }
}

export function initAnalyticsDb(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dca_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      event       TEXT NOT NULL,
      visitor_id  TEXT NOT NULL,
      visit_id    TEXT NOT NULL DEFAULT '',
      duration_ms INTEGER NOT NULL DEFAULT 0,
      meta        TEXT NOT NULL DEFAULT '{}',
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dca_events_event ON dca_events (event);
    CREATE INDEX IF NOT EXISTS idx_dca_events_visitor ON dca_events (visitor_id);
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      event       TEXT NOT NULL,
      visitor_id  TEXT NOT NULL,
      visit_id    TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      meta        TEXT NOT NULL,
      ip          TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_site_events_event_time ON site_events (event, created_at);
  `)
  insertDcaStmt = db.prepare(`
    INSERT INTO dca_events (event, visitor_id, visit_id, duration_ms, meta, created_at)
    VALUES (@event, @visitor_id, @visit_id, @duration_ms, @meta, @created_at)
  `)
  insertSiteStmt = db.prepare(`
    INSERT INTO site_events (event, visitor_id, visit_id, duration_ms, meta, ip, created_at)
    VALUES (@event, @visitor_id, @visit_id, @duration_ms, @meta, @ip, @created_at)
  `)
  batchWrite = db.transaction((list) => {
    for (const row of list) recordTrackEvent(row)
  })
}

/**
 * 解析并校验一条上报；合法返回待写入行，非法返回 null（静默丢弃，不打日志噪音）。
 * 期望 body: { event, visitor_id, duration_ms?, meta? }
 * ip 为服务端补记的来源 IP（req.ip），仅站点事件落库，用于独立 IP 去重。
 */
export function parseTrackPayload(body, ip = '') {
  const event = typeof body?.event === 'string' ? body.event : ''
  if (!EVENTS.has(event)) return null
  const visitorId = typeof body?.visitor_id === 'string' ? body.visitor_id : ''
  if (!UUID_RE.test(visitorId)) return null
  const visitId = typeof body?.visit_id === 'string' ? body.visit_id : ''
  const visit = UUID_RE.test(visitId) ? visitId : ''

  const duration = ['number', 'string'].includes(typeof body?.duration_ms) ? Number(body.duration_ms) : NaN
  const durationMs = Number.isFinite(duration) && duration >= 0 && duration <= MAX_DURATION_MS
    ? Math.round(duration)
    : 0

  const rawMeta = body?.meta
  const meta = {}
  if (rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)) {
    for (const [key, value] of Object.entries(rawMeta)) {
      if (!META_KEYS.has(key)) continue
      if (!['string', 'number', 'boolean'].includes(typeof value)) continue
      const text = String(value).slice(0, 40)
      if (text) meta[key] = text
    }
  }

  return {
    event,
    visitor_id: visitorId,
    visit_id: visit,
    duration_ms: durationMs,
    meta: JSON.stringify(meta),
    // 鉴往事件保持原状不记 IP；站点事件记录来源 IP（截断防异常值）
    ip: DCA_EVENTS.has(event) ? '' : String(ip || '').slice(0, MAX_IP_LEN),
    created_at: new Date().toISOString(),
  }
}

/** 写入一条已通过 parseTrackPayload 校验的事件（按事件类型分流到 dca_events / site_events） */
export function recordTrackEvent(row) {
  if (!insertDcaStmt || !insertSiteStmt) throw new Error('analytics 表未初始化，请先调用 initAnalyticsDb')
  if (DCA_EVENTS.has(row.event)) {
    insertDcaStmt.run({
      event: row.event,
      visitor_id: row.visitor_id,
      visit_id: row.visit_id,
      duration_ms: row.duration_ms,
      meta: row.meta,
      created_at: row.created_at,
    })
  } else {
    insertSiteStmt.run({
      event: row.event,
      visitor_id: row.visitor_id,
      visit_id: row.visit_id,
      duration_ms: row.duration_ms,
      meta: row.meta,
      ip: row.ip,
      created_at: row.created_at,
    })
  }
}

/** 同一批上报（≤20 条）单事务写入，降低高负载下的落盘开销 */
export function recordTrackEvents(rows) {
  if (!insertDcaStmt || !insertSiteStmt || !batchWrite) throw new Error('analytics 表未初始化，请先调用 initAnalyticsDb')
  batchWrite(rows)
}
