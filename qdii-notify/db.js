/**
 * SQLite 订阅者存储（better-sqlite3）。
 * subscribers 表：email 唯一，token 用于退订链接鉴权，active 控制是否接收通知。
 */
import Database from 'better-sqlite3'
import { createHash, randomBytes } from 'node:crypto'
import { config } from './config.js'
import { DEFAULT_REGIONS, normalizeRegions, parseRegionsJson } from './regions.js'

let db = null
const CONFETTI_MAX_BATCH = 20
const CONFETTI_MAX_PER_MINUTE = 30
const CONFETTI_WINDOW_MS = 60_000

export function initDb() {
  if (db) return db
  db = new Database(config.dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT NOT NULL UNIQUE,
      token         TEXT NOT NULL UNIQUE,
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL,
      unsubscribed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS email_verifications (
      email       TEXT PRIMARY KEY,
      code        TEXT NOT NULL,
      expires_at  TEXT NOT NULL,
      attempts    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS email_send_log (
      email TEXT NOT NULL,
      date  TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (email, date)
    );
    CREATE TABLE IF NOT EXISTS confetti_counter (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total INTEGER NOT NULL DEFAULT 0
    );
    INSERT OR IGNORE INTO confetti_counter (id, total) VALUES (1, 72852);
    CREATE TABLE IF NOT EXISTS confetti_rate (
      ip_key TEXT NOT NULL,
      counted_at INTEGER NOT NULL,
      count INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS confetti_rate_ip ON confetti_rate (ip_key);
    CREATE INDEX IF NOT EXISTS confetti_rate_time ON confetti_rate (counted_at);
  `)
  // 老库迁移：subscribers 增加 regions 列（JSON 数组文本），存量行默认全地区，行为不变
  const columns = db.prepare('PRAGMA table_info(subscribers)').all()
  if (!columns.some((column) => column.name === 'regions')) {
    const defaultJson = JSON.stringify(DEFAULT_REGIONS)
    db.exec(
      `ALTER TABLE subscribers ADD COLUMN regions TEXT NOT NULL DEFAULT '${defaultJson}'`
    )
  }
  return db
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}

export function getConfettiTotal() {
  return initDb().prepare('SELECT total FROM confetti_counter WHERE id = 1').get().total
}

export function countConfetti(ip, requested, now = Date.now()) {
  if (!Number.isSafeInteger(requested) || requested <= 0) return getConfettiTotal()

  const database = initDb()
  const ipKey = createHash('sha256').update(ip).digest('hex')
  // Take the write lock before checking the rolling limit. Counting and incrementing
  // commit together, even when multiple connections submit for the same IP.
  return database.transaction(() => {
    database.prepare('DELETE FROM confetti_rate WHERE counted_at <= ?').run(now - CONFETTI_WINDOW_MS)
    const { used } = database.prepare(
      'SELECT COALESCE(SUM(count), 0) AS used FROM confetti_rate WHERE ip_key = ?'
    ).get(ipKey)
    const accepted = Math.min(requested, CONFETTI_MAX_BATCH, CONFETTI_MAX_PER_MINUTE - used)
    if (accepted <= 0) return getConfettiTotal()

    database.prepare('INSERT INTO confetti_rate (ip_key, counted_at, count) VALUES (?, ?, ?)')
      .run(ipKey, now, accepted)
    return database.prepare(
      'UPDATE confetti_counter SET total = total + ? WHERE id = 1 RETURNING total'
    ).get(accepted).total
  }).immediate()
}

export function generateToken() {
  return randomBytes(24).toString('hex')
}

/**
 * 订阅（幂等）：
 * - 若已存在：重新激活为订阅状态并更新地区选择，复用原有 token（旧邮件中的退订链接保持有效）
 * - 若不存在：新增，返回 { existed: false }
 * regions 为用户勾选的地区 id 数组；非法或缺省按全地区处理。
 */
export function subscribe(email, regions = DEFAULT_REGIONS) {
  const d = initDb()
  const normalized = normalizeRegions(regions) || [...DEFAULT_REGIONS]
  const regionsJson = JSON.stringify(normalized)
  const now = new Date().toISOString()
  const existing = d.prepare('SELECT * FROM subscribers WHERE email = ?').get(email)
  if (existing) {
    d.prepare(
      'UPDATE subscribers SET active = 1, unsubscribed_at = NULL, regions = ? WHERE email = ?'
    ).run(regionsJson, email)
    return { existed: true, token: existing.token }
  }
  const token = generateToken()
  d.prepare(
    'INSERT INTO subscribers (email, token, active, created_at, regions) VALUES (?, ?, 1, ?, ?)'
  ).run(email, token, now, regionsJson)
  return { existed: false, token }
}

/** 退订：仅 token 匹配且邮箱一致时生效，返回是否成功 */
export function unsubscribe(token) {
  const d = initDb()
  const row = d.prepare('SELECT * FROM subscribers WHERE token = ?').get(token)
  if (!row) return false
  d.prepare(
    "UPDATE subscribers SET active = 0, unsubscribed_at = ? WHERE token = ?"
  ).run(new Date().toISOString(), token)
  return true
}

/** 查询某个邮箱是否处于订阅状态 */
export function isSubscribed(email) {
  const d = initDb()
  const row = d.prepare('SELECT active FROM subscribers WHERE email = ?').get(email)
  return Boolean(row && row.active === 1)
}

/** 查询某个邮箱的地区选择；未订阅返回 null */
export function getRegionsByEmail(email) {
  const d = initDb()
  const row = d.prepare('SELECT regions FROM subscribers WHERE email = ?').get(email)
  return row ? parseRegionsJson(row.regions) : null
}

/** 获取所有订阅中的邮箱（含 token 供退订链接、regions 供按地区过滤发信） */
export function listActiveEmails() {
  const d = initDb()
  return d
    .prepare('SELECT email, token, regions FROM subscribers WHERE active = 1')
    .all()
    .map((row) => ({ email: row.email, token: row.token, regions: parseRegionsJson(row.regions) }))
}

/** 订阅总数（含已退订），用于管理统计 */
export function countAll() {
  const d = initDb()
  return d.prepare('SELECT COUNT(*) AS n FROM subscribers').get().n
}

// ---- 邮箱验证码 ----

/** 保存/覆盖验证码。attempts 不重置（跨次累计，防慢速暴力）；新码覆盖旧码 */
export function upsertEmailVerification(email, code, ttlMinutes) {
  const d = initDb()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString()
  d.prepare(
    `INSERT INTO email_verifications (email, code, expires_at, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at, created_at = excluded.created_at`
  ).run(email, code, expiresAt, now.toISOString())
}

export function getEmailVerification(email) {
  const d = initDb()
  return d.prepare('SELECT * FROM email_verifications WHERE email = ?').get(email)
}

export function incrementVerificationAttempts(email) {
  const d = initDb()
  d.prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE email = ?').run(email)
}

export function deleteEmailVerification(email) {
  const d = initDb()
  d.prepare('DELETE FROM email_verifications WHERE email = ?').run(email)
}

/** 当天已发验证码次数 */
export function getTodayEmailSendCount(email) {
  const d = initDb()
  const today = new Date().toISOString().slice(0, 10)
  const row = d
    .prepare('SELECT count FROM email_send_log WHERE email = ? AND date = ?')
    .get(email, today)
  return row ? row.count : 0
}

export function incrementEmailSendCount(email) {
  const d = initDb()
  const today = new Date().toISOString().slice(0, 10)
  d.prepare(
    `INSERT INTO email_send_log (email, date, count) VALUES (?, ?, 1)
     ON CONFLICT(email, date) DO UPDATE SET count = count + 1`
  ).run(email, today)
}
