/**
 * 「鉴往」使用统计：解析前端上报的事件并写入 SQLite（dca_events 表）。
 *
 * 上报事件（POST /api/track，body: { event, visitor_id, duration_ms, meta }）：
 * - dca_view     进入鉴往页（组件挂载时），meta: {}
 * - dca_start    点击"启程"开始一次旅程，meta: { year, asset, amount }
 * - dca_complete 播放到达终点进入总结页，meta: { year, asset, months }
 * - dca_leave    切后台或离开页面的累计时长快照，meta: {}
 *
 * duration_ms 为本页面会话累计停留时长；visit_id 标识一次页面访问（每次进入独立生成），
 * 与 visitor_id 一起用于计算人均游玩次数与平均停留时长。
 */
import Database from 'better-sqlite3'

const EVENTS = new Set(['dca_view', 'dca_start', 'dca_complete', 'dca_leave'])
// 旅程开始事件附带旅程参数，便于后续看"大家爱从哪年开始、投多少钱"
const META_KEYS = new Set(['year', 'asset', 'amount', 'months', 'phase'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const MAX_DURATION_MS = 1000 * 60 * 60 * 6 // 超过 6 小时的停留时长视为脏数据丢弃

let insertStmt = null
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
    initAnalyticsDb(analyticsDb)
  } catch (error) {
    closeAnalyticsDb()
    throw error
  }
}

export function closeAnalyticsDb() {
  insertStmt = null
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
  insertStmt = db.prepare(`
    INSERT INTO dca_events (event, visitor_id, visit_id, duration_ms, meta, created_at)
    VALUES (@event, @visitor_id, @visit_id, @duration_ms, @meta, @created_at)
  `)
}

/**
 * 解析并校验一条上报；合法返回待写入行，非法返回 null（静默丢弃，不打日志噪音）。
 * 期望 body: { event, visitor_id, duration_ms?, meta? }
 */
export function parseTrackPayload(body) {
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
    created_at: new Date().toISOString(),
  }
}

/** 写入一条已通过 parseTrackPayload 校验的事件 */
export function recordTrackEvent(row) {
  if (!insertStmt) throw new Error('analytics 表未初始化，请先调用 initAnalyticsDb')
  insertStmt.run(row)
}
