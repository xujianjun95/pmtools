#!/usr/bin/env node
/**
 * Nginx access.log（combined 格式）→ analytics.db site_events 一次性回填脚本。
 *
 * 背景：线上 Nginx 日志 2026-08-25 ~ 2026-09-08（约 8 万行）缺口回填。
 *   analytics 库 site_events 最早为 2026-09-08T05:38:44Z，
 *   需把 8-25 ~ 9-08T05:38Z 的 page_view 补进去。
 *
 * 口径（用户确认）：
 *   - bot 不剔除，全部保留（不做 UA 过滤）。
 *   - 数据接口也保留：/qdii/ 下的 .json（含 data.json、simulation-*.json）与 SPA 页面一起回填为 page_view。
 *
 * 用法：
 *   node scripts/backfill-nginx.mjs --dry-run [--log-dir DIR] [--db-path PATH]
 *       [--since ISO] [--until ISO] [--force] [--delete-only]
 *
 *   --dry-run     只统计不写库：打印按天计数、按 path 计数、去重 ip 数
 *   --log-dir     Nginx 日志目录（默认 /var/log/nginx）
 *   --db-path     analytics.db 路径（默认 ../qdii-notify/subscribers.db.analytics.db）
 *   --since（含） 默认 2026-08-25T00:00:00+08:00
 *   --until（不含）默认 2026-09-08T13:38:00+08:00（= 05:38Z，与线上最早埋点衔接）
 *   --force       已存在 nginx: 回填数据时仍继续写入（默认报错退出）
 *   --delete-only 仅删除 visitor_id LIKE 'nginx:%' 的回填数据后退出（可重来）
 *
 * 安全：
 *   - 只写 site_events，不碰其它表；写入前提示先备份生产库。
 *   - 幂等：未加 --force 且库里已有 nginx: 数据时拒绝写入；
 *     加 --delete-only 可删除上次回填后重来。
 *
 * 行格式：event='page_view'，visitor_id='nginx:'+sha1(ip|ua)[0:16]，
 *   visit_id='nginx:'+sha1(ip|ua|beijing_date)[0:16]，duration_ms=0，
 *   meta=JSON({path})，ip=真实 ip，created_at=UTC ISO。
 *   visitor_id 非 UUID 但无妨：回填直接写库，绕过 parseTrackPayload 的 UUID 校验。
 */
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import Database from 'better-sqlite3'

const DEFAULT_SINCE = '2026-08-25T00:00:00+08:00'
const DEFAULT_UNTIL = '2026-09-08T13:38:00+08:00' // = 2026-09-08T05:38:00Z
const BACKFILL_PREFIX = 'nginx:'

// ---- CLI 参数 ----
function parseArgs(argv) {
  const out = {
    dryRun: false,
    force: false,
    deleteOnly: false,
    logDir: '/var/log/nginx',
    dbPath: join(import.meta.dirname ?? '.', '..', '..', 'qdii-notify', 'subscribers.db.analytics.db'),
    since: DEFAULT_SINCE,
    until: DEFAULT_UNTIL,
  }
  // import.meta.dirname 需要 Node 20.11+；兜底用 cwd 相对路径
  if (!import.meta.dirname) {
    out.dbPath = join(process.cwd(), 'qdii-notify', 'subscribers.db.analytics.db')
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--force') out.force = true
    else if (a === '--delete-only') out.deleteOnly = true
    else if (a === '--log-dir') out.logDir = argv[++i]
    else if (a === '--db-path') out.dbPath = argv[++i]
    else if (a === '--since') out.since = argv[++i]
    else if (a === '--until') out.until = argv[++i]
    else if (a === '--help' || a === '-h') {
      console.log(`用法: node scripts/backfill-nginx.mjs --dry-run [--log-dir DIR] [--db-path PATH] [--since ISO] [--until ISO] [--force] [--delete-only]\n默认值: --since ${DEFAULT_SINCE} --until ${DEFAULT_UNTIL}`)
      process.exit(0)
    } else {
      console.error(`未知参数: ${a}（--help 查看用法）`)
      process.exit(2)
    }
  }
  return out
}

