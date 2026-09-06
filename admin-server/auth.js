/**
 * 鉴权：单管理员密码 + HMAC 签名会话 cookie（无状态，无用户表）。
 *
 * - 会话令牌：`<过期毫秒时间戳>.<HMAC_SHA256(secret, "admin:<exp>")>`，7 天有效
 * - Cookie：HttpOnly + Secure + SameSite=Lax（spec §8）
 * - 密码比较：SHA-256 归一长度后 timingSafeEqual，防时序侧信道
 * - 写操作（POST/PUT/DELETE）要求 Origin/Referer 命中白名单（配合 SameSite=Lax 防 CSRF）
 */
import { createHmac, timingSafeEqual, createHash } from 'node:crypto'

export const SESSION_COOKIE = 'pmtools_admin_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

function sessionHmac(secret, exp) {
  return createHmac('sha256', secret).update(`admin:${exp}`).digest('hex')
}

/** 签发会话令牌；nowMs 仅测试用（构造过期令牌） */
export function signSession(secret, nowMs = Date.now()) {
  const exp = nowMs + SESSION_TTL_MS
  return { token: `${exp}.${sessionHmac(secret, exp)}`, exp }
}

/** 校验令牌：签名一致且未过期 */
export function verifySession(secret, token, nowMs = Date.now()) {
  if (typeof token !== 'string') return false
  const dot = token.indexOf('.')
  if (dot === -1) return false
  const exp = Number(token.slice(0, dot))
  const sig = token.slice(dot + 1)
  if (!Number.isFinite(exp) || exp <= nowMs) return false
  const expected = Buffer.from(sessionHmac(secret, exp), 'hex')
  const actual = Buffer.from(sig, 'hex')
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

/** 等长归一的常数时间字符串比较（用于密码校验） */
export function constantTimeEqual(a, b) {
  const ha = createHash('sha256').update(String(a)).digest()
  const hb = createHash('sha256').update(String(b)).digest()
  return timingSafeEqual(ha, hb)
}

/** 内存速率限制（同 qdii-notify 模式）；windowMs/max 参数化，实例在 createApp 内创建以隔离测试 */
export function makeRateLimit(windowMs, max) {
  const rateMap = new Map()
  let checks = 0
  return function rateLimit(req, res, next) {
    checks += 1
    if (checks % 100 === 0) {
      const now = Date.now()
      for (const [k, v] of rateMap) {
        if (now - v.at > windowMs) rateMap.delete(k)
      }
    }
    const key = req.ip || 'unknown'
    const now = Date.now()
    const rec = rateMap.get(key) || { count: 0, at: now }
    if (now - rec.at > windowMs) {
      rec.count = 0
      rec.at = now
    }
    rec.count += 1
    rateMap.set(key, rec)
    if (rec.count > max) {
      return res.status(429).json({ ok: false, message: '操作过于频繁，请稍后再试' })
    }
    next()
  }
}

export function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim()
  }
  return out
}

export function sessionCookie(token) {
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000)
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`
}

export function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

/** 写操作来源校验：Origin 优先，Referer 兜底；两者都缺视为不可信 */
export function isAllowedOrigin(req, allowedOrigins) {
  const raw = req.headers.origin || req.headers.referer || ''
  if (!raw) return false
  let origin
  try {
    origin = new URL(raw).origin
  } catch {
    return false
  }
  return allowedOrigins.includes(origin)
}

/** requireAuth 中间件工厂：cookie 验签失败一律 401 */
export function makeRequireAuth(secret) {
  return function requireAuth(req, res, next) {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    if (!verifySession(secret, token)) {
      return res.status(401).json({ ok: false, message: '未登录或会话已过期' })
    }
    next()
  }
}
