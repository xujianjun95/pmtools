// 世界 Tab 静态快照（MVP）：各国 → 国内可买的主动型 / 联接指数基金。
// 数据口径：天天基金场外人民币份额。status/limit_amount/fee 来自当日申购状态表，
// tracking_error 来自「特殊指标」页（主动/FOF 无此项则为 null），y1 为近 1 年收益率。
// 快照日期见 WORLD_SNAPSHOT_DATE；实时数据以天天基金页面为准。
// 后续接入 scanner 每日扫描后，本文件可替换为 /qdii/world-data.json 的构建产物。

export const WORLD_SNAPSHOT_DATE = '2026-09-10'

export const WORLD_GEO_URL = '/maps/countries-50m.json'

// id 为 world-atlas countries-110m 的 ISO 3166-1 numeric（3 位零填充）
export const WORLD_COUNTRIES = [
  {
    id: '840',
    zh: '美国',
    flag: '🇺🇸',
    en: 'United States of America',
    funds: [
      { code: '040046', name: '华安纳斯达克100ETF联接A', kind: '被动联接', status: '限大额', limit_amount: 10, tracking_error: 1.0, fee: 0.12, y1: 16.97 },
      { code: '000834', name: '大成纳斯达克100ETF联接A', kind: '被动联接', status: '限大额', limit_amount: 10, tracking_error: 1.0, fee: 0.12, y1: 16.6 },
      { code: '019547', name: '招商纳斯达克100ETF联接A', kind: '被动联接', status: '限大额', limit_amount: 10, tracking_error: 1.73, fee: 0.12, y1: 17.23 },
      { code: '018966', name: '汇添富纳斯达克100ETF联接A', kind: '被动联接', status: '限大额', limit_amount: 10, tracking_error: 1.73, fee: 0.12, y1: 14.89 },
      { code: '015299', name: '华夏纳斯达克100ETF联接A', kind: '被动联接', status: '暂停申购', limit_amount: 100, tracking_error: 2.43, fee: 0.12, y1: 16.56 },
      { code: '050025', name: '博时标普500ETF联接A', kind: '被动联接', status: '暂停申购', limit_amount: 100, tracking_error: 1.25, fee: 0.12, y1: 12.62 },
    ],
  },
  {
    id: '392',
    zh: '日本',
    flag: '🇯🇵',
    en: 'Japan',
    funds: [
      { code: '007280', name: '摩根日本精选A', kind: '主动', status: '限大额', limit_amount: 2000, tracking_error: null, fee: 0.15, y1: 15.74 },
      { code: '020712', name: '华安三菱日联日经225ETF联接A', kind: '被动联接', status: '限大额', limit_amount: 10, tracking_error: 7.66, fee: 0.06, y1: 34.71 },
    ],
  },
  {
    id: '410',
    zh: '韩国',
    flag: '🇰🇷',
    en: 'South Korea',
    funds: [
      { code: '019454', name: '华泰柏瑞中韩半导体ETF联接A', kind: '被动联接', status: '限大额', limit_amount: 100, tracking_error: 6.45, fee: 0.12, y1: 133.52, note: '中韩半导体指数' },
    ],
  },
  {
    id: '704',
    zh: '越南',
    flag: '🇻🇳',
    en: 'Vietnam',
    funds: [
      { code: '008763', name: '天弘越南市场A', kind: '主动', status: '限大额', limit_amount: 500, tracking_error: null, fee: 0.1, y1: -6.14 },
    ],
  },
  {
    id: '356',
    zh: '印度',
    flag: '🇮🇳',
    en: 'India',
    funds: [
      { code: '006105', name: '宏利印度股票A', kind: '主动', status: '限大额', limit_amount: 100000, tracking_error: null, fee: 0.15, y1: -7.31 },
      { code: '164824', name: '工银印度基金人民币', kind: '被动FOF', status: '限大额', limit_amount: 500000, tracking_error: null, fee: 0.12, y1: -11.57 },
    ],
  },
  {
    id: '826',
    zh: '英国',
    flag: '🇬🇧',
    en: 'United Kingdom',
    funds: [
      { code: '539003', name: '建信富时100A', kind: '被动联接', status: '限大额', limit_amount: 10, tracking_error: 4.89, fee: 0.12, y1: 12.74 },
    ],
  },
  {
    id: '276',
    zh: '德国',
    flag: '🇩🇪',
    en: 'Germany',
    funds: [
      { code: '000614', name: '华安德国DAX联接A', kind: '被动联接', status: '限大额', limit_amount: 1000, tracking_error: 4.04, fee: 0.12, y1: 0.67 },
    ],
  },
  {
    id: '250',
    zh: '法国',
    flag: '🇫🇷',
    en: 'France',
    funds: [
      { code: '021540', name: '华安法国CAC40联接C', kind: '被动联接', status: '限大额', limit_amount: 100000, tracking_error: 4.86, fee: 0, y1: 0.24 },
    ],
  },
  {
    id: '702',
    zh: '新加坡',
    flag: '🇸🇬',
    en: 'Singapore',
    funds: [
      { code: '020515', name: '华泰柏瑞东南亚科技ETF联接A', kind: '被动联接', status: '限大额', limit_amount: 500, tracking_error: null, fee: 0.12, y1: -13.69, note: '新交所泛东南亚科技指数' },
    ],
  },
]

// 不归属单一国家的跨市场 / 全球主动基金，常驻地图下方
export const CROSS_MARKET = {
  id: 'cross',
  zh: '跨市场 / 全球',
  en: 'Cross-market',
  funds: [
    { code: '118001', name: '易方达亚洲精选', kind: '主动', status: '限大额', limit_amount: 5000000, tracking_error: null, fee: 0.16, y1: 33.78, note: '泛亚洲' },
    { code: '377016', name: '摩根亚太优势A', kind: '主动', status: '限大额', limit_amount: 100000, tracking_error: null, fee: 0.18, y1: 20.09, note: '亚太' },
    { code: '457001', name: '国富亚洲机会A', kind: '主动', status: '限大额', limit_amount: 1000, tracking_error: null, fee: 0.15, y1: 82.59, note: '亚洲除日本' },
    { code: '002891', name: '华夏移动互联人民币', kind: '主动', status: '限大额', limit_amount: 100, tracking_error: null, fee: 0.15, y1: 93.65, note: '全球科技' },
  ],
}

export const countryById = (id) =>
  WORLD_COUNTRIES.find((c) => c.id === String(id).padStart(3, '0')) || null
