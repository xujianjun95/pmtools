/**
 * 文章上架门禁 UI 预检（spec §7.4；服务端做最终门禁）。
 * 非 https 图片引用视为未就位；返回去重后的 offender 列表。
 */
import { extractMarkdownImageUrls } from '../../utils/markdownImages.js'

export function extractImageUrls(markdown) {
  return extractMarkdownImageUrls(markdown)
}

export function findUnreadyImages(markdown, cover) {
  const offenders = extractImageUrls(markdown).filter((u) => !u.startsWith('https://'))
  if (cover && !cover.startsWith('https://')) offenders.push(cover)
  return [...new Set(offenders)]
}