// ---- 日志行解析（combined 格式） ----
// 例：1.2.3.4 - - [08/Sep/2026:12:00:01 +0800] "GET /qdii?x=1 HTTP/1.1" 200 1234 "-" "Mozilla/5.0 ..."
const COMBINED_RE = /^(\S+) \S+ \S+ \[([^\]]+)\] "([A-Z]+) (\S+) [^"]*" (\d{3}) \S+ "[^"]*" "(.*)"\s*$/
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }

/** "08/Sep/2026:12:00:01 +0800" → UTC 毫秒时间戳；解析失败返回 NaN */
export function parseTimeLocal(s) {
  const m = /^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(s)
  if (!m) return NaN
  const [, dd, mon, yyyy, hh, mm, ss, sign, oh, om] = m
  const month = MONTHS[mon]
  if (month === undefined) return NaN
  const offMin = Number(oh) * 60 + Number(om)
  const asUtc = Date.UTC(Number(yyyy), month, Number(dd), Number(hh), Number(mm), Number(ss))
  return sign === '+' ? asUtc - offMin * 60000 : asUtc + offMin * 60000
}

/** 解析一行；失败返回 null。成功返回 { ip, tsMs, method, path, status, ua }，path 已去掉 query/hash */
export function parseLine(line) {
  const m = COMBINED_RE.exec(line)
  if (!m) return null
  const [, ip, timeLocal, method, rawTarget, statusStr, ua] = m
  const tsMs = parseTimeLocal(timeLocal)
  if (!Number.isFinite(tsMs)) return null
  let path = rawTarget.split('?')[0].split('#')[0]
  if (!path.startsWith('/')) return null
  try {
    path = decodeURIComponent(path)
  } catch {
    return null // 非法百分号编码视为脏行丢弃
  }
  return { ip, tsMs, method, path, status: Number(statusStr), ua }
}

// ---- 页面保留规则 ----

/** 精确保留的 SPA 页面（query 去掉后精确匹配） */
const EXACT_PAGES = new Set(['/', '/qdii', '/qdii/', '/qdii/dca', '/profile', '/resume', '/articles', '/project', '/project/'])
const PROJECT_PREFIX = '/project/'
const PROJECT_ID_RE = /^[a-z0-9-]+$/

/** 前缀剔除：命中任一即丢弃（纯数据接口 / 静态资源 / 其它站点共用 Nginx 的 location） */
const EXCLUDE_PREFIXES = [
  '/assets/',
  '/icons/',
  '/api/',
  '/kada/',
  '/dang-analysis/api/',
  '/yessir/',
  '/background-api/',
]
/** 静态资源后缀剔除（小写比较；woff* 覆盖 woff/woff2） */
const EXCLUDE_EXTS = ['.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.map', '.txt', '.xml']
const EXACT_EXCLUDE = new Set(['/favicon.ico'])
/** /qdii/ 下的 .json 数据接口同样保留回填（如 data.json、simulation-data.json、simulation-events.json） */
/**
 * 是否保留为 page_view：
 *  - 仅 GET + status 200
 *  - 先做排除（静态资源 / 非本站 location）
 *  - 再做保留（SPA 页面精确匹配、/qdii/ 下的 .json 数据接口，或 /project/<合法id>）
 *  - /project/<id> 必须全小写 [a-z0-9-]+，路径含点（如 .env/.git/phpinfo 路径）一律丢弃防攻击路径
 */
