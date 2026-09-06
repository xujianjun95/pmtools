/**
 * 「鉴往」使用统计查询脚本
 *
 * 用法（在服务器 /opt/qdii-notify 目录下执行）：
 *   node query-dca-analytics.mjs                  # 全部时间
 *   node query-dca-analytics.mjs --days 7         # 最近 7 天
 *
 * 三个核心指标：
 *   1. 使用用户数  —— 至少开始过一次旅程的去重 visitor_id 数（按开始旅程的浏览器去重）
 *   2. 平均停留时长 —— 每次访问（visitor_id + visit_id）取最大 duration_ms，再对访问求平均
 *   3. 人均游玩次数 —— dca_start 次数 / 使用用户数
 *
 * 只读查询，不修改任何数据。
 */
import Database from 'better-sqlite3'
import { config } from './config.js'
import { existsSync } from 'node:fs'
import { getAnalyticsDbPath } from './analytics.js'

const dbPath = getAnalyticsDbPath(config.dbPath)
if (!existsSync(dbPath)) {
  console.error(`[ERROR] 未找到数据库：${dbPath}`)
  console.error('请确认统计初始化成功；统计库路径为订阅库 DB_PATH 加 .analytics.db 后缀，不需要修改订阅配置')
  process.exit(1)
}

const daysArg = process.argv.indexOf('--days')
let sinceSql = ''
const params = []
let sinceLabel = '全部时间'
if (daysArg > -1) {
  const days = Number(process.argv[daysArg + 1])
  if (Number.isFinite(days) && days > 0) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    sinceSql = ' AND created_at >= ?'
    params.push(since)
    sinceLabel = `最近 ${days} 天（自 ${since}）`
  }
}

const db = new Database(dbPath, { readonly: true })

const countByEvent = (event) => db.prepare(
  `SELECT COUNT(*) AS n FROM dca_events WHERE ${event ? `event = '${event}'` : '1=1'}${sinceSql}`,
).get(...params).n

console.log('数据库路径 :', dbPath)
console.log('统计范围   :', sinceLabel)
console.log('事件总数   :', countByEvent(null))
console.log('')

// ---- 指标 1：使用用户数 ----
const users = db.prepare(
  `SELECT COUNT(DISTINCT visitor_id) AS n FROM dca_events WHERE event = 'dca_start'${sinceSql}`,
).get(...params).n

// ---- 指标 2：平均停留时长（每次访问取最大 duration_ms，再平均） ----
const stays = db.prepare(
  `SELECT visitor_id, visit_id, MAX(duration_ms) AS ms
   FROM dca_events WHERE 1=1${sinceSql}
   GROUP BY visitor_id, visit_id`,
).all(...params)
const avgStayMs = stays.length
  ? stays.reduce((sum, row) => sum + row.ms, 0) / stays.length
  : 0
const fmtDuration = (ms) => {
  if (ms >= 60 * 1000) return `${Math.floor(ms / 60000)} 分 ${Math.round((ms % 60000) / 1000)} 秒`
  return `${Math.round(ms / 1000)} 秒`
}

// ---- 指标 3：人均游玩次数 ----
const starts = countByEvent('dca_start')
const completes = countByEvent('dca_complete')

console.log('—— 核心指标 ——')
console.log(`使用用户数     : ${users} 人（按开始旅程的浏览器去重）`)
console.log(`页面访问次数   : ${stays.length} 次（每次进入页面独立计数）`)
console.log(`平均停留时长   : ${fmtDuration(avgStayMs)}`)
console.log(`旅程开始次数   : ${starts} 次`)
console.log(`旅程完成次数   : ${completes} 次（完成率 ${starts ? Math.round((completes / starts) * 100) : 0}%）`)
console.log(`人均游玩次数   : ${users ? (starts / users).toFixed(2) : '0.00'} 次/人`)
console.log('')

// ---- 附：旅程参数分布（大家爱从哪年开始、选哪个标的） ----
const distBy = (key, label, limit = 10) => {
  console.log(`—— ${label} ——`)
  const rows = db.prepare(
    `SELECT json_extract(meta, '$.${key}') AS value, COUNT(*) AS n
     FROM dca_events WHERE event = 'dca_start'${sinceSql}
     GROUP BY value ORDER BY n DESC${limit ? ` LIMIT ${limit}` : ''}`,
  ).all(...params)
  if (rows.length === 0) console.log('  （暂无数据）')
  for (const row of rows) console.log(`  ${row.value ?? '未知'}  ->  ${row.n} 次`)
  console.log('')
}

distBy('year', '起始年份分布（dca_start）')
distBy('asset', '定投标的分布（dca_start）')

db.close()
