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

test('extractImageUrls：忽略普通链接，只取图片', () => {
  const urls = extractImageUrls(`[链接](https://a.com) ![图](${OSS_PNG})`)
  assert.deepEqual(urls, [OSS_PNG])
})
