/**
 * 看板聚合（spec §6 口径表）。只读挂载 qdii-notify 的订阅库与埋点库（WAL，短事务）。
 *
 * 口径要点：
 * - UV/IP 用 distinct 计算，禁止日值相加；次均停留 = Σ(visit×path 内 MAX duration) ÷ visit 数
 * - QDII 为实时快照，不受时间筛选影响
 * - 鉴往：人均游戏时长 = Σ完成局时长 ÷ 游玩人数；每局平均耗时 = Σ完成局时长 ÷ 完成局数；
 *   完成局按 round_id 配对（旧数据无 round_id 时按 visit 内顺序配对）；中途退出计次不计时长
 * - 日期边界按北京时间（created_at 为 UTC ISO，+8 小时取日期）
 */
import Database from 'better-sqlite3'
import { config } from './config.js'

let subsDb = null
let analyticsDb = null

function openReadonly(path) {
  // fileMustExist + timeout 0：打不开立即失败走分区错误态，不做同步等待
  return new Database(path, { readonly: true, fileMustExist: true, timeout: 0 })
}

export function getSubsDb() {
  if (!subsDb) subsDb = openReadonly(config.qdii.subscribersDbPath)
  return subsDb
}

export function getAnalyticsDb() {
  if (!analyticsDb) analyticsDb = openReadonly(config.qdii.analyticsDbPath)
  return analyticsDb
}

export function closeStatsDbs() {
  if (subsDb) { subsDb.close(); subsDb = null }
  if (analyticsDb) { analyticsDb.close(); analyticsDb = null }
}

const DAY_MS = 24 * 60 * 60 * 1000
const VALID_DAYS = [7, 30, 0]

/** days 参数：7/30/累计(0)，其余值回落 7 */
export function parseDays(raw) {
  const n = Number(raw)
  return VALID_DAYS.includes(n) ? n : 7
}

export function rangeSince(days) {
  return days === 0 ? '1970-01-01T00:00:00.000Z' : new Date(Date.now() - days * DAY_MS).toISOString()
}

