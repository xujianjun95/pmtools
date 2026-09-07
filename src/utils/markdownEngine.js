/**
 * Markdown 渲染引擎（markdown-it + markdown-it-mark，spec §7.5）。
 * 纯 JS、无 JSX，便于 node --test 直接回归；React 包装见 markdown.jsx。
 *
 * 安全：html:false（原始 HTML 一律转义）；外链统一新窗口 + noopener noreferrer。
 * 保留旧手写渲染器的既有行为：
 * - 标题降级渲染：`#`→h2、`##`→h3、`###`→h4（现有文章视觉不变）
 * - h2/h3 标题锚点目录：id 规则 `article-heading-N`（按出现顺序）
 * - 裸 URL 自动链接，且中文标点不吃进链接
 * - 独立成行的图片渲染为 figure.md-figure + loading=lazy
 * 新增能力：表格 / 代码块 / 删除线等 markdown-it 完整语法。
 */
import MarkdownIt from 'markdown-it'
import mark from 'markdown-it-mark'

const HEADING_ID_PREFIX = 'article-heading-'
// 中文标点不吃进链接：裸 URL 自动链接时从文本与 href 尾部剥掉这些字符
const TRAILING_PUNCT = '。，；！？、。）」』》】'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
})
  .use(mark)
  .enable('table')

/**
 * 核心规则：
 * 1) 标题降级渲染（旧渲染器行为）：`#`→h2、`##`→h3、`###`→h4、依此类推（封顶 h6）；
 * 2) 给所有标题按出现顺序写 id（`article-heading-N`）。
 */
function headingAnchorRule(state) {
  const tokens = state.tokens
  let counter = 0
  for (const token of tokens) {
    if (token.type === 'heading_open' || token.type === 'heading_close') {
      token.tag = `h${Math.min(Number(token.tag.slice(1)) + 1, 6)}`
    }
  }
  for (const token of tokens) {
    if (token.type !== 'heading_open') continue
    token.attrSet('id', `${HEADING_ID_PREFIX}${counter}`)
    counter += 1
  }
}
md.core.ruler.push('heading_anchor', headingAnchorRule)

/**
 * 核心规则：裸 URL 自动链接（linkify 产物）时，把尾部中文标点从
 * 链接文本与 href 中同时剥掉（与旧渲染器 trimTrailingPunct 行为一致）。
 * 仅处理「文本 === href」的自动链接，手写 [text](url) 不动。
 */
function trimAutoLinkTrailingPunctRule(state) {
  for (const blockToken of state.tokens) {
    const children = blockToken.type === 'inline' ? blockToken.children : null
    if (!children) continue
    for (let i = 0; i < children.length - 1; i += 1) {
      const open = children[i]
      if (open.type !== 'link_open') continue
      const href = open.attrGet('href') || ''
      const text = children[i + 1]?.type === 'text' ? children[i + 1].content : null
      if (text === null || text !== href) continue
      let end = text.length
      while (end > 0 && TRAILING_PUNCT.includes(text[end - 1])) end -= 1
      if (end === text.length) continue
      const trimmed = text.slice(0, end)
      open.attrSet('href', trimmed)
      children[i + 1].content = trimmed
    }
  }
}
md.core.ruler.push('trim_autolink_trailing_punct', trimAutoLinkTrailingPunctRule)

// 外链/所有链接：新窗口打开 + noopener noreferrer（旧渲染器行为）
const defaultLinkOpen =
  md.renderer.rules.link_open ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }
md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  tokens[idx].attrSet('target', '_blank')
  tokens[idx].attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

// 图片：懒加载
const defaultImage =
  md.renderer.rules.image ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }
md.renderer.rules.image = function (tokens, idx, options, env, self) {
  tokens[idx].attrSet('loading', 'lazy')
  return defaultImage(tokens, idx, options, env, self)
}

// 独立成行的图片段落 → figure.md-figure（与旧渲染器 .md-figure 样式对齐）。
// 在 core 阶段把 [paragraph_open, inline(单图片), paragraph_close] 替换为 html_block。
function soloImageFigureRule(state) {
  const tokens = state.tokens
  for (let i = 0; i < tokens.length - 2; i += 1) {
    if (tokens[i].type !== 'paragraph_open') continue
    const inline = tokens[i + 1]
    if (inline.type !== 'inline') continue
    const children = inline.children || []
    if (children.length !== 1 || children[0].type !== 'image') continue
    const img = children[0]
    const src = img.attrGet('src') || ''
    const alt = img.content || ''
    const html =
      `<figure class="md-figure"><img src="${md.utils.escapeHtml(src)}"` +
      ` alt="${md.utils.escapeHtml(alt)}" loading="lazy"></figure>`
    const block = new state.Token('html_block', '', 0)
    block.content = html
    tokens.splice(i, 3, block)
  }
}
md.core.ruler.push('solo_image_figure', soloImageFigureRule)

/** Markdown → HTML 字符串。 */
export function renderMarkdown(content) {
  if (!content) return ''
  return md.render(String(content))
}

/**
 * 提取 `##`/`###` 标题（跳过 `#`）用于 TOC。
 * 返回 [{level, text, id}]：level 为原始 markdown 层级（2=主项、3=子项），
 * id 与渲染产物 heading 的 id 一致。
 */
export function extractHeadings(content) {
  if (!content) return []
  const tokens = md.parse(String(content), {})
  const headings = []
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (token.type !== 'heading_open') continue
    // 标题已在 core 阶段降级（+1），原始层级 = 降级后层级 - 1
    const srcLevel = Number(token.tag.slice(1)) - 1
    if (srcLevel < 2) continue
    headings.push({
      level: srcLevel,
      text: (tokens[i + 1]?.content || '').trim(),
      id: token.attrGet('id'),
    })
  }
  return headings
}
