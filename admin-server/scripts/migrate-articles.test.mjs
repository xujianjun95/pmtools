import test from 'node:test'
import assert from 'node:assert/strict'
import { encodeUrlPath, normalizeContent } from './migrate-articles.mjs'

test('encodeUrlPath 保留完整绝对 URL，只编码 path 文件名', () => {
  const source = 'https://pmtools27.oss-cn-beijing.aliyuncs.com/articles/中文 文件.png'
  assert.equal(
    encodeUrlPath(source),
    'https://pmtools27.oss-cn-beijing.aliyuncs.com/articles/%E4%B8%AD%E6%96%87%20%E6%96%87%E4%BB%B6.png'
  )
  assert.equal(
    encodeUrlPath('https://pmtools27.oss-cn-beijing.aliyuncs.com/articles/%E4%B8%AD.png?version=1'),
    'https://pmtools27.oss-cn-beijing.aliyuncs.com/articles/%E4%B8%AD.png?version=1'
  )
})

test('迁移正文相对图片生成完整 URL，绝对图片 URL 不重复编码', () => {
  const base = 'https://pmtools27.oss-cn-beijing.aliyuncs.com/articles/demo/'
  assert.equal(
    normalizeContent('![中文](images/中文 文件.png)', base),
    '![中文](https://pmtools27.oss-cn-beijing.aliyuncs.com/articles/demo/images/%E4%B8%AD%E6%96%87%20%E6%96%87%E4%BB%B6.png)'
  )
  assert.equal(
    normalizeContent('![远程](https://pmtools27.oss-cn-beijing.aliyuncs.com/articles/demo/x.png)', base),
    '![远程](https://pmtools27.oss-cn-beijing.aliyuncs.com/articles/demo/x.png)'
  )
})
