/**
 * 订阅地区定义与基金归属分类。
 * 用户订阅时勾选关注的地区；发信时按基金名称把变动归入地区，
 * 只通知订阅了对应地区的用户，未匹配的一律归入 other（其他地区）。
 */
export const REGIONS = [
  { id: 'sp500', label: '标普 500' },
  { id: 'nd100', label: '纳斯达克 100' },
  { id: 'other', label: '其他地区' },
]

export const REGION_IDS = REGIONS.map((region) => region.id)

/** 存量订阅者与未传地区的请求按全地区处理，保持历史行为不变 */
export const DEFAULT_REGIONS = [...REGION_IDS]

const REGION_PATTERNS = [
  { id: 'sp500', pattern: /标普\s*500/i },
  { id: 'nd100', pattern: /纳斯达克\s*100|纳指\s*100/i },
]

/** 按基金名称归类地区：标普500 → sp500，纳斯达克100 → nd100，其余 → other */
export function classifyRegion(name) {
  const text = String(name || '')
  for (const { id, pattern } of REGION_PATTERNS) {
    if (pattern.test(text)) return id
  }
  return 'other'
}

/**
 * 归一化前端提交的地区选择：
 * - 未传（undefined/null）：返回默认全地区（兼容旧客户端与存量数据）；
 * - 传了但过滤未知项后为空：返回 null（视为"一个都没选"，由调用方报错）；
 * - 正常：按定义顺序去重返回。
 */
export function normalizeRegions(input) {
  if (input === undefined || input === null) return [...DEFAULT_REGIONS]
  if (!Array.isArray(input)) return null
  const picked = new Set(input.map((item) => String(item)))
  const regions = REGION_IDS.filter((id) => picked.has(id))
  return regions.length ? regions : null
}

/** 解析数据库里的 regions JSON，异常或为空时回退全地区 */
export function parseRegionsJson(json) {
  try {
    const value = JSON.parse(json)
    if (Array.isArray(value) && value.length) return value
  } catch {
    /* 旧数据或脏数据回退 */
  }
  return [...DEFAULT_REGIONS]
}
