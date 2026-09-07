/**
 * 「鉴往」使用统计上报：仅服务于 /qdii/dca 页面的产品指标
 * （多少用户用过、平均停留时长、人均游玩次数）。
 *
 * 设计约定：
 * - visitor_id 存 localStorage（随浏览器去重，清缓存才会变新用户）
 * - visit_id 每次进入页面重新生成，页内所有事件同属一次访问
 * - duration_ms 为本次访问内在鉴往页的累计停留毫秒数，离开时兜底补报
 * - 全部静默失败，绝不影响页面体验；开发环境（localhost）不上报
 */

const VISITOR_KEY = 'pmtools_visitor_id'
const STORAGE_TEST_KEY = '__pmtools_storage_test__'

function storageAvailable() {
  try {
    window.localStorage.setItem(STORAGE_TEST_KEY, '1')
    window.localStorage.removeItem(STORAGE_TEST_KEY)
    return true
  } catch {
    return false
  }
}

function uuid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  // 非安全上下文兜底（randomUUID 仅安全上下文可用，getRandomValues 始终可用）：按 RFC 4122 v4 拼装
  const bytes = new Uint8Array(16)
  window.crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** 稳定的访客标识（取不到 storage 时返回空串，服务端会丢弃该事件） */
export function getVisitorId() {
  if (!storageAvailable()) return ''
  try {
    let id = window.localStorage.getItem(VISITOR_KEY) || ''
    if (!id) {
      id = uuid()
      window.localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

function isLocalDev() {
  return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)
}

/** 每个页面实例独立计时、排队；累计快照可由服务端取 MAX 去重。 */
export function createDcaSession() {
  const noopSession = { report() {}, dispose() {} }
  let visitorId
  let visitId
  try {
    if (isLocalDev()) return noopSession
    visitorId = getVisitorId()
    if (!visitorId) return noopSession
    visitId = uuid()
  } catch {
    return noopSession
  }

  let visibleMs = 0
  let visibleSince = document.visibilityState === 'visible' ? performance.now() : null
  let disposed = false
  let flushTimer = null
  let pending = []

  const elapsedMs = () => visibleMs + (visibleSince === null ? 0 : performance.now() - visibleSince)
  const pauseClock = () => {
    if (visibleSince === null) return
    visibleMs += performance.now() - visibleSince
    visibleSince = null
  }
  const resumeClock = () => {
    if (!disposed && document.visibilityState === 'visible' && visibleSince === null) {
      visibleSince = performance.now()
    }
  }

  const flush = () => {
    window.clearTimeout(flushTimer)
    flushTimer = null
    if (!pending.length) return
    const events = pending
    pending = []
    let payload
    try {
      payload = JSON.stringify({ events })
    } catch {
      return
    }
    try {
      if (navigator.sendBeacon?.('/api/track', new Blob([payload], { type: 'application/json' }))) return
    } catch {
      // Beacon 被浏览器拒绝时继续尝试 fetch，不能中断页面卸载。
    }
    try {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {})
    } catch {
      // 统计失败不影响旅程和页面切换。
    }
  }

  const report = (event, meta = {}) => {
    if (disposed) return
    pending.push({
      event,
      visitor_id: visitorId,
      visit_id: visitId,
      duration_ms: Math.round(elapsedMs()),
      meta,
    })
    // 后端每批最多接收 20 条，避免前端积攒后被截断。
    if (pending.length >= 20) flush()
    else if (flushTimer === null) flushTimer = window.setTimeout(flush, 1000)
  }

  const checkpoint = () => {
    pauseClock()
    report('dca_leave')
    flush()
  }
  const onVisibility = () => {
    if (document.visibilityState === 'visible') resumeClock()
    else checkpoint()
  }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', checkpoint)
  // 从往返缓存恢复时组件不一定重新挂载，需要恢复可见计时。
  window.addEventListener('pageshow', resumeClock)

  return {
    report,
    dispose() {
      if (disposed) return
      checkpoint()
      disposed = true
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', checkpoint)
      window.removeEventListener('pageshow', resumeClock)
    },
  }
}

// ---------- 全站埋点（看板用，spec §6） ----------
// 与鉴往会话同一套约定：静默失败、只计可见时长、leave 快照由服务端按 visit+path 取 MAX 去重。
// 区别：一次 SPA 加载一个 visit_id；路由切换由 trackPath() 收口上一路径并开启新路径；
// 心跳每 60 秒补报累计快照，把崩溃/强杀的丢失窗口压到 1 分钟量级（尽力而为，非保证）。
const SITE_HEARTBEAT_MS = 60_000

/**
 * 上报开关：生产环境开启；本地开发默认关闭，localStorage 写入
 * pmtools_analytics_debug=1 可显式开启（供本地联调验证埋点入库）。
 */
function shouldTrack() {
  if (!isLocalDev()) return true
  try {
    return window.localStorage.getItem('pmtools_analytics_debug') === '1'
  } catch {
    return false
  }
}

/** 点击类事件立即上报（不进批量队列）；调用方不 await、失败静默 */
export function trackEvent(event, meta = {}) {
  try {
    if (!shouldTrack()) return
    const visitorId = getVisitorId()
    if (!visitorId) return
    const payload = JSON.stringify({
      events: [{ event, visitor_id: visitorId, visit_id: '', duration_ms: 0, meta }],
    })
    try {
      if (navigator.sendBeacon?.('/api/track', new Blob([payload], { type: 'application/json' }))) return
    } catch {
      // Beacon 被浏览器拒绝时继续尝试 fetch
    }
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // 统计失败不影响页面体验
  }
}

/**
 * 全站页面会话：page_view（进入路径）/ page_leave（离开、切换、心跳的累计快照）。
 * 服务端按 visit+path 取 MAX 去重，因此心跳重复快照不会虚增停留时长。
 */
export function createSiteSession() {
  const noopSession = { trackPath() {}, dispose() {} }
  let visitorId
  try {
    if (!shouldTrack()) return noopSession
    visitorId = getVisitorId()
    if (!visitorId) return noopSession
  } catch {
    return noopSession
  }
  const visitId = uuid()

  let currentPath = null
  // 同一 SPA visit 中可能返回之前的路径。按路径保存累计可见时长，
  // 这样服务端按 visit_id + path 取 MAX 时，重访不会丢掉前一段时长。
  const pathDurations = new Map()
  let visibleMs = 0
  let visibleSince = document.visibilityState === 'visible' ? performance.now() : null
  let disposed = false
  let heartbeatTimer = null

  const pauseClock = () => {
    if (visibleSince === null) return
    visibleMs += performance.now() - visibleSince
    visibleSince = null
  }
  const resumeClock = () => {
    if (!disposed && document.visibilityState === 'visible' && visibleSince === null) {
      visibleSince = performance.now()
    }
  }
  const send = (event, meta, durationMs) => {
    const payload = JSON.stringify({
      events: [{ event, visitor_id: visitorId, visit_id: visitId, duration_ms: Math.round(durationMs), meta }],
    })
    try {
      if (navigator.sendBeacon?.('/api/track', new Blob([payload], { type: 'application/json' }))) return
    } catch {
      // 落到 fetch
    }
    try {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {})
    } catch {
      // 统计失败不影响页面切换
    }
  }
  const checkpoint = () => {
    if (!currentPath) return
    pauseClock()
    pathDurations.set(currentPath, visibleMs)
    send('page_leave', { path: currentPath }, visibleMs)
    // 页面仍可见时立即恢复计时：心跳是快照不是离开，后续时长继续累加
    resumeClock()
  }
  const startHeartbeat = () => {
    window.clearInterval(heartbeatTimer)
    heartbeatTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') checkpoint()
    }, SITE_HEARTBEAT_MS)
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') resumeClock()
    else checkpoint()
  }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', checkpoint)
  window.addEventListener('pageshow', resumeClock)

  return {
    /** 路由进入新路径：收口上一路径（leave），开启 page_view 与心跳 */
    trackPath(path) {
      if (disposed || !path || path === currentPath) return
      checkpoint()
      currentPath = path
      visibleMs = pathDurations.get(path) || 0
      resumeClock()
      send('page_view', { path }, 0)
      startHeartbeat()
    },
    dispose() {
      if (disposed) return
      checkpoint()
      disposed = true
      window.clearInterval(heartbeatTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', checkpoint)
      window.removeEventListener('pageshow', resumeClock)
    },
  }
}
