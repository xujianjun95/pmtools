/**
 * 生产环境订阅量查询脚本
 *
 * 用法（在服务器 /opt/qdii-notify 目录下执行）：
 *   node query-subscribers.mjs
 *
 * 说明：
 *   - 复用 config.js 的 DB_PATH 解析（优先读 .env，默认 __dirname/subscribers.db）
 *   - 只读查询，不会修改任何数据
 *   - 只输出聚合统计，不打印邮箱明文（如需核对邮箱，用 --emails 参数）
 */
import Database from 'better-sqlite3'
import { config } from './config.js'
import { existsSync } from 'node:fs'

const dbPath = config.dbPath
if (!existsSync(dbPath)) {
  console.error(`[ERROR] 未找到数据库：${dbPath}`)
  console.error('请确认服务是否已初始化（先跑过一次 server.js），或用 .env 的 DB_PATH 指向实际库文件')
  process.exit(1)
}

const db = new Database(dbPath, { readonly: true })
const showEmails = process.argv.includes('--emails')

const total = db.prepare('SELECT COUNT(*) AS n FROM subscribers').get().n
const active = db.prepare('SELECT COUNT(*) AS n FROM subscribers WHERE active = 1').get().n
const inactive = db.prepare('SELECT COUNT(*) AS n FROM subscribers WHERE active = 0').get().n
const lastSub = db.prepare('SELECT MAX(created_at) AS t FROM subscribers').get().t
const lastUnsub = db.prepare(
  'SELECT MAX(unsubscribed_at) AS t FROM subscribers WHERE unsubscribed_at IS NOT NULL'
).get().t
const reSubscribed = db
  .prepare('SELECT COUNT(*) AS n FROM subscribers WHERE unsubscribed_at IS NOT NULL AND active = 1')
  .get().n

console.log('数据库路径 :', dbPath)
console.log('总订阅记录 :', total)
console.log('当前活跃   :', active)
console.log('已退订     :', inactive)
console.log('重新激活   :', reSubscribed)
console.log('最近订阅   :', lastSub ? `${lastSub}（北京时间 ${new Date(lastSub).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}）` : '无')
console.log('最近退订   :', lastUnsub ? `${lastUnsub}（北京时间 ${new Date(lastUnsub).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}）` : '无')

console.log('\n按订阅日期分布：')
const byDate = db
  .prepare("SELECT substr(created_at,1,10) AS d, COUNT(*) AS n FROM subscribers GROUP BY d ORDER BY d")
  .all()
if (byDate.length === 0) {
  console.log('  （无订阅记录）')
}
for (const r of byDate) {
  console.log(`  ${r.d}  ->  ${r.n} 人`)
}

if (showEmails) {
  console.log('\n订阅邮箱明细（含活跃状态）：')
  const rows = db
    .prepare('SELECT email, active, created_at FROM subscribers ORDER BY created_at')
    .all()
  for (const r of rows) {
    console.log(`  [${r.active ? '订阅中' : '已退订'}] ${r.email}  ${r.created_at}`)
  }
}

db.close()
