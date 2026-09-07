/**
 * 文章模块测试：CRUD、公开可见性、发布门禁（图片就位 + 数量上限）、slug 不可改。
 * 直接驱动业务模块，不经过 HTTP 层。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'admin-articles-')), 'articles.db')

const {
  createArticle,
  updateArticle,
  deleteArticle,
  listPublished,
  getPublished,
  getAny,
  listAll,
  checkImagesReady,
  extractImageUrls,
} = await import('./articles.js')

const OSS_PNG = 'https://pmtools27.oss-cn-beijing.aliyuncs.com/articles/images/x/1.png'
const OSS_JPG = 'https://pmtools27.oss-cn-beijing.aliyuncs.com/articles/images/x/2.jpg'

test('新建草稿：默认字段与时间戳齐备', () => {
  const r = createArticle({ id: 'hello', title: '你好', tags: ['a', ' b '] })
  assert.equal(r.ok, true)
  assert.equal(r.article.status, 'draft')
  assert.equal(r.article.published_at, null)
  assert.equal(r.article.tags, '["a","b"]')
  assert.ok(r.article.created_at && r.article.updated_at)
})

test('发布日期只接受安全的日期值并能保留 frontmatter 日期', () => {
  const good = createArticle({ id: 'dated-draft', title: '带日期草稿', published_at: '2026-09-07' })
  assert.equal(good.ok, true)
  assert.equal(good.article.published_at, '2026-09-07')
  assert.equal(createArticle({ id: 'bad-date', title: '坏日期', published_at: '2026-02-31' }).code, 400)
  assert.equal(createArticle({ id: 'bad-date-2', title: '坏日期', published_at: 'javascript:alert(1)' }).code, 400)
  assert.equal(createArticle({ id: 'bad-date-3', title: '坏日期', published_at: '2026-02-31T00:00:00Z' }).code, 400)
})

test('slug 冲突 409、非法 slug 400', () => {
  assert.equal(createArticle({ id: 'hello', title: '重复' }).code, 409)
  assert.equal(createArticle({ id: 'Bad Slug', title: '非法' }).code, 400)
})

test('直接创建上架：图片未就位被门禁拦截', () => {
  const r = createArticle({
    id: 'direct-publish',
    title: '直接上架',
    status: 'published',
    content_md: `![本地图](https://example.com/local.png)`,
  })
  assert.equal(r.code, 400)
  assert.match(r.errors[0], /未就位/)
})

test('直接创建上架：全部 OSS 图片则放行并写入 published_at', () => {
  const r = createArticle({
    id: 'direct-publish-ok',
    title: '直接上架成功',
    status: 'published',
    content_md: `![图](${OSS_PNG})`,
    cover: OSS_JPG,
  })
  assert.equal(r.ok, true)
  assert.equal(r.article.status, 'published')
  assert.ok(r.article.published_at)
})

test('公开可见性：列表只含上架、详情对草稿 404 语义', () => {
  const ids = listPublished().map((a) => a.id)
  assert.ok(ids.includes('direct-publish-ok'))
  assert.ok(!ids.includes('hello'))

  assert.equal(getPublished('hello'), undefined)
  assert.ok(getAny('hello'))

  // 列表不含正文
  assert.equal('content_md' in listAll()[0], false)
})

test('更新：slug 不可改', () => {
  assert.equal(updateArticle('hello', { id: 'renamed' }).code, 400)
})

test('更新：草稿上架过门禁，放行后 published_at 落值', () => {
  // 先给草稿塞一个未就位图片，上架必须被拦
  updateArticle('hello', { content_md: `![待传](pending:abc)` })
  assert.match(updateArticle('hello', { status: 'published' }).errors[0], /未就位/)

  const ok = updateArticle('hello', {
    status: 'published',
    content_md: `![图](${OSS_PNG})`,
  })
  assert.equal(ok.ok, true)
  assert.ok(ok.article.published_at)
})

test('更新：已上架文章改正文同样要过门禁（防绕过）', () => {
  const r = updateArticle('hello', {
    content_md: `![未上传](pending:abc123)`,
  })
  assert.equal(r.code, 400)
})

test('更新：下架放行，且下架后再改正文不再受门禁限制', () => {
  assert.equal(updateArticle('hello', { status: 'draft' }).ok, true)
  const r = updateArticle('hello', { content_md: `![待传](pending:xyz)` })
  assert.equal(r.ok, true)
})

test('更新：不存在的文章 404', () => {
  assert.equal(updateArticle('ghost', { title: 'x' }).code, 404)
})

test('删除与兜底', () => {
  assert.equal(deleteArticle('hello'), true)
  assert.equal(deleteArticle('hello'), false)
  assert.equal(getAny('hello'), undefined)
})

test('checkImagesReady：数量上限与占位拦截', () => {
  const many = Array.from({ length: 31 }, (_, i) => `![i](${OSS_PNG.replace('1.png', `${i}.png`)})`).join('\n')
  assert.equal(checkImagesReady(many, '').ok, false)

  const pending = checkImagesReady(`![占位](pending:uuid-1)`, '')
  assert.equal(pending.ok, false)
  assert.equal(pending.offenders[0], 'pending:uuid-1')

  const good = checkImagesReady(`![a](${OSS_PNG})\n![b](${OSS_PNG})`, OSS_JPG)
  assert.equal(good.ok, true)
  assert.equal(good.referencedCount, 2) // 去重后
})

test('门禁兼容迁移旧文图片路径 articles/<id>/images/（spec §10）', () => {
  const legacy = checkImagesReady(
    '![旧图](https://pmtools27.oss-cn-beijing.aliyuncs.com/articles/codex-install-guide/images/a.png)',
    ''
  )
  assert.equal(legacy.ok, true)
  // 非 /articles/ 前缀的 OSS 路径仍视为未就位
  const other = checkImagesReady(
    '![杂图](https://pmtools27.oss-cn-beijing.aliyuncs.com/other/a.png)',
    ''
  )
  assert.equal(other.ok, false)
})

test('extractImageUrls：忽略普通链接，只取图片', () => {
  const urls = extractImageUrls(`[链接](https://a.com) ![图](${OSS_PNG})`)
  assert.deepEqual(urls, [OSS_PNG])
})

test('extractImageUrls：解析 Markdown 引用式图片并参与发布门禁', () => {
  const markdown = `![图][p]\n\n[p]: ${OSS_PNG}`
  assert.deepEqual(extractImageUrls(markdown), [OSS_PNG])
  assert.equal(checkImagesReady(markdown, '').ok, true)
})

test('extractImageUrls：支持 shortcut 引用且忽略代码块里的示例', () => {
  const markdown = `\`\`\`md\n![假的](pending:code-block)\n\`\`\`\n\n![p]\n\n[p]: ${OSS_PNG}`
  assert.deepEqual(extractImageUrls(markdown), [OSS_PNG])
})

test('已上架文章同请求下架并改为未就绪图片时放行', () => {
  const created = createArticle({
    id: 'published-to-draft',
    title: '已上架转草稿',
    status: 'published',
    content_md: `![图](${OSS_PNG})`,
  })
  assert.equal(created.ok, true)
  const result = updateArticle('published-to-draft', {
    status: 'draft',
    content_md: '![待传](pending:slow-upload)',
  })
  assert.equal(result.ok, true)
  assert.equal(result.article.status, 'draft')
})
