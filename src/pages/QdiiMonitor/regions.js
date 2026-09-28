import { CROSS_MARKET, WORLD_COUNTRIES } from './worldFunds'

const REGION_ORDER = WORLD_COUNTRIES

export function getRegionDisplay(region) {
  const raw = typeof region === 'string' ? region.trim() : ''
  const existingFlag = raw.match(/^\p{Regional_Indicator}{2}/u)?.[0]
  const name = existingFlag ? raw.slice(existingFlag.length).trim() : raw
  const canonical = name === '香港' ? '中国香港' : name
  const known = /全球|多市场|跨市场/.test(canonical)
    ? CROSS_MARKET
    : WORLD_COUNTRIES.find((country) => country.zh === canonical)
  return {
    name: known?.zh || name,
    flag: known?.flag || existingFlag || '📍',
    id: known?.id,
    // 固定顺序：已有地区 → 自定义地区 → 跨市场。
    order: known === CROSS_MARKET ? REGION_ORDER.length + 1 : known ? REGION_ORDER.indexOf(known) : REGION_ORDER.length,
  }
}

export function compareRegions(a, b) {
  const first = getRegionDisplay(a)
  const second = getRegionDisplay(b)
  return first.order - second.order || first.name.localeCompare(second.name, 'zh-CN')
}
