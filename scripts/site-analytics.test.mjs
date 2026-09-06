/**
 * 全站埋点测试：与 dca-analytics.test.mjs 同一套 vm harness 风格。
 * 覆盖：page_view/leave、路由切换收口、心跳快照、隐藏不计时、
 * 开发环境默认关闭与调试开关、点击事件立即上报、监听与定时器清理。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../src/utils/analytics.js', import.meta.url), 'utf8')

function harness({ host = 'pmtools.com.cn', debug = false, storageThrows = false } = {}) {
  let now = 0
  let uuidCount = 0
  let timerCount = 0
  const timers = new Map()
  const intervals = new Map()
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
  if (debug) values.set('pmtools_analytics_debug', '1')
  const window = {
    ...makeTarget(),
    location: { hostname: host },
    crypto: { randomUUID: () => `0123abcd-4567-4ef0-ab89-${String(++uuidCount).padStart(12, '0')}` },
    localStorage: {
      getItem: (k) => { if (storageThrows) throw Error('denied'); return values.get(k) },
      setItem(k, v) { values.set(k, v) },
      removeItem: (k) => values.delete(k),
    },
    setTimeout(fn) { timers.set(++timerCount, fn); return timerCount },
    clearTimeout(id) { timers.delete(id) },
    setInterval(fn, period) { intervals.set(++timerCount, { fn, period }); return timerCount },
    clearInterval(id) { intervals.delete(id) },
  }
  const document = { ...makeTarget(), visibilityState: 'visible' }
  const context = vm.createContext({
    window, document, performance: { now: () => now },
    navigator: { sendBeacon(_url, blob) { events.push(...JSON.parse(blob.text).events); return true } },
    Blob: class { constructor(parts) { this.text = parts.join('') } },
  })
  vm.runInContext(source.replaceAll('export function ', 'function '), context)
  return {
    create: () => vm.runInContext('createSiteSession()', context),
    trackEvent: (event, meta) => vm.runInContext(`trackEvent(${JSON.stringify(event)}, ${JSON.stringify(meta)})`, context),
    advance: (ms) => { now += ms },
    fireIntervals: () => { for (const { fn } of intervals.values()) fn() },
    visibility(state) { document.visibilityState = state; document.emit('visibilitychange') },
    window, document, events, intervals,
  }
}

test('进入路径上报 page_view，切换路径收口上一路径', () => {
  const h = harness(); const s = h.create()
  s.trackPath('/'); h.advance(30000)
  s.trackPath('/project/demo'); h.advance(5000)
  const views = h.events.filter((e) => e.event === 'page_view')
  const leaves = h.events.filter((e) => e.event === 'page_leave')
  assert.deepEqual(views.map((e) => e.meta.path), ['/', '/project/demo'])
  assert.equal(leaves.length, 1)
  assert.equal(leaves[0].meta.path, '/')
  assert.equal(leaves[0].duration_ms, 30000)
  // 同一 visit_id 贯穿整个 SPA 访问
  assert.equal(new Set(h.events.map((e) => e.visit_id)).size, 1)
  s.dispose()
})

test('心跳补报累计快照（服务端 MAX 去重），dispose 收口最终值', () => {
  const h = harness(); const s = h.create()
  s.trackPath('/'); h.advance(60000); h.fireIntervals()
  h.advance(30000); h.fireIntervals()
  s.dispose()
  const leaves = h.events.filter((e) => e.event === 'page_leave').map((e) => e.duration_ms)
  // 两次心跳 + dispose 收口：60s、90s、90s——服务端取 MAX 不虚增
  assert.deepEqual(leaves, [60000, 90000, 90000])
})

test('切后台立即结算且不计时，恢复后继续累加', () => {
  const h = harness(); const s = h.create()
  s.trackPath('/'); h.advance(10000); h.visibility('hidden')
  assert.equal(h.events.at(-1).duration_ms, 10000)
  h.advance(90000)
  assert.equal(h.intervals.size, 1) // 心跳保留但隐藏期间不产生新快照
  h.visibility('visible'); h.advance(20000); s.dispose()
  assert.equal(h.events.at(-1).duration_ms, 30000)
})

test('重复 trackPath 同一路径不重复上报', () => {
  const h = harness(); const s = h.create()
  s.trackPath('/'); h.advance(1000); s.trackPath('/'); s.trackPath('/')
  assert.equal(h.events.filter((e) => e.event === 'page_view').length, 1)
  s.dispose()
})

test('dispose 清理监听与心跳定时器', () => {
  const h = harness(); const s = h.create()
  s.trackPath('/'); s.dispose(); s.dispose()
  assert.equal(h.window.count() + h.document.count() + h.intervals.size, 0)
  h.fireIntervals()
  h.advance(60000)
  assert.equal(h.events.filter((e) => e.event === 'page_leave').length, 1) // 仅 dispose 收口那一条
})

test('生产环境默认上报；本地开发默认关闭、调试开关开启后上报', () => {
  const prod = harness(); const s = prod.create()
  s.trackPath('/'); s.dispose()
  assert.ok(prod.events.length > 0)

  const dev = harness({ host: 'localhost' })
  const ds = dev.create(); ds.trackPath('/'); dev.trackEvent('project_click', { project_id: 'x' }); ds.dispose()
  assert.equal(dev.events.length, 0)

  const dbg = harness({ host: 'localhost', debug: true })
  const bs = dbg.create(); bs.trackPath('/'); bs.dispose()
  assert.ok(dbg.events.length > 0)
})

test('trackEvent 立即上报点击事件', () => {
  const h = harness()
  h.trackEvent('project_click', { project_id: 'qdii' })
  assert.deepEqual(h.events, [{ event: 'project_click', visitor_id: h.events[0].visitor_id, visit_id: '', duration_ms: 0, meta: { project_id: 'qdii' } }])
})

test('storage 不可用时站点会话静默停用', () => {
  const h = harness({ storageThrows: true })
  const s = h.create()
  s.trackPath('/'); s.dispose()
  assert.equal(h.events.length, 0)
})
