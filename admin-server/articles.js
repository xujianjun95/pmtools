/**
 * 文章库访问与业务规则（spec §4.1/§7.3/§8）。
 * 全部 SQL 使用参数绑定；校验与门禁逻辑独立成纯函数便于测试。
 */
import { config } from './config.js'
import { getDb } from './db.js'
import MarkdownIt from 'markdown-it'

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/
const MAX_TITLE = 200
const MAX_SUMMARY = 500
const MAX_TAGS = 10
const MAX_TAG_LEN = 30
const MAX_CONTENT_CHARS = 300_000
const MAX_REFERENCED_IMAGES = 30
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const UTC_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

const nowIso = () => new Date().toISOString()

function isSafePublishedAt(value) {
  const text = String(value || '').trim()
  if (DATE_ONLY_RE.test(text)) {
    const timestamp = Date.parse(`${text}T00:00:00.000Z`)
    if (!Number.isFinite(timestamp)) return false
    return new Date(timestamp).toISOString().slice(0, 10) === text
  }
  if (!UTC_ISO_RE.test(text)) return false
  const timestamp = Date.parse(text)
  if (!Number.isFinite(timestamp)) return false
  const canonical = new Date(timestamp).toISOString()
  return canonical === (text.endsWith('Z') && !text.includes('.') ? text.replace(/Z$/, '.000Z') : text)
}

/** 解析 tags：接受字符串数组，返回规范化 JSON 串；非法返回 null */
export function normalizeTags(input) {
  if (input === undefined || input === null || input === '') return '[]'
  if (!Array.isArray(input)) return null
  if (input.length > MAX_TAGS) return null
  const cleaned = []
  for (const tag of input) {
    if (typeof tag !== 'string') return null
    const t = tag.trim()
    if (!t || t.length > MAX_TAG_LEN) return null
    cleaned.push(t)
  }
  return JSON.stringify(cleaned)
}

/** 提取 Markdown 正文里的图片 URL（含封面），供门禁校验 */
const markdownParser = new MarkdownIt({ html: false, linkify: true, breaks: false })
markdownParser.validateLink = () => true

function collectImageTokens(tokens, urls) {
  for (const token of tokens || []) {
    if (token.type === 'image') {
      const src = token.attrGet('src')
      if (src) urls.push(src)
    }
    if (token.children?.length) collectImageTokens(token.children, urls)
  }
}

export function extractImageUrls(markdown) {
  const urls = []
  collectImageTokens(markdownParser.parse(String(markdown || ''), {}), urls)
  return urls
}

/**
 * 图片 URL 是否指向本站 OSS（spec §8 目录限定 + §10 迁移兼容）：
 * - 上传图片一律在 articles/images/<article-id>/ 下（由 oss.js 强制）；
 * - 迁移旧文的图片保留原路径 articles/<id>/images/，不移动文件，
 *   故门禁放宽为"本 bucket 的 /articles/ 前缀即视为就位"。
 */
export function isOssImageUrl(url) {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    const host = `${config.oss.bucket}.${config.oss.region}.aliyuncs.com`
    if (u.hostname !== host) return false
    return u.pathname.startsWith('/articles/')
  } catch {
    return false
  }
}

/**
 * 发布门禁（spec §7.3）：正文引用图片（去重）+ 封面必须全部就位（OSS URL）。
 * 未上传完成的占位（pending: 等）不是 OSS URL，自然被拦。
 */
export function checkImagesReady(markdown, cover) {
  const refs = [...new Set(extractImageUrls(markdown))]
  if (cover) refs.push(cover)
  const offenders = refs.filter((u) => !isOssImageUrl(u))
  const tooMany = refs.length > MAX_REFERENCED_IMAGES
  return {
    ok: offenders.length === 0 && !tooMany,
    offenders,
    referencedCount: refs.length,
    message: tooMany
      ? `正文引用图片 ${refs.length} 张，超出上限 ${MAX_REFERENCED_IMAGES}`
      : `存在未就位的图片：${offenders.slice(0, 3).join(', ')}`,
  }
}

/** 创建/更新入参校验；返回 { ok, errors, fields } */
export function validateArticleInput(input, { partial = false } = {}) {
  const errors = []
  const fields = {}

  if (!partial || input.id !== undefined) {
    const id = String(input.id || '').trim()
    if (!SLUG_RE.test(id)) errors.push(`slug 只允许小写字母/数字/短横线（1-64 位）: "${id}"`)
    else fields.id = id
  }
  if (!partial || input.title !== undefined) {
    const title = String(input.title ?? '').trim()
    if (!title || title.length > MAX_TITLE) errors.push(`标题必填且不超过 ${MAX_TITLE} 字`)
    else fields.title = title
  }
  if (input.summary !== undefined) {
    const summary = String(input.summary ?? '').trim()
    if (summary.length > MAX_SUMMARY) errors.push(`摘要不超过 ${MAX_SUMMARY} 字`)
    else fields.summary = summary
  }
  if (input.tags !== undefined) {
    const tags = normalizeTags(input.tags)
    if (tags === null) errors.push(`标签最多 ${MAX_TAGS} 个、每个 1-${MAX_TAG_LEN} 字`)
    else fields.tags = tags
  }
  if (input.cover !== undefined) {
    const cover = String(input.cover ?? '').trim()
    if (cover && !isOssImageUrl(cover)) errors.push('封面必须是本站 OSS 图片地址')
    else fields.cover = cover
  }
  if (input.content_md !== undefined) {
    const content = String(input.content_md ?? '')
    if (content.length > MAX_CONTENT_CHARS) errors.push(`正文不超过 ${MAX_CONTENT_CHARS} 字符`)
    else fields.content_md = content
  }
  if (input.status !== undefined) {
    const status = String(input.status)
    if (status !== 'draft' && status !== 'published') errors.push('status 只允许 draft/published')
    else fields.status = status
  }
  if (input.published_at !== undefined) {
    if (input.published_at === null || input.published_at === '') fields.published_at = null
    else if (!isSafePublishedAt(input.published_at)) errors.push('发布日期必须是 YYYY-MM-DD 或 UTC ISO 日期')
    else fields.published_at = String(input.published_at).trim()
  }
  return { ok: errors.length === 0, errors, fields }
}

