// 世界 Tab 静态快照：各国 → 国内可买的主动型 / 联接指数基金。
// 数据口径：天天基金场外人民币份额。status/limit_amount/fee 来自当日申购状态表，
// tracking_error 来自「特殊指标」页（主动/FOF 无此项则为 null），y1/return_*、
// 成立日、规模、管理/托管费率来自基金主页与费率页（成立未满 3 年无 return_3y）。
// 快照日期见 WORLD_SNAPSHOT_DATE；实时数据以天天基金页面为准。
// 2026-09-16 增补：新增中国香港（恒生科技场外 42 只）与日本/德国/英国/印度/越南
// 补充份额、跨市场 050015，共 50 只；新增条目的状态/限额/手续费取自当日
// 天天基金申购状态表，详情口径与本文件其余条目一致（场内 ETF 不收录）。
// 2026-09-19 刷新：status/limit_amount 逐只重抓天天基金基金页「交易状态」区块，
// 与 scanner 天天基金口径一致（开放申购记 1e11 无限额标记，暂停保留页面残留值、展示层显示 —）。
// 2026-09-19 增补：direct_limit_amount（日累计限额·直销口径）来自安鑫乐跨境额度日报
// （数据日期 2026-09-18，晚于本快照的主体数据）。仅部分基金公司公告直销档位，
// 缺失条目不写字段、页面显示 —。重新生成快照时需重新合并该字段。
// 2026-09-19 接入 scanner 每日扫描：申购状态/代销限额/直销限额/快照历史改为
// 运行时 fetch /qdii/worldpage-data.json 合并（scanner 按 qdii-watcher/world_watchlist.json
// 清单扫描，两清单须同步维护），文件缺失时回退本快照。跟踪误差、费率、收益、
// 成立日等详情字段仍以本文件为准。
// 后续如需彻底静态化，本文件可替换为 /qdii/worldpage-data.json 的构建产物。

