/** 上架门禁 UI 预检回归（Phase 7.4，spec §7.3/§7.4） */
import test from 'node:test'
import assert from 'node:assert/strict'
import { extractImageUrls, findUnreadyImages } from '../src/pages/Background/articleValidation.js'
import {
  collectMarkdownImageReferences,
  convertObsidianImages,
  createImportFileIndex,
  normalizeImportDate,
  parseMarkdownFile,
  replaceMarkdownImageUrls,
} from '../src/pages/Background/importMarkdown.js'

test('extractImageUrls 只取图片引用', () => {
  assert.deepEqual(
    extractImageUrls('[链接](https://a.com) ![图](https://b.com/x.png)'),
    ['https://b.com/x.png']
  )
})

test('全 OSS 图片 + OSS 封面 → 可上架', () => {
  const md = '![a](https://pmtools27.oss-cn-beijing.aliyuncs.com/articles/images/x/1.png)'
  assert.deepEqual(
    findUnreadyImages(md, 'https://pmtools27.oss-cn-beijing.aliyuncs.com/articles/images/x/c.png'),
    []
  )
})

test('相对路径与 pending 占位 → 拦截并列出', () => {
  const offenders = findUnreadyImages('![a](images/1.png)\n![b](pending:uuid-1)', '')
  assert.deepEqual(offenders, ['images/1.png', 'pending:uuid-1'])
})

test('非 https 封面 → 拦截', () => {
  assert.deepEqual(findUnreadyImages('', '/local/cover.png'), ['/local/cover.png'])
})

test('重复引用去重，空正文不误报', () => {
  assert.deepEqual(findUnreadyImages('![a](x.png) ![b](x.png)', ''), ['x.png'])
  assert.deepEqual(findUnreadyImages('', ''), [])
})

test('引用式 Markdown 图片参与前端发布预检', () => {
  const ready = '![图][p]\n\n[p]: https://pmtools27.oss-cn-beijing.aliyuncs.com/articles/images/x/1.png'
  const pending = '![图][p]\n\n[p]: pending:upload-1'
  assert.deepEqual(extractImageUrls(ready), ['https://pmtools27.oss-cn-beijing.aliyuncs.com/articles/images/x/1.png'])
  assert.deepEqual(findUnreadyImages(ready, ''), [])
  assert.deepEqual(findUnreadyImages(pending, ''), ['pending:upload-1'])
})

test('前端图片解析与渲染语义一致：shortcut 引用且忽略代码块', () => {
  const markdown = '```md\n![假的](pending:code-block)\n```\n\n![p]\n\n[p]: pending:upload-2'
  assert.deepEqual(extractImageUrls(markdown), ['pending:upload-2'])
  assert.deepEqual(findUnreadyImages(markdown, ''), ['pending:upload-2'])
})

test('导入 frontmatter 使用 YAML 解析器保留多行摘要、标签空格和北京时间日期', () => {
  const { meta, body } = parseMarkdownFile(`---
title: 导入标题
date: 2026-09-07T23:30:00+08:00
tags:
  - AI 工具
  - Codex
summary: |
  第一行
  第二行
---

正文`)
  assert.deepEqual(meta, {
    title: '导入标题',
    date: '2026-09-07',
    tags: ['AI 工具', 'Codex'],
    summary: '第一行\n第二行',
  })
  assert.equal(body.trim(), '正文')
  assert.equal(normalizeImportDate('2026-02-31'), '')
})

test('导入图片按 AST source span 定点替换，保护子串、行内代码和代码块', () => {
  const markdown = [
    '![真实](a.png) ba.png',
    '',
    '![p]',
    '',
    '[p]: images/x.png',
    '',
    '```md',
    '![假的](a.png)',
    '![p]',
    '```',
    '',
    '`![假的](a.png)`',
  ].join('\n')
  const refs = collectMarkdownImageReferences(markdown)
  assert.deepEqual(refs.map(({ url }) => url), ['a.png', 'images/x.png'])
  assert.match(
    replaceMarkdownImageUrls(markdown, new Map([
      ['a.png', 'https://oss/a.png'],
      ['images/x.png', 'https://oss/x.png'],
    ])),
    /^!\[真实\]\(https:\/\/oss\/a\.png\) ba\.png[\s\S]*\[p\]: https:\/\/oss\/x\.png[\s\S]*```md\n!\[假的\]\(a\.png\)/
  )
})

test('导入图片 basename 重名返回歧义，子串文件不会被误匹配', () => {
  const a = { name: 'a.png', webkitRelativePath: 'one/a.png' }
  const b = { name: 'a.png', webkitRelativePath: 'two/a.png' }
  const ba = { name: 'ba.png', webkitRelativePath: 'ba.png' }
  const index = createImportFileIndex([a, b, ba], { name: 'article.md' })
  assert.equal(index.resolve('a.png').ambiguous, true)
  assert.equal(index.resolve('ba.png').file, ba)
  assert.equal(index.resolve('one/a.png').file, a)
})

test('普通 file input 丢失目录时，唯一 basename 仍可匹配带目录引用', () => {
  const file = { name: 'a.png' }
  const index = createImportFileIndex([file], { name: 'article.md' })
  assert.equal(index.resolve('images/a.png').file, file)
})

test('Obsidian 图片转换保护代码块和行内代码', () => {
  const converted = convertObsidianImages('`![[inline.png]]`\n\n```md\n![[code.png]]\n```\n\n![[real.png]]')
  assert.equal(converted, '`![[inline.png]]`\n\n```md\n![[code.png]]\n```\n\n![real.png](real.png)')
})
