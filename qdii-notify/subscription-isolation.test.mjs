// 使用真实 server/db/notify/detect 源码与临时 SQLite；替换 HTTP 监听、邮件和 cron，绝不发信或读生产配置。
// node --test qdii-notify/subscription-isolation.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import * as fs from 'node:fs'
import * as crypto from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import Database from 'better-sqlite3'

async function harness({ baseline = false, fault = '' } = {}) {
  const directory = fs.mkdtempSync(join(tmpdir(), 'qdii-isolation-'))
  const dbPath = join(directory, 'subscribers.db')
  const analyticsPath = `${dbPath}.analytics.db`
  const config = { dbPath, dataJsonPath: join(directory, 'data.json'), snapshotPath: join(directory, 'snapshot.json'),
    port: 0, notifyCron: '0 8 * * *;10 12,18 * * *', mailProvider: 'mock',
    code: { ttlMinutes: 10, maxSendPerDay: 10, maxAttempts: 5 } }
  const opened = []; const schedules = []; const codes = []; const mails = []; const logs = []
  const routes = new Map(); let listening = false; let sendFailure = false
  const app = {
    use() {}, set() {},
    post(path, ...handlers) { routes.set(`POST ${path}`, handlers) },
    get(path, ...handlers) { routes.set(`GET ${path}`, handlers) },
    listen(_port, callback) { listening = true; callback() },
  }
  const express = Object.assign(() => app, { json: () => () => {} })
  function IsolatedDatabase(path, options) {
    assert.ok(path.startsWith(directory + '/'), '禁止打开临时目录外的数据库')
    const db = new Database(path, options); opened.push(db); return db
  }
  if (fault === 'corrupt') fs.writeFileSync(analyticsPath, 'not a sqlite database')
  if (fault === 'unopenable') fs.mkdirSync(analyticsPath)
  const runtime = {
    console: { log: (...args) => logs.push(args), warn: (...args) => logs.push(args), error: (...args) => logs.push(args) },
    process: { argv: [] },
  }
  const stubs = {
    'test-runtime': runtime,
    express: { default: express }, 'better-sqlite3': { default: IsolatedDatabase },
    'node:fs': fs, 'node:crypto': crypto,
    'node-cron': { default: { validate: () => true, schedule: (expression, callback) => schedules.push({ expression, callback }) } },
    'config.js': { config, assertMailConfigured() {} },
    'mailer.js': {
      async sendVerificationCode(email, code) { codes.push({ email, code }); return true },
      buildMailBody(changes) { return { subject: 'test', changes } },
      async sendToSubscribers(recipients, body) {
        mails.push({ recipients, body });
        return sendFailure ? { sent: 0, failed: recipients.length } : { sent: recipients.length, failed: 0 }
      },
    },
  }
  const fixtureKey = `qdii-test-${crypto.randomUUID()}`
  globalThis[fixtureKey] = stubs
  fs.writeFileSync(join(directory, 'package.json'), JSON.stringify({ type: 'module' }))
  for (const [name, values] of Object.entries(stubs)) {
    if (name.startsWith('node:')) continue
    const filename = name.endsWith('.js') ? name : `mock-${name}.js`
    const exports = Object.keys(values).map(key => key === 'default'
      ? 'export default stub.default;'
      : `export const ${key} = stub[${JSON.stringify(key)}];`).join('\n')
    fs.writeFileSync(join(directory, filename), `const stub = globalThis[${JSON.stringify(fixtureKey)}][${JSON.stringify(name)}];\n${exports}`)
  }
  for (const name of ['server.js', 'db.js', 'notify.js', 'detect.js', 'analytics.js']) {
    if (fault === 'missing' && name === 'analytics.js') continue
    let source = baseline && ['server.js', 'db.js'].includes(name)
      ? execFileSync('git', ['show', `HEAD:qdii-notify/${name}`], { encoding: 'utf8' })
      : fs.readFileSync(new URL(name, import.meta.url), 'utf8')
    for (const external of ['express', 'better-sqlite3', 'node-cron']) {
      source = source.replace(`from '${external}'`, `from './mock-${external}.js'`)
    }
    // 仅替换外部依赖和进程输出；订阅、邮件调度及数据库操作使用原始源码。
    fs.writeFileSync(join(directory, name), `import { console, process } from './mock-test-runtime.js';\n${source}`)
  }
  const cleanup = () => {
    for (const db of opened) if (db.open) db.close()
    fs.rmSync(directory, { recursive: true, force: true })
    delete globalThis[fixtureKey]
  }
  try {
    await import(pathToFileURL(join(directory, 'server.js')).href)
  } catch (error) { cleanup(); throw error }
  return {
    db: await import(pathToFileURL(join(directory, 'db.js')).href),
    notify: await import(pathToFileURL(join(directory, 'notify.js')).href),
    config, analyticsPath, listening, schedules, codes, mails, logs, cleanup,
    setSendFailure(value) { sendFailure = value },
    openSubscriptionDb: () => new IsolatedDatabase(dbPath),
    openAnalyticsDb: () => new IsolatedDatabase(analyticsPath),
    async call(method, path, body = {}, ip = 'test-ip') {
      const handlers = routes.get(`${method} ${path}`)
      assert.ok(handlers, `missing route ${path}`)
      const req = { body, query: body, ip }
      const res = { statusCode: 200, body: null, ended: false,
        status(code) { this.statusCode = code; return this },
        json(value) { this.body = value; this.ended = true; return this },
        send(value) { this.body = value; this.ended = true; return this },
        end() { this.ended = true; return this }, setHeader() {},
      }
      for (const handler of handlers) {
        let next = false
        await handler(req, res, () => { next = true })
        if (!next) break
      }
      assert.equal(res.ended, true)
      return res
    },
  }
}

