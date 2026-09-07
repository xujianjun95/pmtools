import YAML from 'yaml'
import { fromMarkdown } from 'mdast-util-from-markdown'

const OBSIDIAN_IMAGE_RE = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

function formatBeijingDate(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

/** 将 frontmatter 日期统一为北京时间自然日，避免把带时区值直接写入日期字段。 */
export function normalizeImportDate(value) {
  const text = String(value || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const timestamp = Date.parse(`${text}T00:00:00.000Z`)
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === text ? text : ''
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(text)) return ''
  const timestamp = Date.parse(text)
  return Number.isFinite(timestamp) ? formatBeijingDate(new Date(timestamp)) : ''
}

/** 解析一期导入支持的 YAML frontmatter，保留正文原文。 */
export function parseMarkdownFile(text) {
  let body = String(text || '')
  const meta = {}
  const notes = []
  const fm = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/.exec(body)
  if (fm) {
    body = body.slice(fm[0].length)
    try {
      const document = YAML.parseDocument(fm[1], { schema: 'core', uniqueKeys: true })
      if (document.errors.length > 0) {
        notes.push('YAML frontmatter 格式异常，已保留正文，请检查元数据')
      } else {
        const parsed = document.toJS({ mapAsMap: false })
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          if (typeof parsed.title === 'string') meta.title = parsed.title.trim()
          if (typeof parsed.date === 'string') {
            const date = normalizeImportDate(parsed.date)
            if (date) meta.date = date
            else notes.push('日期格式无效，已忽略；请使用 YYYY-MM-DD')
          }
          if (typeof parsed.summary === 'string') meta.summary = parsed.summary.trim()
          if (Array.isArray(parsed.tags)) {
            meta.tags = parsed.tags.filter((tag) => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean)
          } else if (typeof parsed.tags === 'string' && parsed.tags.trim()) {
            meta.tags = [parsed.tags.trim()]
          }
        }
      }
    } catch {
      notes.push('YAML frontmatter 格式异常，已保留正文，请检查元数据')
    }
  }
  if (/\[\[[^\]|!][^\]]*\]\]/.test(body)) notes.push('内部双链 [[笔记]] 不支持，已原样保留')
  if (/^>\s*\[!.*/m.test(body)) notes.push('Callout 不支持，已原样保留')
  if (/\[\^[^\]]+\]/.test(body)) notes.push('脚注不支持，已原样保留')
  if (/^\|.+\|$/m.test(body) && /^\|?[\s:|-]+\|?$/m.test(body)) notes.push('表格请在编辑器中补写排版')
  return { meta, body, notes }
}

export function normalizeImportPath(value) {
  let text = String(value || '').trim().replace(/^<|>$/g, '').replaceAll('\\', '/')
  try {
    text = decodeURIComponent(text)
  } catch {
    // 保留无法解码的原始路径，后续按缺失文件处理。
  }
  return text.replace(/^\.\/+/, '').replace(/\/+/g, '/')
}

function basename(path) {
  return normalizeImportPath(path).split('/').pop().toLowerCase()
}

/** 建立相对路径索引；basename 歧义时返回 ambiguous，禁止静默猜测。 */
export function createImportFileIndex(files, markdownFile) {
  const byPath = new Map()
  const byBase = new Map()
  const mdPath = normalizeImportPath(markdownFile?.webkitRelativePath || markdownFile?.name)
  const mdDir = mdPath.includes('/') ? mdPath.slice(0, mdPath.lastIndexOf('/')) : ''
  const add = (map, key, file) => {
    if (!key) return
    const list = map.get(key) || []
    if (!list.includes(file)) list.push(file)
    map.set(key, list)
  }
  for (const file of files || []) {
    const rawPath = normalizeImportPath(file.webkitRelativePath || file.name)
    const keys = new Set([rawPath, normalizeImportPath(file.name)])
    if (mdDir && rawPath.startsWith(`${mdDir}/`)) keys.add(rawPath.slice(mdDir.length + 1))
    for (const key of keys) add(byPath, key.toLowerCase(), file)
    add(byBase, basename(rawPath), file)
  }
  return {
    resolve(resource) {
      const key = normalizeImportPath(resource).toLowerCase()
      const exact = byPath.get(key) || []
      if (exact.length === 1) return { file: exact[0], ambiguous: false }
      if (exact.length > 1) return { file: null, ambiguous: true }
      // 普通 file input 会丢掉目录，只能退回 basename；多个同名文件必须报歧义。
      const matches = byBase.get(basename(key)) || []
      if (matches.length === 1) return { file: matches[0], ambiguous: false }
      if (matches.length > 1) return { file: null, ambiguous: true }
      return { file: null, ambiguous: false }
    },
  }
}

