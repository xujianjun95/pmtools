import MarkdownIt from 'markdown-it'

// 图片门禁必须与前台 Markdown 渲染器使用同一套 token 语义：
// 引用式图片、shortcut 引用会被解析，代码块里的示例不会被当作图片。
const parser = new MarkdownIt({ html: false, linkify: true, breaks: false })
parser.validateLink = () => true

function collectImageTokens(tokens, urls) {
  for (const token of tokens || []) {
    if (token.type === 'image') {
      const src = token.attrGet('src')
      if (src) urls.push(src)
    }
    if (token.children?.length) collectImageTokens(token.children, urls)
  }
}

export function extractMarkdownImageUrls(markdown) {
  const urls = []
  collectImageTokens(parser.parse(String(markdown || ''), {}), urls)
  return urls
}
