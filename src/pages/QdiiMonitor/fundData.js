import { getRegionDisplay } from './regions'

function isOtherMarketFund(fund) {
  return fund.source_group !== 'active_pool'
    && fund.market !== 'us'
    && getRegionDisplay(fund.region || fund.country).id !== '840'
}

/** 管理名册优先；后台不可用时保持现有每日扫描文件的回退能力。 */
export async function loadFundData(view) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch('/background-api/funds', { cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    if (data.ok !== true || !Array.isArray(data.funds)) throw new Error('基金名册格式不正确')
    const funds = data.funds.filter((fund) => view === 'us'
      ? fund.market === 'us'
      : isOtherMarketFund(fund))
    const codes = new Set(data.funds.map((fund) => fund.code))
    return {
      ...data,
      funds: funds.map((fund) => ({ ...fund, country: fund.region, index_key: fund.index_key || (fund.market === 'us' ? 'manual' : 'worldpage') })),
      updated_at: data.updated_at || '尚未扫描',
      recent_changes: (data.recent_changes || []).filter((change) => codes.has(change.code)),
    }
  } catch {
    const file = view === 'us' ? 'data' : 'worldpage-data'
    const response = await fetch(`/qdii/${file}.json`, { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    if (!Array.isArray(data.funds)) throw new Error('基金数据格式不正确')
    return view === 'us' ? data : { ...data, funds: data.funds.filter(isOtherMarketFund) }
  } finally {
    clearTimeout(timer)
  }
}