export const WORLD_SNAPSHOT_DATE = '2026-09-19'

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
      { code: '040046', name: '华安纳斯达克100ETF联接A', kind: '被动联接', track_target: '纳斯达克100指数', status: '限大额', limit_amount: 10, direct_limit_amount: 100, tracking_error: 1.0, fee: 0.12, y1: 16.97 },
      { code: '000834', name: '大成纳斯达克100ETF联接A', kind: '被动联接', track_target: '纳斯达克100指数', status: '限大额', limit_amount: 10, direct_limit_amount: 100, tracking_error: 1.0, fee: 0.12, y1: 16.6 },
      { code: '019547', name: '招商纳斯达克100ETF联接A', kind: '被动联接', track_target: '纳斯达克100指数', status: '限大额', limit_amount: 10, tracking_error: 1.73, fee: 0.12, y1: 17.23 },
      { code: '018966', name: '汇添富纳斯达克100ETF联接A', kind: '被动联接', track_target: '纳斯达克100指数', status: '限大额', limit_amount: 10, direct_limit_amount: 1000, tracking_error: 1.73, fee: 0.12, y1: 14.89 },
      { code: '015299', name: '华夏纳斯达克100ETF联接A', kind: '被动联接', track_target: '纳斯达克100指数', status: '暂停申购', limit_amount: 100, tracking_error: 2.43, fee: 0.12, y1: 16.56 },
      { code: '050025', name: '博时标普500ETF联接A', kind: '被动联接', track_target: '标准普尔500指数', status: '暂停申购', limit_amount: 100, tracking_error: 1.25, fee: 0.12, y1: 12.62 },
      { code: '017091', name: '景顺长城纳斯达克科技ETF联接A人民币', kind: '被动联接', track_target: '纳斯达克科技市值加权指数', status: '暂停申购', limit_amount: 100, tracking_error: 2.77, fee: 0.12, y1: 28.92, return_1m: 6.22, return_6m: 39.47, return_1y: 28.92, return_3y: 139.24, return_since: 200.94, inception_date: '2022-12-09', fund_size: 27.7, fund_size_date: '2026-06-30', management_fee_rate: 0.8, custody_fee_rate: 0.2, sales_service_fee_rate: 0, operation_fee_rate: 1 },
      { code: '017093', name: '景顺长城纳斯达克科技ETF联接C人民币', kind: '被动联接', track_target: '纳斯达克科技市值加权指数', status: '暂停申购', limit_amount: 100, tracking_error: 2.78, fee: 0, y1: 28.39, return_1m: 6.19, return_6m: 39.19, return_1y: 28.39, return_3y: 136.37, return_since: 196.13, inception_date: '2022-12-09', fund_size: 13.28, fund_size_date: '2026-06-30', management_fee_rate: 0.8, custody_fee_rate: 0.2, sales_service_fee_rate: 0.4, operation_fee_rate: 1.4 },
      { code: '019118', name: '景顺长城纳斯达克科技ETF联接E人民币', kind: '被动联接', track_target: '纳斯达克科技市值加权指数', status: '暂停申购', limit_amount: 100, tracking_error: 2.77, fee: 0, y1: 28.65, return_1m: 6.2, return_6m: 39.33, return_1y: 28.65, return_3y: 137.64, return_since: 134.03, inception_date: '2023-08-16', fund_size: 8.88, fund_size_date: '2026-06-30', management_fee_rate: 0.8, custody_fee_rate: 0.2, sales_service_fee_rate: 0.2, operation_fee_rate: 1.2 },
    ],
  },
  {
    id: '344',
    zh: '中国香港',
    flag: '🇭🇰',
    en: 'Hong Kong, China',
    marker: [114.15, 22.28],
    funds: [
      { code: '012348', name: '天弘恒生科技ETF联接A', kind: '被动联接', track_target: '恒生科技指数', status: '限大额', limit_amount: 1000, tracking_error: 1.96, fee: 0.1, y1: -31.95, return_1m: -7.98, return_6m: -16.33, return_1y: -31.95, return_3y: -0.94, return_since: -40.81, inception_date: '2021-07-06', fund_size: 44.01, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '012349', name: '天弘恒生科技ETF联接C', kind: '被动联接', track_target: '恒生科技指数', status: '限大额', limit_amount: 1000, tracking_error: 1.97, fee: 0, y1: -32.1, return_1m: -8.01, return_6m: -16.42, return_1y: -32.1, return_3y: -1.92, return_since: -41.65, inception_date: '2021-07-06', fund_size: 80.67, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '012570', name: '建信恒生科技指数发起A', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.08, fee: 0.12, y1: -31.82, return_1m: -8.13, return_6m: -16.67, return_1y: -31.82, return_3y: -3.74, return_since: 18.17, inception_date: '2022-09-21', fund_size: 10.27, fund_size_date: '2026-06-30', management_fee_rate: 0.8, custody_fee_rate: 0.2 },
      { code: '012571', name: '建信恒生科技指数发起C', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.1, fee: 0, y1: -32.07, return_1m: -8.16, return_6m: -16.81, return_1y: -32.07, return_3y: -2.93, return_since: 18.81, inception_date: '2022-09-21', fund_size: 7.42, fund_size_date: '2026-06-30', management_fee_rate: 0.8, custody_fee_rate: 0.2 },
      { code: '012804', name: '广发恒生科技ETF联接A', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 1.88, fee: 0.12, y1: -32.06, return_1m: -8.23, return_6m: -16.73, return_1y: -32.06, return_3y: -2.51, return_since: -30.21, inception_date: '2021-08-11', fund_size: 17.22, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '012805', name: '广发恒生科技ETF联接C', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 1.89, fee: 0, y1: -32.2, return_1m: -8.25, return_6m: -16.81, return_1y: -32.2, return_3y: -3.14, return_since: -30.94, inception_date: '2021-08-11', fund_size: 55.95, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '012979', name: '大成恒生科技ETF发起式联接A', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, direct_limit_amount: 100000000000, tracking_error: 2.21, fee: 0.12, y1: -31.77, return_1m: -8.24, return_6m: -16.71, return_1y: -31.77, return_3y: -3.69, return_since: -31.41, inception_date: '2021-09-09', fund_size: 22.93, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '012980', name: '大成恒生科技ETF发起式联接C', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, direct_limit_amount: 100000000000, tracking_error: 2.2, fee: 0, y1: -32.04, return_1m: -8.28, return_6m: -16.87, return_1y: -32.04, return_3y: -4.53, return_since: -32.55, inception_date: '2021-09-09', fund_size: 18.14, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '013127', name: '汇添富恒生科技ETF联接发起式A', kind: '被动联接', track_target: '恒生科技指数', status: '限大额', limit_amount: 200000, tracking_error: 2.06, fee: 0.1, y1: -31.19, return_1m: -7.95, return_6m: -16.15, return_1y: -31.19, return_3y: -0.84, return_since: -31.72, inception_date: '2021-10-26', fund_size: 11.25, fund_size_date: '2026-06-30', management_fee_rate: 0.15, custody_fee_rate: 0.05 },
      { code: '013128', name: '汇添富恒生科技ETF联接发起式C', kind: '被动联接', track_target: '恒生科技指数', status: '限大额', limit_amount: 200000, tracking_error: 2.08, fee: 0, y1: -31.33, return_1m: -7.97, return_6m: -16.24, return_1y: -31.33, return_3y: -1.46, return_since: -32.44, inception_date: '2021-10-26', fund_size: 18.65, fund_size_date: '2026-06-30', management_fee_rate: 0.15, custody_fee_rate: 0.05 },
      { code: '013308', name: '易方达恒生科技ETF联接A', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.05, fee: 0.06, y1: -31.22, return_1m: -7.96, return_6m: -16.04, return_1y: -31.22, return_3y: -1.42, return_since: 3.1, inception_date: '2022-04-29', fund_size: 57.37, fund_size_date: '2026-06-30', management_fee_rate: 0.2, custody_fee_rate: 0.05 },
      { code: '013309', name: '易方达恒生科技ETF联接C', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.06, fee: 0, y1: -31.42, return_1m: -7.99, return_6m: -16.16, return_1y: -31.42, return_3y: -2.33, return_since: 1.56, inception_date: '2022-04-29', fund_size: 97.35, fund_size_date: '2026-06-30', management_fee_rate: 0.2, custody_fee_rate: 0.05 },
      { code: '013402', name: '华夏恒生科技ETF发起式联接A', kind: '被动联接', track_target: '恒生科技指数', status: '限大额', limit_amount: 20000000, tracking_error: 1.96, fee: 0.12, y1: -31.85, return_1m: -8.07, return_6m: -16.58, return_1y: -31.85, return_3y: -1.81, return_since: -28.34, inception_date: '2021-09-28', fund_size: 43.72, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.15 },
      { code: '013403', name: '华夏恒生科技ETF发起式联接C', kind: '被动联接', track_target: '恒生科技指数', status: '限大额', limit_amount: 20000000, tracking_error: 1.95, fee: 0, y1: -32.05, return_1m: -8.08, return_6m: -16.7, return_1y: -32.05, return_3y: -2.67, return_since: -29.39, inception_date: '2021-09-28', fund_size: 47.47, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.15 },
      { code: '014438', name: '博时恒生科技ETF发起式联接A', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.09, fee: 0.12, y1: -31.76, return_1m: -8.01, return_6m: -16.26, return_1y: -31.76, return_3y: -2.01, return_since: -20.89, inception_date: '2021-12-21', fund_size: 8.19, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.15 },
      { code: '014439', name: '博时恒生科技ETF发起式联接C', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.09, fee: 0, y1: -31.9, return_1m: -8.03, return_6m: -16.34, return_1y: -31.9, return_3y: -2.66, return_since: -22.13, inception_date: '2021-12-21', fund_size: 11.26, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.15 },
      { code: '015282', name: '华安恒生科技ETF发起式联接A', kind: '被动联接', track_target: '恒生科技指数', status: '限大额', limit_amount: 10000000, tracking_error: 1.6, fee: 0.05, y1: -32.27, return_1m: -8.08, return_6m: -16.64, return_1y: -32.27, return_3y: -2.99, return_since: 4.48, inception_date: '2022-04-19', fund_size: 4.45, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '015283', name: '华安恒生科技ETF发起式联接C', kind: '被动联接', track_target: '恒生科技指数', status: '限大额', limit_amount: 10000000, tracking_error: 1.61, fee: 0, y1: -32.41, return_1m: -8.1, return_6m: -16.73, return_1y: -32.41, return_3y: -3.74, return_since: 3.39, inception_date: '2022-04-19', fund_size: 20.04, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '015310', name: '华泰柏瑞恒生科技ETF联接A', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.75, fee: 0.12, y1: -31.7, return_1m: -7.99, return_6m: -16.71, return_1y: -31.7, return_3y: -1.6, return_since: -1.73, inception_date: '2022-08-23', fund_size: 4.64, fund_size_date: '2026-06-30', management_fee_rate: 0.2, custody_fee_rate: 0.1 },
      { code: '015311', name: '华泰柏瑞恒生科技ETF联接C', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.76, fee: 0, y1: -31.9, return_1m: -8.01, return_6m: -16.81, return_1y: -31.9, return_3y: -3.48, return_since: -3.87, inception_date: '2022-08-23', fund_size: 26.53, fund_size_date: '2026-06-30', management_fee_rate: 0.2, custody_fee_rate: 0.1 },
      { code: '018577', name: '摩根恒生科技ETF发起式联接A', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.74, fee: 0.12, y1: -30.67, return_1m: -8.09, return_6m: -15.49, return_1y: -30.67, return_3y: 0.27, return_since: -2.82, inception_date: '2023-07-18', fund_size: 1.12, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '018578', name: '摩根恒生科技ETF发起式联接C', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.74, fee: 0, y1: -30.9, return_1m: -8.11, return_6m: -15.64, return_1y: -30.9, return_3y: -0.72, return_since: -3.83, inception_date: '2023-07-18', fund_size: 2.55, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '020988', name: '南方恒生科技ETF发起联接A', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.06, fee: 0.12, y1: -31.46, return_1m: -8.14, return_6m: -16.21, return_1y: -31.46, return_3y: null, return_since: 5.15, inception_date: '2024-05-21', fund_size: 6.26, fund_size_date: '2026-06-30', management_fee_rate: 0.15, custody_fee_rate: 0.05 },
      { code: '020989', name: '南方恒生科技ETF发起联接C', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.06, fee: 0, y1: -31.58, return_1m: -8.17, return_6m: -16.28, return_1y: -31.58, return_3y: null, return_since: 1.99, inception_date: '2024-05-21', fund_size: 14.21, fund_size_date: '2026-06-30', management_fee_rate: 0.15, custody_fee_rate: 0.05 },
      { code: '022005', name: '广发恒生科技ETF联接F', kind: '被动联接', track_target: '恒生科技指数', status: '暂停申购', limit_amount: 100000000000, tracking_error: 1.89, fee: 0, y1: -32.08, return_1m: -8.24, return_6m: -16.74, return_1y: -32.08, return_3y: null, return_since: 13.24, inception_date: '2024-09-04', fund_size: 2.38, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '022647', name: '华安恒生科技ETF发起式联接I', kind: '被动联接', track_target: '恒生科技指数', status: '限大额', limit_amount: 10000000, tracking_error: 1.61, fee: 0, y1: -32.28, return_1m: -8.08, return_6m: -16.64, return_1y: -32.28, return_3y: null, return_since: -8.3, inception_date: '2024-11-19', fund_size: 0.4, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '022680', name: '华泰柏瑞恒生科技ETF联接I', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.76, fee: 0, y1: -31.79, return_1m: -8, return_6m: -16.75, return_1y: -31.79, return_3y: null, return_since: -6.37, inception_date: '2024-11-26', fund_size: 1.72, fund_size_date: '2026-06-30', management_fee_rate: 0.2, custody_fee_rate: 0.1 },
      { code: '023034', name: '中欧恒生科技指数发起A', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.41, fee: 0.1, y1: -31.28, return_1m: -7.82, return_6m: -16.36, return_1y: -31.28, return_3y: null, return_since: -14.18, inception_date: '2025-01-14', fund_size: 1.03, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '023035', name: '中欧恒生科技指数发起C', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.41, fee: 0, y1: -31.47, return_1m: -7.85, return_6m: -16.47, return_1y: -31.47, return_3y: null, return_since: -14.52, inception_date: '2025-01-14', fund_size: 2.46, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '023763', name: '华夏恒生科技ETF发起式联接D', kind: '被动联接', track_target: '恒生科技指数', status: '限大额', limit_amount: 20000000, tracking_error: 1.95, fee: 0, y1: -31.99, return_1m: -8.09, return_6m: -16.66, return_1y: -31.99, return_3y: null, return_since: -25.06, inception_date: '2025-03-28', fund_size: 3.21, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.15 },
      { code: '024148', name: '长城恒生科技指数A', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.12, fee: 0.12, y1: -30.89, return_1m: -8.66, return_6m: -14.26, return_1y: -30.89, return_3y: null, return_since: -24.03, inception_date: '2025-06-18', fund_size: 0.73, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '024149', name: '长城恒生科技指数C', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.11, fee: 0, y1: -31.05, return_1m: -8.68, return_6m: -14.38, return_1y: -31.05, return_3y: null, return_since: -24.26, inception_date: '2025-06-18', fund_size: 1.02, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '024166', name: '西部利得恒生科技指数A', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.81, fee: 0.12, y1: -31.44, return_1m: -7.71, return_6m: -15.82, return_1y: -31.44, return_3y: null, return_since: -27.48, inception_date: '2025-07-24', fund_size: 0.96, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '024167', name: '西部利得恒生科技指数C', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: 2.82, fee: 0, y1: -31.61, return_1m: -7.72, return_6m: -15.93, return_1y: -31.61, return_3y: null, return_since: -27.69, inception_date: '2025-07-24', fund_size: 0.96, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '026206', name: '宝盈恒生科技指数A', kind: '被动联接', track_target: '恒生科技指数', status: '限大额', limit_amount: 1000000, tracking_error: null, fee: 0.12, y1: null, return_1m: -7.94, return_6m: -15.97, return_1y: null, return_3y: null, return_since: -21.36, inception_date: '2026-01-16', fund_size: 4.15, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '026207', name: '宝盈恒生科技指数C', kind: '被动联接', track_target: '恒生科技指数', status: '限大额', limit_amount: 1000000, tracking_error: null, fee: 0, y1: null, return_1m: -7.96, return_6m: -16.08, return_1y: null, return_3y: null, return_since: -21.49, inception_date: '2026-01-16', fund_size: 2.14, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '026534', name: '兴业恒生科技指数A', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: null, fee: 0.03, y1: null, return_1m: -8.33, return_6m: -13.7, return_1y: null, return_3y: null, return_since: -13.94, inception_date: '2026-02-13', fund_size: 1.29, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '026535', name: '兴业恒生科技指数C', kind: '被动联接', track_target: '恒生科技指数', status: '开放申购', limit_amount: 100000000000, tracking_error: null, fee: 0, y1: null, return_1m: -8.35, return_6m: -13.78, return_1y: null, return_3y: null, return_since: -14.04, inception_date: '2026-02-13', fund_size: 0.65, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '027164', name: '富国恒生科技指数A', kind: '被动联接', track_target: '恒生科技', /* 手工补充：天天基金暂未挂跟踪标的数据 */ status: '开放申购', limit_amount: 100000000000, tracking_error: null, fee: 0.3, y1: null, return_1m: -8.13, return_6m: null, return_1y: null, return_3y: null, return_since: -7.28, inception_date: '2026-06-02', fund_size: 0.71, fund_size_date: '2026-06-02', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '027165', name: '富国恒生科技指数C', kind: '被动联接', track_target: '恒生科技', /* 手工补充：天天基金暂未挂跟踪标的数据 */ status: '开放申购', limit_amount: 100000000000, tracking_error: null, fee: 0, y1: null, return_1m: -8.13, return_6m: null, return_1y: null, return_3y: null, return_since: -7.31, inception_date: '2026-06-02', fund_size: 3.4, fund_size_date: '2026-06-02', management_fee_rate: 0.5, custody_fee_rate: 0.1 },
      { code: '027765', name: '嘉实恒生科技ETF发起联接A', kind: '被动联接', track_target: '恒生科技', /* 手工补充：天天基金暂未挂跟踪标的数据 */ status: '开放申购', limit_amount: 100000000000, tracking_error: null, fee: 0.03, y1: null, return_1m: -8.11, return_6m: null, return_1y: null, return_3y: null, return_since: -7.36, inception_date: '2026-06-12', fund_size: 0.1, fund_size_date: '2026-06-12', management_fee_rate: 0.15, custody_fee_rate: 0.05 },
      { code: '027766', name: '嘉实恒生科技ETF发起联接C', kind: '被动联接', track_target: '恒生科技', /* 手工补充：天天基金暂未挂跟踪标的数据 */ status: '开放申购', limit_amount: 100000000000, tracking_error: null, fee: 0, y1: null, return_1m: -8.13, return_6m: null, return_1y: null, return_3y: null, return_since: -7.41, inception_date: '2026-06-12', fund_size: 0, fund_size_date: '2026-06-12', management_fee_rate: 0.15, custody_fee_rate: 0.05 },
    ],
  },
  {
    id: '826',
    zh: '英国',
    flag: '🇬🇧',
    en: 'United Kingdom',
    marker: [-2.0, 54.0],
    funds: [
      { code: '539003', name: '建信富时100A', kind: '被动联接', track_target: '伦敦富时100指数', status: '限大额', limit_amount: 10, tracking_error: 4.89, fee: 0.12, y1: 10.73, return_1m: -1.41, return_6m: 4.17, return_1y: 10.73, return_3y: 46.88, return_since: 55.64, inception_date: '2012-06-26', fund_size: 6.91, fund_size_date: '2026-06-30', management_fee_rate: 0.8, custody_fee_rate: 0.2 },
      { code: '008706', name: '建信富时100C', kind: '被动联接', track_target: '伦敦富时100指数', status: '限大额', limit_amount: 10, tracking_error: 4.89, fee: 0, y1: 9.53, return_1m: -0.81, return_6m: 3.26, return_1y: 9.53, return_3y: 42.4, return_since: 62.76, inception_date: '2020-01-10', fund_size: 3.78, fund_size_date: '2026-06-30', management_fee_rate: 0.8, custody_fee_rate: 0.2 },
      { code: '023373', name: '建信富时100D', kind: '被动联接', track_target: '伦敦富时100指数', status: '限大额', limit_amount: 10, tracking_error: 4.88, fee: 0, y1: 9.54, return_1m: -0.81, return_6m: 3.26, return_1y: 9.54, return_3y: null, return_since: 24.02, inception_date: '2025-02-12', fund_size: 0.09, fund_size_date: '2026-06-30', management_fee_rate: 0.8, custody_fee_rate: 0.2 },
    ],
  },
  {
    id: '276',
    zh: '德国',
    flag: '🇩🇪',
    en: 'Germany',
    marker: [10.4, 51.2],
    funds: [
      { code: '000614', name: '华安德国DAX联接A', kind: '被动联接', track_target: '法兰克福DAX指数', status: '限大额', limit_amount: 1000, direct_limit_amount: 1000, tracking_error: 4.03, fee: 0.12, y1: -0.95, return_1m: -2.33, return_6m: 5.74, return_1y: -0.95, return_3y: 47.71, return_since: 99.71, inception_date: '2014-08-12', fund_size: 3.81, fund_size_date: '2026-06-30', management_fee_rate: 0.8, custody_fee_rate: 0.2 },
      { code: '015016', name: '华安德国DAX联接C', kind: '被动联接', track_target: '法兰克福DAX指数', status: '限大额', limit_amount: 1000, direct_limit_amount: 1000, tracking_error: 4, fee: 0, y1: -2.21, return_1m: -4, return_6m: 4.48, return_1y: -2.21, return_3y: 45.69, return_since: 56.55, inception_date: '2022-02-22', fund_size: 2.64, fund_size_date: '2026-06-30', management_fee_rate: 0.8, custody_fee_rate: 0.2 },
    ],
  },
  {
    id: '250',
    zh: '法国',
    flag: '🇫🇷',
    en: 'France',
    marker: [2.4, 44.8],
    funds: [
      { code: '021539', name: '华安法国CAC40联接A', kind: '被动联接', track_target: '法国CAC40指数', status: '限大额', limit_amount: 100000, direct_limit_amount: 100000, tracking_error: 4.85, fee: 0.06, y1: -1.89, return_1m: -5.85, return_6m: 1.59, return_1y: -1.89, return_3y: null, return_since: 6.4, inception_date: '2024-06-25', fund_size: 1.05, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.15 },
      { code: '021540', name: '华安法国CAC40联接C', kind: '被动联接', track_target: '法国CAC40指数', status: '限大额', limit_amount: 100000, direct_limit_amount: 100000, tracking_error: 4.85, fee: 0, y1: -2.14, return_1m: -5.87, return_6m: 1.47, return_1y: -2.14, return_3y: null, return_since: 5.82, inception_date: '2024-06-25', fund_size: 0.7, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.15 },
    ],
  },
  {
    id: '392',
    zh: '日本',
    flag: '🇯🇵',
    en: 'Japan',
    marker: [138.0, 37.5],
    funds: [
      { code: '007280', name: '摩根日本精选A', kind: '主动', status: '暂停申购', limit_amount: 2000, tracking_error: null, fee: 0.15, y1: 15.15, return_1m: -0.63, return_6m: 11.18, return_1y: 15.15, return_3y: 47.69, return_since: 124.26, inception_date: '2019-07-31', fund_size: 23.94, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2 },
      { code: '020712', name: '华安三菱日联日经225ETF联接A', kind: '被动联接', track_target: '东京日经225指数', status: '暂停申购', limit_amount: 10, tracking_error: 7.63, fee: 0.06, y1: 34.15, return_1m: -0.73, return_6m: 19.75, return_1y: 34.15, return_3y: null, return_since: 42.08, inception_date: '2024-02-07', fund_size: 2.87, fund_size_date: '2026-06-30', management_fee_rate: 0.2, custody_fee_rate: 0.05 },
      { code: '020713', name: '华安三菱日联日经225ETF联接C', kind: '被动联接', track_target: '东京日经225指数', status: '暂停申购', limit_amount: 10, tracking_error: 7.68, fee: 0, y1: 27.63, return_1m: -4.64, return_6m: 18.57, return_1y: 27.63, return_3y: null, return_since: 37.42, inception_date: '2024-02-07', fund_size: 1.6, fund_size_date: '2026-06-30', management_fee_rate: 0.2, custody_fee_rate: 0.05 },
    ],
  },
  {
    id: '702',
    zh: '新加坡',
    flag: '🇸🇬',
    en: 'Singapore',
    marker: [103.8, 1.35],
    funds: [
      { code: '020515', name: '华泰柏瑞东南亚科技ETF联接A', kind: '被动联接', track_target: '新交所泛东南亚科技指数', status: '限大额', limit_amount: 500, tracking_error: null, fee: 0.12, y1: -15.77, return_1m: -3.95, return_6m: -4.31, return_1y: -15.77, return_3y: null, return_since: 6.02, inception_date: '2024-01-23', fund_size: 1.09, fund_size_date: '2026-06-30', management_fee_rate: 0.4, custody_fee_rate: 0.1, note: '新交所泛东南亚科技指数' },
    ],
  },
  {
    id: '704',
    zh: '越南',
    flag: '🇻🇳',
    en: 'Vietnam',
    marker: [106.5, 16.5],
    funds: [
      { code: '008763', name: '天弘越南市场A', kind: '主动', status: '限大额', limit_amount: 1000, tracking_error: null, fee: 0.1, y1: -7.09, return_1m: 3.47, return_6m: 6.67, return_1y: -7.09, return_3y: 10.44, return_since: 63.18, inception_date: '2020-01-20', fund_size: 24.88, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2 },
      { code: '008764', name: '天弘越南市场C', kind: '主动', status: '限大额', limit_amount: 1000, tracking_error: null, fee: 0, y1: -10.1, return_1m: 3.41, return_6m: 1.07, return_1y: -10.1, return_3y: 9.54, return_since: 57.99, inception_date: '2020-01-20', fund_size: 15.21, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2 },
      { code: '022524', name: '天弘越南市场D', kind: '主动', status: '限大额', limit_amount: 500, tracking_error: null, fee: 0, y1: -10.11, return_1m: 3.41, return_6m: 1.06, return_1y: -10.11, return_3y: null, return_since: 8.21, inception_date: '2024-11-01', fund_size: 0.02, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2 },
    ],
  },
  {
    id: '410',
    zh: '韩国',
    flag: '🇰🇷',
    en: 'South Korea',
    marker: [127.8, 36.5],
    funds: [
      { code: '019454', name: '华泰柏瑞中韩半导体ETF联接A', kind: '被动联接', track_target: '中证韩交所中韩半导体指数', status: '限大额', limit_amount: 100, tracking_error: 6.44, fee: 0.12, y1: 127.79, return_1m: 5.31, return_6m: 41.77, return_1y: 127.79, return_3y: null, return_since: 264.8, inception_date: '2023-09-22', fund_size: 1.42, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1, note: '中韩半导体指数' },
      { code: '019455', name: '华泰柏瑞中韩半导体ETF联接C', kind: '被动联接', track_target: '中证韩交所中韩半导体指数', status: '限大额', limit_amount: 100, tracking_error: 6.47, fee: 0, y1: 102.68, return_1m: -2.23, return_6m: 36.97, return_1y: 102.68, return_3y: null, return_since: 260.71, inception_date: '2023-09-22', fund_size: 2.36, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1, note: '中韩半导体指数' },
      { code: '022681', name: '华泰柏瑞中韩半导体ETF联接I', kind: '被动联接', track_target: '中证韩交所中韩半导体指数', status: '限大额', limit_amount: 100, tracking_error: 6.47, fee: 0, y1: 102.99, return_1m: -2.22, return_6m: 37.07, return_1y: 102.99, return_3y: null, return_since: 210.99, inception_date: '2024-11-26', fund_size: 0.05, fund_size_date: '2026-06-30', management_fee_rate: 0.5, custody_fee_rate: 0.1, note: '中韩半导体指数' },
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
      { code: '026015', name: '宏利印度股票C', kind: '主动', status: '暂停申购', limit_amount: 0, tracking_error: null, fee: 0, y1: null, return_1m: -3.53, return_6m: 1.8, return_1y: null, return_3y: null, return_since: -11.63, inception_date: '2025-11-12', fund_size: 0.04, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2 },
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
    { code: '021189', name: '南方亚太精选ETF联接A', kind: '被动联接', track_target: '富时亚太低碳精选指数', status: '暂停申购', limit_amount: 0, tracking_error: 10.32, fee: 0.12, y1: 27.53, return_1m: 3.77, return_6m: 19.53, return_1y: 27.53, return_3y: null, return_since: 51.22, inception_date: '2024-05-21', fund_size: 1.55, fund_size_date: '2026-06-30', management_fee_rate: 0.2, custody_fee_rate: 0.05, note: '亚太' },
    { code: '021190', name: '南方亚太精选ETF联接C', kind: '被动联接', track_target: '富时亚太低碳精选指数', status: '暂停申购', limit_amount: 0, tracking_error: 10.32, fee: 0, y1: 27.28, return_1m: 3.75, return_6m: 19.41, return_1y: 27.28, return_3y: null, return_since: 50.53, inception_date: '2024-05-21', fund_size: 9.48, fund_size_date: '2026-06-30', management_fee_rate: 0.2, custody_fee_rate: 0.05, note: '亚太' },
    { code: '050015', name: '博时大中华亚太精选', kind: '主动', status: '限大额', limit_amount: 1000000, tracking_error: null, fee: 0.16, y1: 28.83, return_1m: -5.71, return_6m: 4.63, return_1y: 28.83, return_3y: 47.59, return_since: 37.93, inception_date: '2010-07-27', fund_size: 1.68, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2, note: '亚太' },
    { code: '016664', name: '天弘全球高端制造A', kind: '主动', status: '限大额', limit_amount: 1000, tracking_error: null, fee: 0.15, y1: 87.45, return_1m: 2.73, return_6m: 35.22, return_1y: 87.45, return_3y: 204.98, return_since: 187.96, inception_date: '2023-04-26', fund_size: 16.82, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2, note: '全球制造' },
    { code: '008284', name: '易方达全球医药A', kind: '主动', status: '开放申购', limit_amount: 100000000000, tracking_error: null, fee: 0.15, y1: -28.25, return_1m: -4.46, return_6m: -7.46, return_1y: -28.25, return_3y: 43.39, return_since: 13.45, inception_date: '2020-01-20', fund_size: 8.55, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2, note: '全球医药' },
    { code: '012535', name: '万家全球成长A', kind: '主动', status: '开放申购', limit_amount: 100000000000, tracking_error: null, fee: 0.15, y1: 12.51, return_1m: 3.02, return_6m: 15.77, return_1y: 12.51, return_3y: 82.3, return_since: -1.05, inception_date: '2021-09-22', fund_size: 7.06, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2, note: '全球成长' },
    { code: '011420', name: '广发全球科技A', kind: '主动', status: '开放申购', limit_amount: 100000000000, tracking_error: null, fee: 0.15, y1: 6.29, return_1m: -2.19, return_6m: 7.49, return_1y: 6.29, return_3y: 60.38, return_since: 39.13, inception_date: '2021-03-03', fund_size: 6.23, fund_size_date: '2026-06-30', management_fee_rate: 1.2, custody_fee_rate: 0.2, note: '全球科技' },
  ],
}

export const countryById = (id) =>
  OTHER_MARKET_COUNTRIES.find((c) => c.id === String(id).padStart(3, '0')) || null