/** UTC ISO → 北京时间日期（YYYY-MM-DD），与 SQL 侧 datetime(+8 hours) 口径一致 */
export function beijingDate(iso) {
  return new Date(new Date(iso).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

/** 事件 meta JSON 安全解析 */
function metaOf(row) {
  try {
    const m = JSON.parse(row.meta || '{}')
    return m && typeof m === 'object' ? m : {}
  } catch {
    return {}
  }
}

// 表名不许插值进 SQL：用完整固定串的映射表（Mimosa 门禁 + 注入防御双重要求）
const MIN_CREATED_AT_SQL = {
  site_events: `SELECT MIN(created_at) AS t FROM site_events`,
  dca_events: `SELECT MIN(created_at) AS t FROM dca_events`,
}

function startLabel(db, table) {
  const row = db.prepare(MIN_CREATED_AT_SQL[table]).get()
  return row?.t ? beijingDate(row.t) : null
}

function rangeOf(days) {
  return { days, since: rangeSince(days) }
}

/** 全站流量：PV/UV/独立 IP/次均停留 + 首页 + 按北京时间日期的趋势 */
export function getSummary(days) {
  const db = getAnalyticsDb()
  const { since } = rangeOf(days)

  const pv = db
    .prepare(`SELECT COUNT(*) AS n FROM site_events WHERE event = 'page_view' AND created_at >= @since`)
    .get({ since }).n
  const uv = db
    .prepare(
      `SELECT COUNT(DISTINCT visitor_id) AS n FROM site_events WHERE event = 'page_view' AND created_at >= @since`
    )
    .get({ since }).n
  const ip = db
    .prepare(
      `SELECT COUNT(DISTINCT ip) AS n FROM site_events WHERE event = 'page_view' AND created_at >= @since AND ip != ''`
    )
    .get({ since }).n

  // 次均停留：visit×path 内取 MAX（累计快照去重），再求和 ÷ visit 数
  const dwellRow = db
    .prepare(
      `SELECT COALESCE(SUM(m), 0) AS total, COUNT(DISTINCT visit_id) AS visits FROM (
         SELECT MAX(duration_ms) AS m, visit_id FROM site_events
         WHERE event = 'page_leave' AND created_at >= @since GROUP BY visit_id, json_extract(meta, '$.path')
       )`
    )
    .get({ since })
  const avgDwellMsPerVisit = dwellRow.visits > 0 ? Math.round(dwellRow.total / dwellRow.visits) : 0

  const homePv = db
    .prepare(
      `SELECT COUNT(*) AS n FROM site_events
       WHERE event = 'page_view' AND created_at >= @since AND json_extract(meta, '$.path') = '/'`
    )
    .get({ since }).n
  const homeDwell = db
    .prepare(
      `SELECT COALESCE(SUM(m), 0) AS total, COUNT(DISTINCT visit_id) AS visits FROM (
         SELECT MAX(duration_ms) AS m, visit_id FROM site_events
         WHERE event = 'page_leave' AND created_at >= @since AND json_extract(meta, '$.path') = '/'
         GROUP BY visit_id, json_extract(meta, '$.path')
       )`
    )
    .get({ since })
  const homeAvgDwell = homeDwell.visits > 0 ? Math.round(homeDwell.total / homeDwell.visits) : 0

  const trend = db
    .prepare(
      `SELECT substr(datetime(created_at, '+8 hours'), 1, 10) AS d,
              COUNT(*) AS pv, COUNT(DISTINCT visitor_id) AS uv
       FROM site_events
       WHERE event = 'page_view' AND created_at >= @since
       GROUP BY d ORDER BY d`
    )
    .all({ since })

  return {
    range: { days, startLabel: startLabel(db, 'site_events') },
    pv,
    uv,
    ip,
    avgDwellMsPerVisit,
    homepage: { pv: homePv, avgDwellMs: homeAvgDwell },
    trend,
  }
}

/** 造物：卡片点击（按 project_id）、详情页访问与停留（按 path） */
export function getProjects(days) {
  const db = getAnalyticsDb()
  const { since } = rangeOf(days)

  const clicks = db
    .prepare(
      `SELECT json_extract(meta, '$.project_id') AS projectId, COUNT(*) AS clicks
       FROM site_events WHERE event = 'project_click' AND created_at >= @since
       GROUP BY projectId ORDER BY clicks DESC`
    )
    .all({ since })

  const visits = db
    .prepare(
      `SELECT json_extract(meta, '$.path') AS path, COUNT(*) AS visits
       FROM site_events WHERE event = 'page_view' AND created_at >= @since
         AND json_extract(meta, '$.path') LIKE '/project/%'
       GROUP BY path ORDER BY visits DESC`
    )
    .all({ since })

  const dwell = db
    .prepare(
      `SELECT path,
              COALESCE(SUM(m), 0) AS total, COUNT(DISTINCT visit_id) AS visits FROM (
         SELECT MAX(duration_ms) AS m, visit_id, json_extract(meta, '$.path') AS path
         FROM site_events
         WHERE event = 'page_leave' AND created_at >= @since
           AND json_extract(meta, '$.path') LIKE '/project/%'
         GROUP BY visit_id, json_extract(meta, '$.path')
       ) GROUP BY path`
    )
    .all({ since })
  const dwellByPath = new Map(dwell.map((r) => [r.path, r]))

  const details = visits.map((v) => {
    const d = dwellByPath.get(v.path)
    return {
      path: v.path,
      visits: v.visits,
      avgDwellMs: d && d.visits > 0 ? Math.round(d.total / d.visits) : 0,
    }
  })

  return { range: rangeOf(days), clicks, details }
}

/** QDII 订阅快照（不受时间筛选影响） */
export function getQdiiSnapshot() {
  const row = getSubsDb()
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END), 0) AS active,
              COALESCE(SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END), 0) AS unsubscribed
       FROM subscribers`
    )
    .get()
  return { snapshot: true, total: row.total, active: row.active, unsubscribed: row.unsubscribed }
}

/**
 * 鉴往聚合（spec §6.5）。行数在聚合前全量取出，配对在 JS 完成：
 * - 有 round_id：start/complete 按 round_id 配对（重放上报自动去重）
 * - 无 round_id（旧数据）：visit 内按时间顺序排队配对
 * - 中途退出（有 start 无 complete）计次不计时长
 */
export function getDca(days) {
  const db = getAnalyticsDb()
  const { since } = rangeOf(days)

  const rows = db
    .prepare(
      `SELECT event, visitor_id, visit_id, duration_ms, meta, created_at
       FROM dca_events WHERE event IN ('dca_start', 'dca_complete') AND created_at >= @since
       ORDER BY created_at, id`
    )
    .all({ since })

  const players = new Set(rows.filter((r) => r.event === 'dca_start').map((r) => r.visitor_id))

  const byRound = new Map() // round_id → { start, complete }
  const legacyQueue = new Map() // visit_id → 未配对 start 行队列
  let legacyStartCount = 0

  for (const row of rows) {
    const rid = metaOf(row).round_id || ''
    if (row.event === 'dca_start') {
      if (rid) {
        if (!byRound.has(rid)) byRound.set(rid, { start: row, complete: null })
      } else {
        legacyStartCount += 1
        const queue = legacyQueue.get(row.visit_id) || []
        queue.push(row)
        legacyQueue.set(row.visit_id, queue)
      }
    } else if (rid) {
      const rec = byRound.get(rid)
      if (rec && !rec.complete) rec.complete = row
    } else {
      const queue = legacyQueue.get(row.visit_id)
      if (queue && queue.length > 0) {
        const start = queue.shift()
        byRound.set(`legacy:${start.id}`, { start, complete: row })
      }
    }
  }

  let completedRounds = 0
  let totalDurationMs = 0
  let modernRounds = 0
  for (const [key, rec] of byRound) {
    if (!String(key).startsWith('legacy:')) modernRounds += 1
    if (!rec.complete) continue
    completedRounds += 1
    totalDurationMs += Math.max(0, rec.complete.duration_ms - rec.start.duration_ms)
  }
  // 旧数据每条 start 即一局（含未配对的），新数据按 round_id 去重后的局数计
  const totalRounds = modernRounds + legacyStartCount
  const playerCount = players.size
  const avgRoundsPerPlayer = playerCount > 0 ? Math.round((totalRounds / playerCount) * 100) / 100 : 0
  const avgDurationPerPlayerMs = playerCount > 0 ? Math.round(totalDurationMs / playerCount) : 0
  const avgDurationPerRoundMs = completedRounds > 0 ? Math.round(totalDurationMs / completedRounds) : 0

  return {
    range: { days, startLabel: startLabel(db, 'dca_events') },
    players: playerCount,
    totalRounds,
    avgRoundsPerPlayer,
    completedRounds,
    avgDurationPerPlayerMs,
    avgDurationPerRoundMs,
  }
}

/** 内容行为：新闻速览点击、外链跳转（TOP 10） */
export function getContent(days) {
  const db = getAnalyticsDb()
  const { since } = rangeOf(days)

  const newsTotal = db
    .prepare(`SELECT COUNT(*) AS n FROM site_events WHERE event = 'news_quickview' AND created_at >= @since`)
    .get({ since }).n
  const topNews = db
    .prepare(
      `SELECT json_extract(meta, '$.news_id') AS newsId, COUNT(*) AS clicks
       FROM site_events WHERE event = 'news_quickview' AND created_at >= @since
       GROUP BY newsId ORDER BY clicks DESC LIMIT 10`
    )
    .all({ since })

  const outboundTotal = db
    .prepare(`SELECT COUNT(*) AS n FROM site_events WHERE event = 'outbound_click' AND created_at >= @since`)
    .get({ since }).n
  const topOutbound = db
    .prepare(
      `SELECT json_extract(meta, '$.url') AS url, COUNT(*) AS clicks
       FROM site_events WHERE event = 'outbound_click' AND created_at >= @since
       GROUP BY url ORDER BY clicks DESC LIMIT 10`
    )
    .all({ since })

  return { range: rangeOf(days), newsTotal, topNews, outboundTotal, topOutbound }
}
