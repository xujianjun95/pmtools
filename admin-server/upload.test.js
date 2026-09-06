/**
 * 图片上传端点测试：先草稿后传图、类型校验、大小上限、注入 fake OSS 写入。
 */
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const TEST_PASSWORD = ['pmtools', 'test', randomUUID().slice(0, 8)].join('-')
const TEST_SECRET = ['session', 'secret', randomUUID()].join('-')
const ORIGIN = 'http://localhost:5173'

process.env.ADMIN_PASSWORD = TEST_PASSWORD
process.env.SESSION_SECRET = TEST_SECRET
process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'admin-upload-')), 'articles.db')
process.env.ADMIN_ALLOWED_ORIGINS = ORIGIN

const { createApp } = await import('./server.js')
const { signSession, SESSION_COOKIE } = await import('./auth.js')
const { config } = await import('./config.js')
const { createArticle } = await import('./articles.js')

const uploads = []
const fakeOssPut = async (key, buffer) => {
  uploads.push({ key, size: buffer.length })
  return `https://fake.oss.example/${key}`
}

const server = createApp({ ossPut: fakeOssPut }).listen(0, '127.0.0.1')
await new Promise((resolve) => server.once('listening', resolve))
const base = `http://127.0.0.1:${server.address().port}/background-api`
after(() => server.close())

const cookie = `${SESSION_COOKIE}=${signSession(config.sessionSecret).token}`
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01])
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])

createArticle({ id: 'with-pics', title: '有图文章' })

const upload = (articleId, filename, buffer, extra = {}) =>
  fetch(`${base}/admin/upload/image?articleId=${articleId}`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: ORIGIN,
      'Content-Type': 'image/png',
      'X-File-Name': filename,
      ...extra,
    },
    body: buffer,
  })

test('未登录 401；缺 Origin 的写操作 403', async () => {
  const noAuth = await fetch(`${base}/admin/upload/image?articleId=with-pics`, {
    method: 'POST',
    body: PNG,
  })
  assert.equal(noAuth.status, 401)

  const noOrigin = await fetch(`${base}/admin/upload/image?articleId=with-pics`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'image/png', 'X-File-Name': 'a.png' },
    body: PNG,
  })
  assert.equal(noOrigin.status, 403)
})

test('缺 articleId 400；文章不存在 404（先草稿后传图）', async () => {
  assert.equal((await upload('', 'a.png', PNG)).status, 400)
  assert.equal((await upload('no-such-post', 'a.png', PNG)).status, 404)
})

test('内容与扩展名不符：以内容为准入库', async () => {
  const res = await upload('with-pics', 'looks-like.gif', PNG)
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.match(body.key, /^articles\/images\/with-pics\/[0-9a-f-]{36}\.png$/)
  assert.equal(body.url, `https://fake.oss.example/${body.key}`)
})

test('垃圾内容与 SVG 拒绝', async () => {
  const garbage = await upload('with-pics', 'x.png', Buffer.from('definitely not an image'))
  assert.equal(garbage.status, 400)

  const svg = await upload('with-pics', 'x.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))
  assert.equal(svg.status, 400)
})

test('jpeg 混合签名走 jpg 通道；重试产生新 key（互不覆盖）', async () => {
  const res = await upload('with-pics', 'photo.jpg', JPEG)
  assert.equal(res.status, 201)
  const first = (await res.json()).key

  const retry = await upload('with-pics', 'photo.jpg', JPEG)
  const second = (await retry.json()).key
  assert.notEqual(first, second)
  assert.equal(uploads.length, 3) // gif 名 png 内容 1 次 + jpeg 及其重试 2 次
})

test('超过 10MB 返回 413', async () => {
  const big = Buffer.alloc(10 * 1024 * 1024 + 1, 0x89)
  const res = await upload('with-pics', 'big.png', big)
  assert.equal(res.status, 413)
})
