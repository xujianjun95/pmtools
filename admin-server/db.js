/**
 * 文章库访问：SQLite（articles.db），表结构见设计文档 §4.1。
 * 全部查询使用参数绑定；与 qdii-notify/db.js 同构的单例模式。
 */
import Database from 'better-sqlite3'
import { config } from './config.js'

let db = null

export function getDb() {
  if (!db) {
    // 写冲突快速失败：本服务是 articles.db 的唯一写者，锁等待没有意义
    db = new Database(config.dbPath, { timeout: 0 })
    db.pragma('journal_mode = WAL')
    initSchema(db)
  }
  return db
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id           TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      summary      TEXT NOT NULL DEFAULT '',
      tags         TEXT NOT NULL DEFAULT '[]',
      cover        TEXT NOT NULL DEFAULT '',
      content_md   TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
      published_at TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
  `)
}

export function countAll() {
  return getDb().prepare('SELECT COUNT(*) AS n FROM articles').get().n
}