export function keepPath(path) {
  if (EXACT_EXCLUDE.has(path)) return false
  const lower = path.toLowerCase()
  if (EXCLUDE_EXTS.some((ext) => lower.endsWith(ext))) return false
  if (lower.endsWith('.json')) {
    // 数据接口保留：仅 /qdii/ 下的 .json 回填，其它未知 .json 仍剔除
    if (!(lower.startsWith('/qdii/') && lower.endsWith('.json'))) return false
  } else if (EXCLUDE_PREFIXES.some((p) => lower.startsWith(p))) return false
  if (EXACT_PAGES.has(path)) return true
  if (lower.startsWith('/qdii/') && lower.endsWith('.json')) return true // 数据接口：meta.path 存原始 path
  if (path === PROJECT_PREFIX || path.startsWith(PROJECT_PREFIX)) {
    const rest = path.slice(PROJECT_PREFIX.length).replace(/\/+$/, '')
    if (!rest) return true // /project/ 本体
    if (rest.includes('/')) return false // 仅允许单层 /project/<id>
    if (rest.includes('.')) return false // .env/.git/phpinfo 等攻击路径
    return PROJECT_ID_RE.test(rest)
  }
  return false
}

// ---- ID 生成 ----

function sha16(s) {
  return createHash('sha1').update(s, 'utf8').digest('hex').slice(0, 16)
}
/** UTC ISO → 北京时间日期 YYYY-MM-DD（与 stats.js beijingDate 口径一致） */
export function beijingDateOf(tsMs) {
  return new Date(tsMs + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

export function buildRow({ ip, tsMs, path, ua }) {
  const day = beijingDateOf(tsMs)
  return {
    event: 'page_view',
    visitor_id: `${BACKFILL_PREFIX}${sha16(`${ip}|${ua}`)}`,
    visit_id: `${BACKFILL_PREFIX}${sha16(`${ip}|${ua}|${day}`)}`,
    duration_ms: 0,
    meta: JSON.stringify({ path }),
    ip,
    created_at: new Date(tsMs).toISOString(),
  }
}

// ---- 日志文件枚举与读取 ----

function listLogFiles(logDir) {
  if (!existsSync(logDir) || !statSync(logDir).isDirectory()) {
    console.error(`日志目录不存在: ${logDir}`)
    process.exit(2)
  }
  // access.log 本体 + 轮转（access.log.1 / access.log-*.gz 等），字典序即时间序
  const files = readdirSync(logDir)
    .filter((f) => f === 'access.log' || f.startsWith('access.log.') || (f.endsWith('.gz') && f.includes('access')))
    .sort()
    .map((f) => join(logDir, f))
  if (files.length === 0) {
    console.error(`日志目录下没有 access.log* 文件: ${logDir}`)
    process.exit(2)
  }
  return files
}

function readLines(file, onLine) {
  return new Promise((resolve, reject) => {
    let stream = createReadStream(file)
    if (file.endsWith('.gz')) stream = stream.pipe(createGunzip())
    const rl = createInterface({ input: stream, crlfDelay: Infinity })
    rl.on('line', onLine)
    rl.on('close', resolve)
    rl.on('error', reject)
    stream.on('error', reject)
  })
}

// ---- 主流程 ----

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const sinceMs = Date.parse(opts.since)
  const untilMs = Date.parse(opts.until)
  if (!Number.isFinite(sinceMs) || !Number.isFinite(untilMs) || sinceMs >= untilMs) {
    console.error(`--since/--until 非法: ${opts.since} / ${opts.until}`)
    process.exit(2)
  }

  console.log('=== Nginx 回填 site_events ===')
  console.log(`日志目录: ${opts.logDir}`)
  console.log(`窗口: [${new Date(sinceMs).toISOString()}, ${new Date(untilMs).toISOString()})`)
  if (!opts.dryRun && !opts.deleteOnly) {
    console.log(`目标库: ${opts.dbPath}`)
    console.log('⚠️  只读不破坏原有数据：写入前请先备份生产库，例如：')
    console.log(`   cp /opt/qdii-notify/subscribers.db.analytics.db /tmp/analytics-backup-$(date +%F).db`)
  }

  // --delete-only：只删回填数据
  if (opts.deleteOnly) {
    const db = new Database(opts.dbPath, { timeout: 5000 })
    try {
      const n = db.prepare(`SELECT COUNT(*) AS n FROM site_events WHERE visitor_id LIKE 'nginx:%'`).get()?.n ?? 0
      if (opts.dryRun) {
        console.log(`[dry-run] 将删除 ${n} 条 nginx: 回填数据（未执行）`)
      } else {
        const info = db.prepare(`DELETE FROM site_events WHERE visitor_id LIKE 'nginx:%'`).run()
        console.log(`已删除 ${info.changes} 条 nginx: 回填数据`)
      }
    } finally {
      db.close()
    }
    return
  }

  const files = listLogFiles(opts.logDir)
  console.log(`日志文件(${files.length}): ${files.join(', ')}`)

  const rows = []
  const byDay = new Map()
  const byPath = new Map()
  const ips = new Set()
  let total = 0
  let badLine = 0
  let outOfWindow = 0
  let skippedMethodStatus = 0
  let skippedPath = 0

  for (const file of files) {
    await readLines(file, (line) => {
      if (!line.trim()) return
      total += 1
      const p = parseLine(line)
      if (!p) {
        badLine += 1
        return
      }
      if (p.tsMs < sinceMs || p.tsMs >= untilMs) {
        outOfWindow += 1
        return
      }
      if (p.method !== 'GET' || p.status !== 200) {
        skippedMethodStatus += 1
        return
      }
      if (!keepPath(p.path)) {
        skippedPath += 1
        return
      }
      const row = buildRow(p)
      rows.push(row)
      ips.add(p.ip)
      const day = beijingDateOf(p.tsMs)
      byDay.set(day, (byDay.get(day) ?? 0) + 1)
      byPath.set(p.path, (byPath.get(p.path) ?? 0) + 1)
    })
    console.log(`  已扫描 ${file}: 累计保留 ${rows.length}`)
  }

  console.log('--- dry-run 统计 ---')
  console.log(`总行数: ${total}, 保留: ${rows.length}, 解析失败: ${badLine}, 窗口外: ${outOfWindow}, 非GET/非200: ${skippedMethodStatus}, 路径剔除: ${skippedPath}`)
  console.log(`去重 ip 数: ${ips.size}`)
  console.log('按天计数（北京时间）:')
  for (const [d, n] of [...byDay.entries()].sort()) console.log(`  ${d}: ${n}`)
  console.log('按 path 计数:')
  for (const [p, n] of [...byPath.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n}  ${p}`)

  if (opts.dryRun) {
    console.log('[dry-run] 未写库。')
    return
  }

  if (!existsSync(opts.dbPath)) {
    console.error(`目标库不存在: ${opts.dbPath}（用 --db-path 指定，或先 --dry-run 确认）`)
    process.exit(2)
  }
  const db = new Database(opts.dbPath, { timeout: 5000 })
  try {
    db.pragma('journal_mode = WAL')
    const existing = db.prepare(`SELECT COUNT(*) AS n FROM site_events WHERE visitor_id LIKE 'nginx:%'`).get()?.n ?? 0
    if (existing > 0 && !opts.force) {
      console.error(`库里已有 ${existing} 条 nginx: 回填数据，拒绝重复写入。确认覆盖请加 --force，或先 --delete-only 删除后重来。`)
      process.exit(3)
    }
    const stmt = db.prepare(`
      INSERT INTO site_events (event, visitor_id, visit_id, duration_ms, meta, ip, created_at)
      VALUES (@event, @visitor_id, @visit_id, @duration_ms, @meta, @ip, @created_at)
    `)
    const insertAll = db.transaction((list) => {
      for (const r of list) stmt.run(r)
    })
    const BATCH = 1000
    for (let i = 0; i < rows.length; i += BATCH) insertAll(rows.slice(i, i + BATCH))
    console.log(`✅ 已写入 ${rows.length} 条 page_view（事务批量插入，每批 ${BATCH}）。`)
    const min = db.prepare(`SELECT MIN(created_at) AS t FROM site_events`).get()?.t
    console.log(`site_events 最早: ${min}`)
  } finally {
    db.close()
  }
}

await main()
