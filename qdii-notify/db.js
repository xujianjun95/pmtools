/**
 * SQLite 订阅者存储（better-sqlite3）。
 * subscribers 表：email 唯一，token 用于退订链接鉴权，active 控制是否接收通知。
 */
import Database from 'better-sqlite3'
import { randomBytes } from 'node:crypto'
import { config } from './config.js'

let db = null

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
  `)
  return db
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}

export function generateToken() {
  return randomBytes(24).toString('hex')
}

/**
 * 订阅（幂等）：
 * - 若已存在：重新激活为订阅状态，复用原有 token（旧邮件中的退订链接保持有效）
 * - 若不存在：新增，返回 { existed: false }
 */
export function subscribe(email) {
  const d = initDb()
  const now = new Date().toISOString()
  const existing = d.prepare('SELECT * FROM subscribers WHERE email = ?').get(email)
  if (existing) {
    d.prepare(
      'UPDATE subscribers SET active = 1, unsubscribed_at = NULL WHERE email = ?'
    ).run(email)
    return { existed: true, token: existing.token }
  }
  const token = generateToken()
  d.prepare(
    'INSERT INTO subscribers (email, token, active, created_at) VALUES (?, ?, 1, ?)'
  ).run(email, token, now)
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

/** 获取所有订阅中的邮箱（含 token，供退订链接使用） */
export function listActiveEmails() {
  const d = initDb()
  return d.prepare('SELECT email, token FROM subscribers WHERE active = 1').all()
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
