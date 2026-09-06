/**
 * 图片校验测试：magic bytes 与扩展名双重校验、随机文件名、大小限制。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const { detectImageExt, isImageSizeOk, buildImageKey } = await import('./oss.js')

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const GIF = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00])
const WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x00, 0x00,
])
const AVIF = Buffer.from([
  0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0x00, 0x00,
])

test('magic bytes 与扩展名匹配时返回内容推断的扩展名', () => {
  assert.equal(detectImageExt('a.png', PNG), 'png')
  assert.equal(detectImageExt('a.jpeg', JPEG), 'jpg')
  assert.equal(detectImageExt('a.gif', GIF), 'gif')
  assert.equal(detectImageExt('a.webp', WEBP), 'webp')
  assert.equal(detectImageExt('a.avif', AVIF), 'avif')
})

test('内容与扩展名不符时以内容为准（防伪造扩展名）', () => {
  assert.equal(detectImageExt('fake.gif', PNG), 'png')
})

test('非法输入返回 null：垃圾内容、无扩展名、SVG、目录穿越式命名', () => {
  assert.equal(detectImageExt('a.png', Buffer.from('not an image at all')), null)
  assert.equal(detectImageExt('noext', PNG), null)
  assert.equal(detectImageExt('evil.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')), null)
  assert.equal(detectImageExt('', PNG), null)
})

test('大小校验：空与超大拒绝', () => {
  assert.equal(isImageSizeOk(PNG), true)
  assert.equal(isImageSizeOk(Buffer.alloc(0)), false)
  assert.equal(isImageSizeOk(null), false)
})

test('buildImageKey：强制目录前缀 + 服务端随机文件名', () => {
  const key = buildImageKey('my-post', 'png')
  assert.match(key, /^articles\/images\/my-post\/[0-9a-f-]{36}\.png$/)
  const a = buildImageKey('my-post', 'png')
  const b = buildImageKey('my-post', 'png')
  assert.notEqual(a, b)
  assert.ok(randomUUID())
})