export function listPublished() {
  return getDb()
    .prepare(
      `SELECT id, title, summary, tags, cover, status, published_at, created_at, updated_at
       FROM articles WHERE status = 'published' ORDER BY published_at DESC, id`
    )
    .all()
}

export function getPublished(id) {
  return getDb()
    .prepare(
      `SELECT id, title, summary, tags, cover, content_md, status, published_at, created_at, updated_at
       FROM articles WHERE id = ? AND status = 'published'`
    )
    .get(id)
}

export function listAll() {
  return getDb()
    .prepare(
      `SELECT id, title, summary, tags, cover, status, published_at, created_at, updated_at
       FROM articles ORDER BY updated_at DESC`
    )
    .all()
}

export function getAny(id) {
  return getDb()
    .prepare(
      `SELECT id, title, summary, tags, cover, content_md, status, published_at, created_at, updated_at
       FROM articles WHERE id = ?`
    )
    .get(id)
}

/** 新建；status 允许直接 published（过门禁） */
export function createArticle(input) {
  const { ok, errors, fields } = validateArticleInput(input)
  if (!ok) return { ok: false, code: 400, errors }

  const db = getDb()
  if (db.prepare('SELECT 1 FROM articles WHERE id = ?').get(fields.id)) {
    return { ok: false, code: 409, errors: [`slug 已存在: ${fields.id}`] }
  }

  const status = fields.status === 'published' ? 'published' : 'draft'
  if (status === 'published') {
    const gate = checkImagesReady(fields.content_md || '', fields.cover || '')
    if (!gate.ok) return { ok: false, code: 400, errors: [gate.message] }
  }

  const now = nowIso()
  db.prepare(
    `INSERT INTO articles (id, title, summary, tags, cover, content_md, status, published_at, created_at, updated_at)
     VALUES (@id, @title, @summary, @tags, @cover, @content_md, @status, @published_at, @created_at, @updated_at)`
  ).run({
    id: fields.id,
    title: fields.title,
    summary: fields.summary || '',
    tags: fields.tags || '[]',
    cover: fields.cover || '',
    content_md: fields.content_md || '',
    status,
    published_at: status === 'published' ? fields.published_at || now : fields.published_at || null,
    created_at: now,
    updated_at: now,
  })
  return { ok: true, article: getAny(fields.id) }
}

/**
 * 更新：slug 不可改（spec §7.3）；上架/已上架正文修改都必须过图片门禁。
 */
export function updateArticle(id, input) {
  const existing = getAny(id)
  if (!existing) return { ok: false, code: 404, errors: ['文章不存在'] }

  if (input.id !== undefined && String(input.id) !== id) {
    return { ok: false, code: 400, errors: ['slug 创建后不可修改'] }
  }

  const { ok, errors, fields } = validateArticleInput(input, { partial: true })
  if (!ok) return { ok: false, code: 400, errors }

  const merged = {
    title: fields.title ?? existing.title,
    summary: fields.summary ?? existing.summary,
    tags: fields.tags ?? existing.tags,
    cover: fields.cover ?? existing.cover,
    content_md: fields.content_md ?? existing.content_md,
    status: fields.status ?? existing.status,
    published_at: fields.published_at !== undefined ? fields.published_at : existing.published_at,
  }

  const contentChanged = fields.content_md !== undefined && fields.content_md !== existing.content_md
  const coverChanged = fields.cover !== undefined && fields.cover !== existing.cover
  const publishTransition = existing.status !== 'published' && merged.status === 'published'
  const publishedContentEdit =
    existing.status === 'published' && merged.status === 'published' && (contentChanged || coverChanged)
  if (publishTransition || publishedContentEdit) {
    const gate = checkImagesReady(merged.content_md, merged.cover)
    if (!gate.ok) return { ok: false, code: 400, errors: [gate.message] }
  }

  const now = nowIso()
  const publishedAt = publishTransition && !merged.published_at ? now : merged.published_at
  getDb()
    .prepare(
      `UPDATE articles SET title = @title, summary = @summary, tags = @tags, cover = @cover,
       content_md = @content_md, status = @status, published_at = @published_at, updated_at = @updated_at
       WHERE id = @id`
    )
    .run({ ...merged, id, published_at: publishedAt, updated_at: now })
  return { ok: true, article: getAny(id) }
}

export function deleteArticle(id) {
  const info = getDb().prepare('DELETE FROM articles WHERE id = ?').run(id)
  return info.changes > 0
}
