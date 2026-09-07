/**
 * markdown-it 渲染引擎回归（Phase 6.1/6.2，spec §7.5）。
 * 回归标准：现有文章（Codex 教程）渲染行为不变 + 新增表格/代码块能力。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { extractHeadings, renderMarkdown } from '../src/utils/markdownEngine.js'

test('==高亮== 渲染为 <mark>（markdown-it-mark）', () => {
  const html = renderMarkdown('这是==重点内容==。')
  assert.ok(html.includes('<mark>重点内容</mark>'), html)
})

test('**加粗** 与 [链接](url) 渲染，外链带 noopener + 新窗口', () => {
  const html = renderMarkdown('**加粗** 和 [OpenAI](https://openai.com)')
  assert.ok(html.includes('<strong>加粗</strong>'), html)
  assert.ok(html.includes('href="https://openai.com"'), html)
  assert.ok(html.includes('target="_blank"'), html)
  assert.ok(html.includes('rel="noopener noreferrer"'), html)
})

test('标题降级渲染：# →h2、## →h3、### →h4，且 id 按出现顺序', () => {
  const html = renderMarkdown('# 一级\n\n## 二级\n\n### 三级')
  assert.ok(html.includes('<h2 id="article-heading-0"'), html)
  assert.ok(html.includes('<h3 id="article-heading-1"'), html)
  assert.ok(html.includes('<h4 id="article-heading-2"'), html)
})

test('extractHeadings：跳过 #，##/### 返回 level 2/3 且 id 对齐渲染产物', () => {
  const content = '# 顶部\n\n## 章节 A\n\n### 小节 A1\n\n## 章节 B\n\n正文'
  const headings = extractHeadings(content)
  assert.deepEqual(
    headings.map((h) => [h.level, h.text, h.id]),
    [
      [2, '章节 A', 'article-heading-1'],
      [3, '小节 A1', 'article-heading-2'],
      [2, '章节 B', 'article-heading-3'],
    ]
  )
})

test('裸 URL 自动链接，尾部中文标点不吃进链接', () => {
  const html = renderMarkdown('地址是 https://cc-switch.cc/ ，在这里下载。')
  assert.ok(html.includes('href="https://cc-switch.cc/"'), html)
  // 逗号与句号留在链接外
  assert.ok(!html.includes('cc-switch.cc/，'), html)
})

test('手写 [text](url) 的 URL 不被剥标点', () => {
  const html = renderMarkdown('[官网](https://example.com/a，b)')
  assert.ok(html.includes('href="https://example.com/a%EF%BC%8Cb"'), html)
})

test('独立成行图片 → figure.md-figure + loading=lazy', () => {
  const html = renderMarkdown('前文\n\n![截图](https://example.com/a.png)\n\n后文')
  assert.ok(
    html.includes('<figure class="md-figure"><img src="https://example.com/a.png" alt="截图" loading="lazy">'),
    html
  )
})

test('行内图片不转 figure', () => {
  const html = renderMarkdown('文字 ![图](https://example.com/a.png) 继续')
  assert.ok(!html.includes('<figure'), html)
})

test('原始 HTML 被转义（html:false）', () => {
  const html = renderMarkdown('<script>alert(1)</script>')
  assert.ok(!html.includes('<script>'), html)
  assert.ok(html.includes('&lt;script&gt;'), html)
})

test('新增能力：表格渲染', () => {
  const html = renderMarkdown('| A | B |\n| --- | --- |\n| 1 | 2 |')
  assert.ok(html.includes('<table>'), html)
  assert.ok(html.includes('<td>2</td>'), html)
})

test('新增能力：代码块渲染', () => {
  const html = renderMarkdown('```js\nconst a = 1\n```')
  assert.ok(html.includes('<pre>'), html)
  assert.ok(html.includes('<code class="language-js">'), html)
})

test('空内容返回空字符串，extractHeadings 空安全', () => {
  assert.equal(renderMarkdown(''), '')
  assert.equal(renderMarkdown(null), '')
  assert.deepEqual(extractHeadings(''), [])
})

test('现有文章样本回归：Codex 教程片段渲染结构', () => {
  const content = [
    '本文为一篇**保姆级** Codex 安装教程。',
    '',
    '（注：==此链接需要科学上网，科学上网的问题需要自行解决。==）',
    '',
    '![Codex 官网下载页](https://ros-preview.xhscdn.com/spectrum/abc?sign=x&t=1)',
    '',
    '## 一、下载并安装 Codex',
    '',
    '### 方式一：使用官方套餐',
    '',
    '- 如果你已经有了 ChatGPT 账号，可以直接**继续登录**。',
    '1. **免费版**：只能使用轻度推理模型。',
    '',
    '可直接在 **OpenAI 的官网**进行下载，此处附上地址：https://openai.com/zh-Hant/codex/',
  ].join('\n')

  const html = renderMarkdown(content)
  assert.ok(html.includes('<mark>此链接需要科学上网，科学上网的问题需要自行解决。</mark>'), html)
  assert.ok(html.includes('<figure class="md-figure">'), html)
  assert.ok(html.includes('<h3 id="article-heading-0">一、下载并安装 Codex</h3>'), html)
  assert.ok(html.includes('<h4 id="article-heading-1">方式一：使用官方套餐</h4>'), html)
  assert.ok(html.includes('href="https://openai.com/zh-Hant/codex/"'), html)

  const headings = extractHeadings(content)
  assert.deepEqual(
    headings.map((h) => [h.level, h.text]),
    [
      [2, '一、下载并安装 Codex'],
      [3, '方式一：使用官方套餐'],
    ]
  )
})
