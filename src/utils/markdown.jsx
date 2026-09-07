import { useMemo } from 'react'
import { renderMarkdown } from './markdownEngine'

export { extractHeadings } from './markdownEngine'

/**
 * Markdown 渲染组件：薄壳，实际渲染逻辑在 markdownEngine.js
 * （markdown-it 管线，html:false 转义原始 HTML，可安全使用 dangerouslySetInnerHTML）。
 * 兼容旧 API：content 为空返回 null，className 挂在最外层容器。
 */
function Markdown({ content, className }) {
  const html = useMemo(() => renderMarkdown(content), [content])
  if (!content) return null
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

export default Markdown
