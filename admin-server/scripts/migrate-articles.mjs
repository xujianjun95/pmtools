#!/usr/bin/env node
/**
 * 一次性迁移脚本（spec §10.1）：OSS manifest → SQLite articles 表。
 *
 * 用法（在 admin-server/ 目录下运行）：
 *   node scripts/migrate-articles.mjs [--manifest <url|本地路径>] [--db <sqlite路径>]
 *                                     [--dry-run] [--overwrite] [--force]
 *
 * 行为约定：
 * - 保留原 id、发布日期、标签、摘要、封面；默认迁移为已上架（保持线上现状）。
 * - 正文内相对图片路径（含 Obsidian ![[图片.png]] 写法）统一转为 OSS 绝对 URL，图片文件不动。
 * - 重跑遇同 ID 默认跳过；--overwrite 显式覆盖，但后台已修改过的记录
 *   （updated_at ≠ created_at）仍跳过，--force 才强行覆盖。
 * - 逐篇独立事务 + 断点日志：半途失败可直接重跑续传。
 * - 迁移期间冻结旧发布脚本 npm run articles:publish（约定，脚本不强制）。
 *
 * 本脚本只应跑本地/演练库；生产迁移在服务器侧执行（Phase 8）。
 */
import Database from 'better-sqlite3'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DEFAULT_MANIFEST_URL =
  'https://pmtools27.oss-cn-beijing.aliyuncs.com/articles/articles.json'
const DEFAULT_DB_PATH = path.join(__dirname, '..', 'articles.db')
const FETCH_TIMEOUT_MS = 15_000

// ---- 参数解析 ----
const args = process.argv.slice(2)
function argValue(name) {
  const i = args.indexOf(name)
  return i !== -1 && args[i + 1] ? args[i + 1] : null
}
const hasFlag = (name) => args.includes(name)

const manifestSource = argValue('--manifest') || DEFAULT_MANIFEST_URL
const dbPath = argValue('--db') || DEFAULT_DB_PATH
const dryRun = hasFlag('--dry-run')
const overwrite = hasFlag('--overwrite')
const force = hasFlag('--force')

const log = (...m) => console.log('[migrate]', ...m)

// ---- URL / 路径工具 ----
/** 只编码 URL path 段，保留完整 URL 的 scheme/host 与查询串。 */
function encodePathSegment(segment) {
  try {
    return encodeURIComponent(decodeURIComponent(segment))
  } catch {
    return encodeURIComponent(segment)
  }
}