const payload = { event: 'dca_start', visitor_id: '0123abcd-4567-4ef0-ab89-cdef01234567', visit_id: '0123abcd-4567-4ef0-ab89-cdef01234568', duration_ms: 1000 }

for (const scenario of ['baseline', 'normal', 'missing', 'corrupt', 'unopenable', 'locked']) {
  test(`${scenario}：订阅/验证码/退订/恢复/定时邮件与快照不受埋点影响`, async () => {
    const h = await harness({ baseline: scenario === 'baseline', fault: scenario })
    try {
      assert.equal(h.listening, true)
      assert.deepEqual(h.schedules.map(s => s.expression), ['0 8 * * *', '10 12,18 * * *'])
      assert.equal(h.codes.length + h.mails.length, 0, '服务启动不发信')
      const existing = h.db.subscribe('existing@example.test')
      if (scenario !== 'baseline') {
        const subscriptionDb = h.openSubscriptionDb()
        assert.equal(subscriptionDb.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='dca_events'").get().n, 0)
        let blocker
        if (scenario === 'locked') { blocker = h.openAnalyticsDb(); blocker.exec('BEGIN IMMEDIATE') }
        const before = performance.now()
        for (let i = 0; i < 60; i++) assert.equal((await h.call('POST', '/api/track', payload)).statusCode, 204)
        assert.ok(performance.now() - before < 1000, '埋点锁冲突不能触发默认 5 秒同步等待')
        if (blocker) blocker.exec('ROLLBACK')
        if (scenario === 'normal') assert.equal(h.openAnalyticsDb().prepare('SELECT count(*) AS n FROM dca_events').get().n, 60)
        if (scenario === 'locked') {
          await h.call('POST', '/api/track', payload, 'another-ip')
          assert.equal(h.openAnalyticsDb().prepare('SELECT count(*) AS n FROM dca_events').get().n, 0, '写入失败后关闭统计，不反复重试')
        }
        assert.equal(h.db.countAll(), 1, '埋点不得改变订阅记录')
      }
      const email = 'new@example.test'
      assert.equal((await h.call('POST', '/api/send-code', { email })).statusCode, 200)
      assert.equal(h.codes.length, 1)
      const code = h.codes[0].code
      assert.equal((await h.call('POST', '/api/subscribe', { email, code: code === '000000' ? '111111' : '000000' })).statusCode, 400)
      assert.equal((await h.call('POST', '/api/subscribe', { email, code })).statusCode, 200)
      assert.equal((await h.call('GET', '/api/status', { email })).body.subscribed, true)
      assert.equal((await h.call('GET', '/api/unsubscribe', { token: existing.token })).statusCode, 200)
      assert.equal(h.db.isSubscribed('existing@example.test'), false)
      await h.call('POST', '/api/send-code', { email: 'existing@example.test' })
      assert.equal((await h.call('POST', '/api/subscribe', h.codes.at(-1))).body.existed, true)
      assert.equal(h.db.listActiveEmails().find(row => row.email === 'existing@example.test').token, existing.token)
      await h.call('GET', '/api/unsubscribe', { token: existing.token })
      const fund = { code: '018966', name: '测试纳斯达克人民币A', status: '限大额', redeem: '开放赎回', limit_amount: 2000 }
      const writeFund = amount => fs.writeFileSync(h.config.dataJsonPath, JSON.stringify({ updated_at: '2026-09-06', funds: [{ ...fund, limit_amount: amount }] }))
      writeFund(2000)
      assert.equal((await h.notify.runOnce()).firstRun, true)
      assert.equal(h.mails.length, 0)
      writeFund(1000)
      assert.equal((await h.notify.runOnce()).sent, 1)
      assert.equal(h.mails[0].recipients[0].email, email, '只向有效订阅者发信')
      assert.equal((await h.notify.runOnce()).changes, 0)
      assert.equal(h.mails.length, 1, '无新变动不重复发送')
      const snapshot = fs.readFileSync(h.config.snapshotPath, 'utf8')
      writeFund(500); h.setSendFailure(true)
      await assert.rejects(h.notify.runOnce(), /全部发送失败/)
      assert.equal(fs.readFileSync(h.config.snapshotPath, 'utf8'), snapshot, '全失败不推进快照')
      h.setSendFailure(false)
      assert.equal((await h.notify.runOnce()).sent, 1)
      assert.equal((await h.notify.runOnce()).changes, 0)
      assert.equal((await h.call('GET', '/api/health')).body.ok, true)
    } finally { h.cleanup() }
  })
}
