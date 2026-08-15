import { Fragment } from 'react'

/**
 * 轻量 Markdown → React 渲染器（无第三方依赖）
 * 支持：## h2 / ### h3 / 段落 / ![]() 图片 / - 无序列表 / 1. 有序列表
 * 行内：==高亮== / **加粗** / [text](url) / 裸 URL 自动链接
 */

const HEADING_RE = /^(#{1,3})\s+(.*)$/
const HEADING_ID_PREFIX = 'article-heading-'

/**
 * 从 markdown 中提取 h2/h3 标题（跳过 h1），返回 [{level, text, id}] 用于 TOC。
 * id 与 Markdown 组件渲染时的 id 规则一致（`article-heading-N`，按出现顺序）。
 */
export function extractHeadings(content) {
  if (!content) return []
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const headings = []
  let counter = 0
  for (const line of lines) {
    const m = HEADING_RE.exec(line)
    if (!m) continue
    const level = m[1].length
    if (level < 2) continue
    headings.push({
      level,
      text: m[2].trim(),
      id: `${HEADING_ID_PREFIX}${counter}`,
    })
    counter += 1
  }
  return headings
}
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/
const UL_RE = /^[-*]\s+(.*)$/
const OL_RE = /^\d+\.\s+(.*)$/

// 行内 token：高亮 / 加粗 / 链接 / 裸 URL
const INLINE_RE =
  /(==[^=]+==|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s]+|www\.[^\s]+)/g

const TRAILING_PUNCT = '。，；！？、。）」』》】'

function trimTrailingPunct(s) {
  let end = s.length
  while (end > 0 && TRAILING_PUNCT.includes(s[end - 1])) end -= 1
  return s.slice(0, end)
}

function parseInline(text, baseKey = '') {
  if (!text) return null
  const parts = []
  let last = 0
  let match
  INLINE_RE.lastIndex = 0
  let i = 0
  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<Fragment key={`${baseKey}-t${i}`}>{text.slice(last, match.index)}</Fragment>)
    }
    const token = match[0]
    if (token.startsWith('==')) {
      parts.push(
        <mark key={`${baseKey}-m${i}`} className="md-mark">
          {token.slice(2, -2)}
        </mark>
      )
    } else if (token.startsWith('**')) {
      parts.push(<strong key={`${baseKey}-b${i}`}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('[')) {
      const m = /\[([^\]]+)\]\(([^)]+)\)/.exec(token)
      if (m) {
        parts.push(
          <a key={`${baseKey}-l${i}`} href={m[2]} target="_blank" rel="noopener noreferrer">
            {m[1]}
          </a>
        )
      } else {
        parts.push(<Fragment key={`${baseKey}-r${i}`}>{token}</Fragment>)
      }
    } else {
      // 裸 URL
      const url = token.startsWith('www.') ? `https://${token}` : token
      parts.push(
        <a key={`${baseKey}-u${i}`} href={trimTrailingPunct(url)} target="_blank" rel="noopener noreferrer">
          {trimTrailingPunct(token)}
        </a>
      )
    }
    last = match.index + token.length
    i += 1
  }
  if (last < text.length) {
    parts.push(<Fragment key={`${baseKey}-te`}>{text.slice(last)}</Fragment>)
  }
  return parts.length ? parts : text
}

function Markdown({ content, className }) {
  if (!content) return null
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0
  let headingI = 0

  while (i < lines.length) {
    const line = lines[i]

    // 空行
    if (line.trim() === '') {
      i += 1
      continue
    }

    // 标题
    const heading = HEADING_RE.exec(line)
    if (heading) {
      const level = heading[1].length
      const text = heading[2]
      const id = `${HEADING_ID_PREFIX}${headingI}`
      headingI += 1
      if (level === 1) {
        blocks.push(<h2 key={`h${i}`} id={id}>{parseInline(text, `h${i}`)}</h2>)
      } else if (level === 2) {
        blocks.push(<h3 key={`h${i}`} id={id}>{parseInline(text, `h${i}`)}</h3>)
      } else {
        blocks.push(<h4 key={`h${i}`} id={id}>{parseInline(text, `h${i}`)}</h4>)
      }
      i += 1
      continue
    }

    // 独立图片
    const img = IMAGE_RE.exec(line)
    if (img) {
      blocks.push(
        <figure key={`f${i}`} className="md-figure">
          <img src={img[2]} alt={img[1] || ''} loading="lazy" />
          {img[1] ? <figcaption>{img[1]}</figcaption> : null}
        </figure>
      )
      i += 1
      continue
    }

    // 无序列表
    if (UL_RE.test(line)) {
      const items = []
      while (i < lines.length && UL_RE.test(lines[i])) {
        const m = /^[-*]\s+(.*)$/.exec(lines[i])
        items.push(<li key={`li${i}`}>{parseInline(m[1], `li${i}`)}</li>)
        i += 1
      }
      blocks.push(<ul key={`ul${i}`}>{items}</ul>)
      continue
    }

    // 有序列表
    if (OL_RE.test(line)) {
      const items = []
      while (i < lines.length && OL_RE.test(lines[i])) {
        const m = /^\d+\.\s+(.*)$/.exec(lines[i])
        items.push(<li key={`ol${i}`}>{parseInline(m[1], `ol${i}`)}</li>)
        i += 1
      }
      blocks.push(<ol key={`ol${i}`}>{items}</ol>)
      continue
    }

    // 段落：累积连续非空、非特殊行
    const para = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !HEADING_RE.test(lines[i]) &&
      !IMAGE_RE.test(lines[i]) &&
      !UL_RE.test(lines[i]) &&
      !OL_RE.test(lines[i])
    ) {
      para.push(lines[i])
      i += 1
    }
    blocks.push(<p key={`p${i}`}>{parseInline(para.join(' '), `p${i}`)}</p>)
  }

  return <div className={className}>{blocks}</div>
}

export default Markdown
