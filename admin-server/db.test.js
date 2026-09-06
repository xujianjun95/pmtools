/**
 * 文章库测试：建表、默认状态、主键约束、CHECK 约束、WAL。
 * 全部写入使用命名参数绑定（与生产代码同一姿势）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'admin-db-')), 'articles.db')

const { getDb, closeDb, countAll } = await import('./db.js')

const INSERT = `
  INSERT INTO articles (id, title, content_md, created_at, updated_at)
  VALUES (@id, @title, @content_md, @created_at, @updated_at)
`
const baseRow = () => ({
  id: 'hello-world',
  title: '你好世界',
  content_md: '# 正文',
  created_at: '2026-09-06T10:00:00.000Z',
  updated_at: '2026-09-06T10:00:00.000Z',
})

test('建表、插入、默认 draft、主键与 CHECK 约束', () => {
  const db = getDb()
  db.prepare(INSERT).run(baseRow())

  assert.equal(countAll(), 1)

  const row = db.prepare('SELECT * FROM articles WHERE id = ?').get('hello-world')
  assert.equal(row.status, 'draft')
  assert.equal(row.tags, '[]')

  // 主键冲突
  assert.throws(() => db.prepare(INSERT).run(baseRow()))

  // 非法 status 被 CHECK 拦截
  assert.throws(() =>
    db
      .prepare(
        `INSERT INTO articles (id, title, content_md, status, created_at, updated_at)
         VALUES (@id, @title, @content_md, @status, @created_at, @updated_at)`
      )
      .run({ ...baseRow(), id: 'bad', status: 'archived' })
  )
})

test('journal_mode 为 WAL', () => {
  assert.equal(getDb().pragma('journal_mode', { simple: true }), 'wal')
})

test('关闭后可重新打开（单例重建）', () => {
  closeDb()
  assert.equal(countAll(), 1)
})
