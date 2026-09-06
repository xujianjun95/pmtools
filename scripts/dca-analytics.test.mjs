import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../src/utils/analytics.js', import.meta.url), 'utf8')
function harness({ beaconThrows = false, storageThrows = false, host = 'pmtools.com.cn' } = {}) {
  let now = 0
  let uuidCount = 0
  let timerCount = 0
  const timers = new Map()
  const events = []
  const makeTarget = () => {
    const listeners = new Map()
    return {
      addEventListener(key, fn) { if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key).add(fn) },
      removeEventListener(key, fn) { listeners.get(key)?.delete(fn) },
      emit(key) { for (const fn of listeners.get(key) ?? []) fn() },
      count() { return [...listeners.values()].reduce((n, set) => n + set.size, 0) },
    }
  }
  const values = new Map()
  const window = {
    ...makeTarget(),
    location: { hostname: host },
    crypto: { randomUUID: () => `0123abcd-4567-4ef0-ab89-${String(++uuidCount).padStart(12, '0')}` },
    localStorage: {
      getItem: (k) => values.get(k),
      setItem(k, v) { if (storageThrows) throw Error('denied'); values.set(k, v) },
      removeItem: (k) => values.delete(k),
    },
    setTimeout(fn) { timers.set(++timerCount, fn); return timerCount },
    clearTimeout(id) { timers.delete(id) },
  }
  const document = { ...makeTarget(), visibilityState: 'visible' }
  const context = vm.createContext({
    window, document, performance: { now: () => now },
    navigator: { sendBeacon(_url, blob) { if (beaconThrows) throw Error('denied'); events.push(...JSON.parse(blob.text).events); return true } },
    Blob: class { constructor(parts) { this.text = parts.join('') } },
    fetch(_url, options) { events.push(...JSON.parse(options.body).events); return Promise.resolve() },
  })
  vm.runInContext(source.replaceAll('export function ', 'function '), context)
  return {
    create: () => vm.runInContext('createDcaSession()', context),
    advance: (ms) => { now += ms },
    visibility(state) { document.visibilityState = state; document.emit('visibilitychange') },
    window, document, events, timers,
  }
}

test('站内离开结算 60 秒，重复 dispose 不重复上报且清理监听', () => {
  const h = harness(); const s = h.create(); s.report('dca_view'); h.advance(60000); s.dispose(); s.dispose()
  assert.equal(h.events.at(-1).duration_ms, 60000)
  assert.equal(h.events.filter(e => e.event === 'dca_leave').length, 1)
  assert.equal(h.window.count() + h.document.count() + h.timers.size, 0)
})

test('切后台立即上报，后台不计时，恢复后累加可见时间', () => {
  const h = harness(); const s = h.create(); h.advance(10000); h.visibility('hidden')
  assert.equal(h.events.at(-1).duration_ms, 10000)
  h.advance(90000); h.visibility('visible'); h.advance(20000); s.dispose()
  assert.equal(h.events.at(-1).duration_ms, 30000)
})

test('离开后其他页面时间不混入，重进使用新 visit_id 和相同 visitor_id', () => {
  const h = harness(); const a = h.create(); h.advance(60000); a.dispose()
  h.advance(100000); h.visibility('hidden'); h.visibility('visible')
  const b = h.create(); h.advance(5000); b.dispose()
  assert.notEqual(h.events[0].visit_id, h.events[1].visit_id)
  assert.equal(h.events[0].visitor_id, h.events[1].visitor_id)
  assert.deepEqual(h.events.map(e => e.duration_ms), [60000, 5000])
})

test('往返缓存恢复继续计时，挂起时间不计入', () => {
  const h = harness(); const s = h.create(); h.advance(8000); h.window.emit('pagehide')
  h.advance(70000); h.window.emit('pageshow'); h.advance(2000); s.dispose()
  assert.equal(h.events.at(-1).duration_ms, 10000)
})

test('sendBeacon 抛异常使用 fetch 兜底；storage 不可用和本地开发不阻断', () => {
  const h = harness({ beaconThrows: true }); const s = h.create(); s.report('dca_start'); s.dispose()
  assert.equal(h.events[0].event, 'dca_start')
  for (const options of [{ storageThrows: true }, { host: 'localhost' }]) {
    const disabled = harness(options); const session = disabled.create(); session.report('dca_start'); session.dispose()
    assert.equal(disabled.events.length, 0)
  }
})

test('同一时刻重复开始不吞事件，超过单批限制自动分批', () => {
  const h = harness(); const s = h.create()
  for (let i = 0; i < 25; i++) s.report('dca_start')
  s.dispose()
  assert.equal(h.events.filter(e => e.event === 'dca_start').length, 25)
})

test('埋点限流与订阅隔离，同时保留订阅第 11 次限流', () => {
  const server = readFileSync(new URL('../qdii-notify/server.js', import.meta.url), 'utf8')
  const start = server.indexOf('const RATE_WINDOW')
  const context = vm.createContext({})
  vm.runInContext(server.slice(start, server.indexOf('const EMAIL_RE')), context)
  const result = vm.runInContext(`(() => {
    const req = { ip: 'same-ip' }; let status = 200
    const res = { status(n) { status = n; return this }, json() {} }
    for (let i = 0; i < 60; i++) trackRateLimit(req, res, () => {})
    rateLimit(req, res, () => {})
    const first = status
    for (let i = 0; i < 10; i++) rateLimit(req, res, () => {})
    return [first, status]
  })()`, context)
  assert.deepEqual(Array.from(result), [200, 429])
})
