// 世界 Tab 静态快照：各国 → 国内可买的主动型 / 联接指数基金。
// 数据口径：天天基金场外人民币份额。status/limit_amount/fee 来自当日申购状态表，
// tracking_error 来自「特殊指标」页（主动/FOF 无此项则为 null），y1/return_*、
// 成立日、规模、管理/托管费率来自基金主页与费率页（成立未满 3 年无 return_3y）。
// 快照日期见 WORLD_SNAPSHOT_DATE；实时数据以天天基金页面为准。
// 后续接入 scanner 每日扫描后，本文件可替换为 /qdii/world-data.json 的构建产物。

export const WORLD_SNAPSHOT_DATE = '2026-09-11'

export const WORLD_GEO_URL = '/maps/countries-50m.json'

// id 为 world-atlas countries-110m 的 ISO 3166-1 numeric（3 位零填充）
// marker 为该国在地图上的圆点坐标（经纬度，取本土视觉中心），供 Marker 投影定位
export const WORLD_COUNTRIES = [
  {
    id: '840',
    zh: '美国',
    flag: '🇺🇸',
    en: 'USA',
    marker: [-98.5, 39.5],
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
    marker: [138.0, 37.5],
    funds: [
      { code: '007280', name: '摩根日本精选A', kind: '主动', status: '限大额', limit_amount: 2000, tracking_error: null, fee: 0.15, y1: 15.15, return_1m: -0.63, return_6m: 11.18, return_1y: 15.15, return_3y: 47.69, return_since: 124.26, inception_date: '2019-07-31', fund_size: 23.94, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2 },
      { code: '020712', name: '华安三菱日联日经225ETF联接A', kind: '被动联接', status: '限大额', limit_amount: 10, tracking_error: 7.63, fee: 0.06, y1: 34.15, return_1m: -0.73, return_6m: 19.75, return_1y: 34.15, return_3y: null, return_since: 42.08, inception_date: '2024-02-07', fund_size: 2.87, fund_size_date: '2026-06-30', management_fee_rate: 0.2, custody_fee_rate: 0.05 },
    ],
  },
  {
    id: '410',
    zh: '韩国',
    flag: '🇰🇷',
    en: 'South Korea',
    marker: [127.8, 36.5],
    funds: [
      { code: '019454', name: '华泰柏瑞中韩半导体ETF联接A', kind: '被动联接', status: '限大额', limit_amount: 100, tracking_error: 6.44, fee: 0.12, y1: 127.79, return_1m: 5.31, return_6m: 41.77, return_1y: 127.79, return_3y: null, return_since: 264.8, inception_date: '2023-09-22', fund_size: 1.42, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1, note: '中韩半导体指数' },
    ],
  },
  {
    id: '704',
    zh: '越南',
    flag: '🇻🇳',
    en: 'Vietnam',
    marker: [106.5, 16.5],
    funds: [
      { code: '008763', name: '天弘越南市场A', kind: '主动', status: '限大额', limit_amount: 500, tracking_error: null, fee: 0.1, y1: -7.09, return_1m: 3.47, return_6m: 6.67, return_1y: -7.09, return_3y: 10.44, return_since: 63.18, inception_date: '2020-01-20', fund_size: 24.88, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2 },
    ],
  },
  {
    id: '356',
    zh: '印度',
    flag: '🇮🇳',
    en: 'India',
    marker: [79.0, 22.5],
    funds: [
      { code: '006105', name: '宏利印度股票A', kind: '主动', status: '暂停申购', limit_amount: 100000, tracking_error: null, fee: 0.15, y1: -8.3, return_1m: -0.82, return_6m: 1.57, return_1y: -8.3, return_3y: 5.33, return_since: 37.67, inception_date: '2019-01-30', fund_size: 17.44, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2 },
      { code: '164824', name: '工银印度基金人民币', kind: '被动FOF', status: '限大额', limit_amount: 500000, tracking_error: null, fee: 0.12, y1: -12.19, return_1m: -3.47, return_6m: -3.63, return_1y: -12.19, return_3y: -4.52, return_since: 28.86, inception_date: '2018-06-15', fund_size: 21.79, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2 },
    ],
  },
  {
    id: '826',
    zh: '英国',
    flag: '🇬🇧',
    en: 'United Kingdom',
    marker: [-2.0, 54.0],
    funds: [
      { code: '539003', name: '建信富时100A', kind: '被动联接', status: '限大额', limit_amount: 10, tracking_error: 4.89, fee: 0.12, y1: 10.73, return_1m: -1.41, return_6m: 4.17, return_1y: 10.73, return_3y: 46.88, return_since: 55.64, inception_date: '2012-06-26', fund_size: 6.91, fund_size_date: '2026-06-30', management_fee_rate: 0.8, custody_fee_rate: 0.2 },
    ],
  },
  {
    id: '276',
    zh: '德国',
    flag: '🇩🇪',
    en: 'Germany',
    marker: [10.4, 51.2],
    funds: [
      { code: '000614', name: '华安德国DAX联接A', kind: '被动联接', status: '限大额', limit_amount: 1000, tracking_error: 4.03, fee: 0.12, y1: -0.95, return_1m: -2.33, return_6m: 5.74, return_1y: -0.95, return_3y: 47.71, return_since: 99.71, inception_date: '2014-08-12', fund_size: 3.81, fund_size_date: '2026-06-30', management_fee_rate: 0.8, custody_fee_rate: 0.2 },
    ],
  },
  {
    id: '250',
    zh: '法国',
    flag: '🇫🇷',
    en: 'France',
    marker: [2.4, 46.6],
    funds: [
      { code: '021539', name: '华安法国CAC40联接A', kind: '被动联接', status: '限大额', limit_amount: 100000, tracking_error: 4.85, fee: 0.06, y1: -1.89, return_1m: -5.85, return_6m: 1.59, return_1y: -1.89, return_3y: null, return_since: 6.4, inception_date: '2024-06-25', fund_size: 1.05, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.15 },
      { code: '021540', name: '华安法国CAC40联接C', kind: '被动联接', status: '限大额', limit_amount: 100000, tracking_error: 4.85, fee: 0, y1: -2.14, return_1m: -5.87, return_6m: 1.47, return_1y: -2.14, return_3y: null, return_since: 5.82, inception_date: '2024-06-25', fund_size: 0.7, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.15 },
    ],
  },
  {
    id: '702',
    zh: '新加坡',
    flag: '🇸🇬',
    en: 'Singapore',
    marker: [103.8, 1.35],
    funds: [
      { code: '020515', name: '华泰柏瑞东南亚科技ETF联接A', kind: '被动联接', status: '限大额', limit_amount: 500, tracking_error: null, fee: 0.12, y1: -15.77, return_1m: -3.95, return_6m: -4.31, return_1y: -15.77, return_3y: null, return_since: 6.02, inception_date: '2024-01-23', fund_size: 1.09, fund_size_date: '2026-06-30', management_fee_rate: 0.4, custody_fee_rate: 0.1, note: '新交所泛东南亚科技指数' },
    ],
  },
]