function walkMarkdown(node, visit) {
  if (!node || typeof node !== 'object') return
  visit(node)
  for (const child of node.children || []) walkMarkdown(child, visit)
}

function findUrlSpan(source, node) {
  if (!node?.position) return null
  const start = node.position.start.offset
  const end = node.position.end.offset
  if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) return null
  const snippet = source.slice(start, end)
  const delimiter = node.type === 'definition' ? snippet.indexOf(':') : snippet.indexOf('(')
  if (delimiter < 0) return null
  let cursor = start + delimiter + 1
  while (/\s/.test(source[cursor] || '')) cursor += 1
  if (source[cursor] === '<') {
    const close = source.indexOf('>', cursor + 1)
    if (close > cursor) return { start: cursor + 1, end: close }
  }
  const parsedUrl = String(node.url || '')
  const parsedOffset = source.indexOf(parsedUrl, cursor)
  if (parsedOffset >= cursor && parsedOffset < end) {
    return { start: parsedOffset, end: parsedOffset + parsedUrl.length }
  }
  let rawEnd = cursor
  let escaped = false
  while (rawEnd < end) {
    const char = source[rawEnd]
    if (escaped) {
      escaped = false
      rawEnd += 1
      continue
    }
    if (char === '\\') {
      escaped = true
      rawEnd += 1
      continue
    }
    if (/\s/.test(char) || (node.type !== 'definition' && char === ')')) break
    rawEnd += 1
  }
  return rawEnd > cursor ? { start: cursor, end: rawEnd } : null
}

/** 使用 mdast 的 image/imageReference 节点和 definition 源码位置，找出真实图片 URL。 */
export function collectMarkdownImageReferences(markdown) {
  const source = String(markdown || '')
  let tree
  try {
    tree = fromMarkdown(source)
  } catch {
    return []
  }
  const definitions = new Map()
  walkMarkdown(tree, (node) => {
    if (node.type === 'definition') definitions.set(node.identifier, node)
  })

  const references = []
  const seenSpans = new Set()
  walkMarkdown(tree, (node) => {
    let target = node
    if (node.type === 'imageReference') target = definitions.get(node.identifier)
    if (node.type !== 'image' && node.type !== 'imageReference') return
    if (!target?.url) return
    const span = findUrlSpan(source, target)
    if (!span) return
    const key = `${span.start}:${span.end}`
    if (seenSpans.has(key)) return
    seenSpans.add(key)
    references.push({ url: target.url, urlStart: span.start, urlEnd: span.end })
  })
  return references
}

export function replaceMarkdownImageUrls(markdown, replacements) {
  const source = String(markdown || '')
  const spans = collectMarkdownImageReferences(source)
    .filter((ref) => replacements.has(ref.url))
    .map((ref) => ({ ...ref, replacement: replacements.get(ref.url) }))
  let result = source
  for (const span of spans.sort((a, b) => b.urlStart - a.urlStart)) {
    result = `${result.slice(0, span.urlStart)}${span.replacement}${result.slice(span.urlEnd)}`
  }
  return result
}

export function convertObsidianImages(markdown) {
  const source = String(markdown || '')
  const protectedRanges = []
  try {
    walkMarkdown(fromMarkdown(source), (node) => {
      if (node.type === 'code' || node.type === 'inlineCode') {
        protectedRanges.push({ start: node.position.start.offset, end: node.position.end.offset })
      }
    })
  } catch {
    // 解析异常时仍保留原文，避免导入过程破坏正文。
    return source
  }
  const replacements = []
  for (const match of source.matchAll(OBSIDIAN_IMAGE_RE)) {
    const start = match.index
    const end = start + match[0].length
    if (protectedRanges.some((range) => start < range.end && end > range.start)) continue
    const normalized = normalizeImportPath(match[1])
    replacements.push({ start, end, value: `![${match[1].trim()}](${normalized})` })
  }
  let result = source
  for (const replacement of replacements.reverse()) {
    result = `${result.slice(0, replacement.start)}${replacement.value}${result.slice(replacement.end)}`
  }
  return result
}
