/**
 * 埋点负载验证（上线前检查项，spec §12）：
 * 真实进程 + 临时库，向 /api/track 高频写入埋点，同时探测订阅侧 /api/health 与 /api/status，
 * 验证"埋点高负载下订阅接口正常"。邮件通道不配置（仅启动告警），cron 表达式置非法即不调度，绝不发信。
 *
 * 用法：node verify-track-load.mjs
 * 退出码：0 = 验证通过；1 = 存在失败项（会逐条打印）。
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import Database from 'better-sqlite3'

const BATCHES = 50 // 每批 20 条，共 1000 条；trackRateLimit 为 60 请求/10 分钟，保持在其下
const CONCURRENCY = 10
const HEALTH_SAMPLES = 60

const dir = mkdtempSync(join(tmpdir(), 'qdii-track-load-'))
const dbPath = join(dir, 'subscribers.db')
const port = 30000 + Math.floor(Math.random() * 20000)
const base = `http://127.0.0.1:${port}`

// 子进程 node 二进制：默认走 PATH（服务器可用）；必要时用 NODE_BIN 指定绝对路径
const NODE_BIN = process.env.NODE_BIN || 'node'
// 必须用 fileURLToPath 解码：workspace 路径含空格，URL.pathname 的 %20 会让 spawn 报 ENOENT
const SERVER_DIR = fileURLToPath(new URL('.', import.meta.url))

const server = spawn(NODE_BIN, ['server.js'], {
  cwd: SERVER_DIR,
  env: {
    ...process.env,
    PORT: String(port),
    DB_PATH: dbPath,
    DATA_JSON_PATH: join(dir, 'data.json'),
    SNAPSHOT_PATH: join(dir, 'snapshot.json'),
    NOTIFY_CRON: '0 0 30 2 *', // 语法合法但 2 月 30 日不存在 → 永不触发（initCron 对非法表达式会抛错）
    ALIYUN_DM_ACCESS_KEY_ID: '',
    ALIYUN_DM_ACCESS_KEY_SECRET: '',
  },
  stdio: ['ignore', 'ignore', 'pipe'],
})
server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitHealthy() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) return true
    } catch { /* 未就绪继续等 */ }
    await sleep(200)
  }
  return false
}

const uuid = '0123abcd-4567-4ef0-ab89-cdef01234567'
function makeBatch(batchIndex) {
  const events = []
  for (let i = 0; i < 20; i += 1) {
    // 前 10 批混入鉴往事件，其余为全站事件；都带 visit_id 模拟真实上报
    if (batchIndex < 10) {
      events.push({ event: 'dca_start', visitor_id: uuid, visit_id: uuid, duration_ms: i * 100, meta: { year: 2010, round_id: `r${i}` } })
    } else {
      events.push({ event: 'page_view', visitor_id: uuid, visit_id: uuid, duration_ms: 0, meta: { path: '/project/demo' } })
    }
  }
  return events
}

const failures = []
function check(name, ok, detail = '') {
  console.log(`${ok ? '✔' : '✖'} ${name}${detail ? `（${detail}）` : ''}`)
  if (!ok) failures.push(name)
}

try {
  if (!(await waitHealthy())) {
    console.error('✖ 服务未能在 10 秒内就绪')
    process.exit(1)
  }
  console.log(`✔ 服务就绪：${base}（临时库 ${dbPath}）`)

  // 探活走独立连接池：与写入 worker 共享 fetch 连接池时，测到的是客户端排队而非服务端延迟
  const probeAgent = new http.Agent({ keepAlive: true, maxSockets: 1 })
  const probe = (path) =>
    new Promise((resolve) => {
      const start = Date.now()
      const req = http.get(`${base}${path}`, { agent: probeAgent }, (res) => {
        res.resume()
        res.on('end', () => resolve({ ms: Date.now() - start, ok: res.statusCode === 200 }))
      })
      req.on('error', () => resolve({ ms: Date.now() - start, ok: false }))
    })
  const sampleHealth = async () => {
    const health = await probe('/api/health')
    const status = await probe('/api/status')
    return { ms: health.ms + status.ms, ok: health.ok && status.ok }
  }

  // 基线延迟
  const baseline = []
  for (let i = 0; i < 20; i += 1) baseline.push(await sampleHealth())

  // 负载阶段：埋点高频写入 + 订阅侧探测同时进行
  const trackStatuses = []
  const loaded = []
  let cursor = 0
  const worker = async () => {
    while (cursor < BATCHES) {
      const index = cursor
      cursor += 1
      const res = await fetch(`${base}/api/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: makeBatch(index) }),
      })
      trackStatuses.push(res.status)
    }
  }
  const workers = Array.from({ length: CONCURRENCY }, worker)
  const prober = (async () => {
    for (let i = 0; i < HEALTH_SAMPLES; i += 1) {
      loaded.push(await sampleHealth())
      await sleep(20)
    }
  })()
  await Promise.all([...workers, prober])

  const latency = (list) => list.map((s) => s.ms).sort((a, b) => a - b)
  const p95 = (list) => list[Math.floor(list.length * 0.95)] ?? list[list.length - 1]
  const baseP95 = p95(latency(baseline))
  const loadP95 = p95(latency(loaded))

  check(`埋点写入全部受理（${trackStatuses.length} 请求）`, trackStatuses.every((s) => s === 204))
  check(`负载期间订阅侧探活全部 200（${loaded.length} 次）`, loaded.every((s) => s.ok))
  check(`健康接口 p95 延迟无明显劣化`, loadP95 < Math.max(300, baseP95 * 5), `基线 p95=${baseP95}ms，负载 p95=${loadP95}ms`)

  server.kill('SIGTERM')
  await new Promise((r) => server.once('exit', r))

  const db = new Database(`${dbPath}.analytics.db`, { readonly: true })
  const dca = db.prepare("SELECT COUNT(*) AS n FROM dca_events").get().n
  const site = db.prepare("SELECT COUNT(*) AS n FROM site_events").get().n
  const siteIp = db.prepare("SELECT COUNT(DISTINCT ip) AS n FROM site_events WHERE ip != ''").get().n
  db.close()
  check(`dca_events 落库 200 条`, dca === 200, `实际 ${dca}`)
  check(`site_events 落库 800 条`, site === 800, `实际 ${site}`)
  check(`服务端补记的独立 IP 数为 1（仅本机来源）`, siteIp === 1, `实际 ${siteIp}`)
} finally {
  if (!server.killed) server.kill('SIGTERM')
  rmSync(dir, { recursive: true, force: true })
}

if (failures.length > 0) {
  console.error(`\n验证未通过：${failures.length} 项失败`)
  process.exit(1)
}
console.log('\n验证通过：埋点高负载下订阅接口正常。')