// 美国市场已由 QDII 主页面重点覆盖；“其他市场”只展示其余国家。
export const OTHER_MARKET_COUNTRIES = WORLD_COUNTRIES.filter((country) => country.id !== '840')

// 不归属单一国家的跨市场 / 全球主动基金，常驻地图下方
export const CROSS_MARKET = {
  id: 'cross',
  zh: '跨市场 / 全球',
  flag: '🌐',
  en: 'Cross-market',
  funds: [
    { code: '118001', name: '易方达亚洲精选', kind: '主动', status: '限大额', limit_amount: 5000000, tracking_error: null, fee: 0.16, y1: 31.26, return_1m: 4.52, return_6m: 12.31, return_1y: 31.26, return_3y: 73.66, return_since: 68.8, inception_date: '2010-01-21', fund_size: 36.02, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2, note: '泛亚洲' },
    { code: '377016', name: '摩根亚太优势A', kind: '主动', status: '限大额', limit_amount: 100000, tracking_error: null, fee: 0.18, y1: 18.81, return_1m: 4.43, return_6m: 12.65, return_1y: 18.81, return_3y: 52.11, return_since: 34.68, inception_date: '2007-10-22', fund_size: 25.91, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2, note: '亚太' },
    { code: '457001', name: '国富亚洲机会A', kind: '主动', status: '限大额', limit_amount: 1000, tracking_error: null, fee: 0.15, y1: 80.87, return_1m: 4.46, return_6m: 44.01, return_1y: 80.87, return_3y: 138.34, return_since: 232.41, inception_date: '2012-02-22', fund_size: 11.58, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2, note: '亚洲除日本' },
    { code: '002891', name: '华夏移动互联人民币', kind: '主动', status: '限大额', limit_amount: 100, tracking_error: null, fee: 0.15, y1: 84.66, return_1m: 4.19, return_6m: 38.69, return_1y: 84.66, return_3y: 71.9, return_since: 168.5, inception_date: '2016-12-14', fund_size: 40.69, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2, note: '全球科技' },
    { code: '006282', name: '摩根欧洲动力A', kind: '主动', status: '限大额', limit_amount: 10000, tracking_error: null, fee: 0.15, y1: 9.78, return_1m: -2.33, return_6m: 5.65, return_1y: 9.78, return_3y: 44.27, return_since: 82.42, inception_date: '2018-10-31', fund_size: 6.35, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2, note: '欧洲' },
    { code: '019450', name: '摩根欧洲动力C', kind: '主动', status: '限大额', limit_amount: 10000, tracking_error: null, fee: 0, y1: 9.34, return_1m: -2.36, return_6m: 5.44, return_1y: 9.34, return_3y: 43.17, return_since: 43.17, inception_date: '2023-09-08', fund_size: 2.3, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2, note: '欧洲' },
    { code: '021189', name: '南方亚太精选ETF联接A', kind: '被动联接', status: '限大额', limit_amount: 10000, tracking_error: 10.32, fee: 0.12, y1: 27.53, return_1m: 3.77, return_6m: 19.53, return_1y: 27.53, return_3y: null, return_since: 51.22, inception_date: '2024-05-21', fund_size: 1.55, fund_size_date: '2026-06-30', management_fee_rate: 0.2, custody_fee_rate: 0.05, note: '亚太' },
    { code: '021190', name: '南方亚太精选ETF联接C', kind: '被动联接', status: '限大额', limit_amount: 10000, tracking_error: 10.32, fee: 0, y1: 27.28, return_1m: 3.75, return_6m: 19.41, return_1y: 27.28, return_3y: null, return_since: 50.53, inception_date: '2024-05-21', fund_size: 9.48, fund_size_date: '2026-06-30', management_fee_rate: 0.2, custody_fee_rate: 0.05, note: '亚太' },
    { code: '016664', name: '天弘全球高端制造A', kind: '主动', status: '限大额', limit_amount: 500, tracking_error: null, fee: 0.15, y1: 87.45, return_1m: 2.73, return_6m: 35.22, return_1y: 87.45, return_3y: 204.98, return_since: 187.96, inception_date: '2023-04-26', fund_size: 16.82, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2, note: '全球制造' },
    { code: '008284', name: '易方达全球医药A', kind: '主动', status: '开放申购', limit_amount: 100000000000, tracking_error: null, fee: 0.15, y1: -28.25, return_1m: -4.46, return_6m: -7.46, return_1y: -28.25, return_3y: 43.39, return_since: 13.45, inception_date: '2020-01-20', fund_size: 8.55, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2, note: '全球医药' },
    { code: '012535', name: '万家全球成长A', kind: '主动', status: '开放申购', limit_amount: 100000000000, tracking_error: null, fee: 0.15, y1: 12.51, return_1m: 3.02, return_6m: 15.77, return_1y: 12.51, return_3y: 82.3, return_since: -1.05, inception_date: '2021-09-22', fund_size: 7.06, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2, note: '全球成长' },
    { code: '011420', name: '广发全球科技A', kind: '主动', status: '开放申购', limit_amount: 100000000000, tracking_error: null, fee: 0.15, y1: 6.29, return_1m: -2.19, return_6m: 7.49, return_1y: 6.29, return_3y: 60.38, return_since: 39.13, inception_date: '2021-03-03', fund_size: 6.23, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2, note: '全球科技' },
  ],
}

export const countryById = (id) =>
  OTHER_MARKET_COUNTRIES.find((c) => c.id === String(id).padStart(3, '0')) || null
