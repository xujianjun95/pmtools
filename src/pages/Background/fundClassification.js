/** 只按名称 / 跟踪标的中的明确信息预填，未知分类留空供管理员确认。 */
export function inferFundClassification(fund = {}) {
  const name = typeof fund.name === 'string' ? fund.name : ''
  const target = typeof fund.track_target === 'string' ? fund.track_target : ''
  const text = `${name} ${target}`
  let market = 'other'
  let region = ''
  if (/全球|多市场|跨市场|沪港深|中韩/.test(text)) {
    market = 'cross'
    region = '多市场 / 全球'
  } else if (/纳斯达克|标普500|标准普尔500/.test(text)) {
    market = 'us'
    region = '美国'
  } else if (/日经|日本/.test(text)) {
    region = '日本'
  } else if (/恒生|港股|香港/.test(text)) {
    region = '香港'
  } else if (!/QDII|海外|境外/i.test(text) && /中证白酒|沪深300|中证500|中证1000|上证|深证|创业板|科创50/.test(text)) {
    region = '中国 / A股'
  }
  let kind = ''
  if (/ETF.*联接|指数.*联接/.test(name)) kind = '被动联接'
  else if (/指数/.test(name) || target) kind = '被动指数'
  else if (/FOF/.test(name)) kind = 'FOF'
  else if (/股票|混合|债券|货币/.test(name)) kind = '主动'
  return { market, region, kind }
}