export function encodeUrlPath(url) {
  const raw = String(url || '')
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw)
      parsed.pathname = parsed.pathname
        .split('/')
        .map((segment) => (segment ? encodePathSegment(segment) : ''))
        .join('/')
      return parsed.toString()
    } catch {
      // 非法绝对 URL 交给后续 resolveUrl 校验，不把 scheme 编码成路径文字。
      return raw
    }
  }
  const suffixIndex = raw.search(/[?#]/)
  const base = suffixIndex === -1 ? raw : raw.slice(0, suffixIndex)
  const suffix = suffixIndex === -1 ? '' : raw.slice(suffixIndex)
  const encoded = base.split('/').map(encodePathSegment).join('/')
  return `${encoded}${suffix}`
}

function resolveUrl(resource, baseUrl) {
  if (!resource || typeof resource !== 'string') return ''
  try {
    return new URL(resource, baseUrl).toString()
  } catch {
    return ''
  }
}

// ---- 正文图片归一化（与原前端 normalizeArticleContent 同规则）----
const OBSIDIAN_IMAGE_RE = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g

function normalizeContent(content, assetBaseUrl) {
  if (!content || !assetBaseUrl) return content || ''
  const obsidianDone = content.replace(OBSIDIAN_IMAGE_RE, (m, resource, alt) => {
    const normalized = resource.trim().replace(/\\/g, '/')
    const fileName = normalized.split('/').pop()
    if (!fileName) return m
    const imageUrl = resolveUrl(`images/${fileName}`, assetBaseUrl)
    return imageUrl ? `![${(alt || resource).trim()}](${imageUrl})` : m
  })
  return obsidianDone.replace(MARKDOWN_IMAGE_RE, (m, alt, resource) => {
    if (/^(?:https?:|data:|\/\/|\/)/i.test(resource)) return m
    const imageUrl = resolveUrl(resource, assetBaseUrl)
    return imageUrl ? `![${alt}](${imageUrl})` : m
  })
}

// ---- 拉取 ----
async function fetchText(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

async function loadManifest() {
  if (/^https?:/i.test(manifestSource)) {
    return JSON.parse(await fetchText(manifestSource))
  }
  if (!existsSync(manifestSource)) {
    throw new Error(`manifest 本地文件不存在: ${manifestSource}`)
  }
  return JSON.parse(readFileSync(manifestSource, 'utf8'))
}

// ---- 数据库 ----
function openDb() {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
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
  return db
}

// ---- 主流程 ----
async function main() {
  log(`manifest: ${manifestSource}`)
  log(`db: ${dbPath}${dryRun ? '（dry-run 不写入）' : ''}`)

  const manifest = await loadManifest()
  const entries = Array.isArray(manifest) ? manifest : manifest?.articles
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('manifest 格式错误或没有文章条目')
  }
  const manifestBaseUrl = /^https?:/i.test(manifestSource)
    ? manifestSource
    : `file://${path.dirname(path.resolve(manifestSource))}/`

  const db = dryRun ? null : openDb()
  const selectStmt = db?.prepare('SELECT created_at, updated_at FROM articles WHERE id = ?')
  const insertStmt = db?.prepare(`
    INSERT INTO articles (id, title, summary, tags, cover, content_md, status, published_at, created_at, updated_at)
    VALUES (@id, @title, @summary, @tags, @cover, @content_md, @status, @published_at, @created_at, @updated_at)
  `)
  const updateStmt = db?.prepare(`
    UPDATE articles SET title = @title, summary = @summary, tags = @tags, cover = @cover,
      content_md = @content_md, status = @status, published_at = @published_at, updated_at = @updated_at
    WHERE id = @id
  `)

  const now = new Date().toISOString()
  const stats = { migrated: 0, skipped: 0, failed: 0 }

  for (const entry of entries) {
    const id = String(entry.id || entry.slug || '').trim()
    if (!id || !entry.title) {
      stats.failed += 1
      log(`✗ 跳过无效条目（缺 id 或 title）: ${id || '(unknown)'}`)
      continue
    }
    try {
      const contentResource = entry.contentUrl || entry.contentPath || entry.content
      if (!contentResource || typeof contentResource !== 'string') {
        throw new Error('缺少正文地址')
      }
      const inlineContent = contentResource.includes('\n')
      const contentUrl = inlineContent
        ? manifestBaseUrl
        : resolveUrl(encodeUrlPath(contentResource), manifestBaseUrl)
      const assetBaseUrl = entry.assetBaseUrl
        ? resolveUrl(entry.assetBaseUrl, manifestBaseUrl)
        : resolveUrl('.', contentUrl)

      const rawContent = inlineContent ? contentResource : await fetchText(contentUrl)
      const contentMd = normalizeContent(rawContent, assetBaseUrl)
      const cover = entry.coverUrl || entry.cover
        ? resolveUrl(encodeUrlPath(entry.coverUrl || entry.cover), manifestBaseUrl)
        : ''
      const tags = Array.isArray(entry.tags) ? JSON.stringify(entry.tags) : '[]'
      const publishedAt = entry.date ? String(entry.date) : now

      const row = {
        id,
        title: String(entry.title),
        summary: String(entry.summary || ''),
        tags,
        cover,
        content_md: contentMd,
        status: 'published',
        published_at: publishedAt,
        created_at: now,
        updated_at: now,
      }

      // 重跑防覆盖：同 ID 默认跳过；--overwrite 跳过后台已修改记录；--force 才真覆盖
      const existing = db ? selectStmt.get(id) : null
      if (existing) {
        const modifiedAfterMigrate = existing.updated_at !== existing.created_at
        if (!overwrite || (modifiedAfterMigrate && !force)) {
          stats.skipped += 1
          log(
            `↷ 跳过已有记录: ${id}${modifiedAfterMigrate ? '（后台已修改，需 --force）' : '（--overwrite 可覆盖）'}`
          )
          continue
        }
      }

      if (dryRun) {
        const imgs = [...contentMd.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map((m) => m[1])
        log(
          `[dry-run] ${id} | ${entry.title} | 日期 ${publishedAt} | 标签 ${tags} | 图片 ${imgs.length} 张 | 正文 ${contentMd.length} 字符`
        )
        stats.migrated += 1
        continue
      }

      const write = db.transaction(() => {
        if (existing) updateStmt.run(row)
        else insertStmt.run(row)
      })
      write()
      stats.migrated += 1
      log(`✓ ${existing ? '覆盖' : '写入'}: ${id} | ${entry.title}`)
    } catch (err) {
      stats.failed += 1
      log(`✗ 失败: ${id || '(unknown)'} — ${err.message}`)
    }
  }

  log(
    `完成：迁移 ${stats.migrated}，跳过 ${stats.skipped}，失败 ${stats.failed}，总计 ${entries.length}`
  )
  db?.close()
  if (stats.failed > 0) process.exitCode = 1
}

export { resolveUrl, normalizeContent }

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error('[migrate] 致命错误：', err.message)
    process.exit(1)
  })
}
