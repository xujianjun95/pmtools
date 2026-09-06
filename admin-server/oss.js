/**
 * 图片上传：校验（扩展名 + magic bytes 双重校验）与 OSS 写入（spec §7.3/§8）。
 *
 * HTTP/外联收口：对外部服务的所有写操作（ali-oss）都收在本模块，其余模块不直接触网。
 * SVG 不支持：SVG 可携带脚本，直链打开存在存储型 XSS 风险。
 */
import { randomUUID } from 'node:crypto'
import { config } from './config.js'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

const EXT_BY_SIGNATURE = [
  { ext: 'jpg', matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: 'png',
    matches: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    ext: 'gif',
    matches: (b) =>
      b.length >= 6 &&
      b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 &&
      b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61,
  },
  {
    ext: 'webp',
    matches: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  {
    // AVIF：ISO BMFF 容器，ftyp box 的 brand 为 avif/avis/mif1
    ext: 'avif',
    matches: (b) => {
      if (b.length < 12) return false
      const brand = b.subarray(8, 12).toString('latin1')
      return b.subarray(4, 8).toString('latin1') === 'ftyp' &&
        ['avif', 'avis', 'mif1'].includes(brand)
    },
  },
]

const EXT_RE = /\.(jpe?g|png|webp|avif|gif)$/i

/** 校验文件名与内容是否为受支持且真实的图片类型；合法返回规范扩展名，否则返回 null */
export function detectImageExt(filename, buffer) {
  if (!filename || !EXT_RE.test(String(filename))) return null
  for (const sig of EXT_BY_SIGNATURE) {
    if (sig.matches(buffer)) return sig.ext
  }
  return null
}

export function isImageSizeOk(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length > 0 && buffer.length <= MAX_IMAGE_BYTES
}

/** 服务端生成随机文件名 + 强制目录前缀（不使用用户文件名，spec §8） */
export function buildImageKey(articleId, ext) {
  return `${config.oss.imagesPrefix}/${articleId}/${randomUUID()}.${ext}`
}

export function publicImageUrl(key) {
  return `https://${config.oss.bucket}.${config.oss.region}.aliyuncs.com/${key}`
}

let ossClient = null

/** 惰性创建 ali-oss 客户端（无凭据时不在 import 阶段失败） */
async function getClient() {
  if (!ossClient) {
    const OSS = (await import('ali-oss')).default
    ossClient = new OSS({
      region: config.oss.region,
      bucket: config.oss.bucket,
      accessKeyId: config.oss.accessKeyId,
      accessKeySecret: config.oss.accessKeySecret,
    })
  }
  return ossClient
}

/** 上传图片缓冲区到 OSS，返回公开访问 URL */
export async function putImageBuffer(key, buffer) {
  const client = await getClient()
  await client.put(key, buffer)
  return publicImageUrl(key)
}
