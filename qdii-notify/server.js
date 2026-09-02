/**
 * QDII 通知服务 - Express API
 * 提供：订阅 / 退订 / 状态查询，并启动定时检测任务（notify.js）。
 * 部署：nginx 将 /api/* 反代到本服务的 PORT。
 */
import express from 'express'
import { config, assertMailConfigured } from './config.js'
import * as db from './db.js'
import { sendVerificationCode } from './mailer.js'
import { initCron } from './notify.js'

const app = express()
app.use(express.json())
// 部署在 nginx 反代之后：信任第一跳代理，让 req.ip 读到真实客户端 IP（X-Forwarded-For），
// 否则所有请求都来自 127.0.0.1，速率限制会变成全站共享一个桶
app.set('trust proxy', 1)

// 简单内存速率限制：同一 IP 每 10 分钟最多 10 次订阅请求
const rateMap = new Map()
const RATE_WINDOW = 10 * 60 * 1000
let rateChecks = 0
function rateLimit(req, res, next) {
  // 周期性清理过期条目，避免长跑后内存持续增长
  rateChecks += 1
  if (rateChecks % 100 === 0) {
    const now = Date.now()
    for (const [k, v] of rateMap) {
      if (now - v.at > RATE_WINDOW) rateMap.delete(k)
    }
  }
  const key = req.ip || 'unknown'
  const now = Date.now()
  const rec = rateMap.get(key) || { count: 0, at: now }
  if (now - rec.at > RATE_WINDOW) {
    rec.count = 0
    rec.at = now
  }
  rec.count += 1
  rateMap.set(key, rec)
  if (rec.count > 10) {
    return res.status(429).json({ ok: false, message: '操作过于频繁，请稍后再试' })
  }
  next()
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), subscribers: db.countAll() })
})

/** 发送验证码：POST /api/send-code  body: { email } */
app.post('/api/send-code', rateLimit, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, message: '请输入有效的邮箱地址' })
  }
  const todayCount = db.getTodayEmailSendCount(email)
  if (todayCount >= config.code.maxSendPerDay) {
    return res.status(429).json({ ok: false, message: '今日验证码发送次数已用完，请明天再试' })
  }
  const code = String(Math.floor(100000 + Math.random() * 900000))
  db.upsertEmailVerification(email, code, config.code.ttlMinutes)
  try {
    const sent = await sendVerificationCode(email, code, config.code.ttlMinutes)
    if (!sent) {
      return res.status(502).json({ ok: false, message: '验证码发送失败，请检查邮箱地址或稍后再试' })
    }
  } catch (err) {
    console.error('[send-code]', err)
    return res.status(502).json({ ok: false, message: '邮件通道未配置，无法发送验证码' })
  }
  db.incrementEmailSendCount(email)
  return res.json({ ok: true, message: '验证码已发送，请查收邮件' })
})

/** 订阅：POST /api/subscribe  body: { email, code }（验证码校验通过才会写入） */
app.post('/api/subscribe', rateLimit, (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const code = String(req.body?.code || '').trim()
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, message: '请输入有效的邮箱地址' })
  }
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ ok: false, message: '请输入 6 位数字验证码' })
  }
  const verification = db.getEmailVerification(email)
  if (!verification) {
    return res.status(400).json({ ok: false, message: '请先获取验证码' })
  }
  if (new Date(verification.expires_at) < new Date()) {
    db.deleteEmailVerification(email)
    return res.status(400).json({ ok: false, message: '验证码已过期，请重新获取' })
  }
  if (verification.attempts >= config.code.maxAttempts) {
    db.deleteEmailVerification(email)
    return res.status(400).json({ ok: false, message: '验证码尝试次数过多，请重新获取' })
  }
  if (verification.code !== code) {
    db.incrementVerificationAttempts(email)
    return res.status(400).json({ ok: false, message: '验证码错误，请检查后重试' })
  }
  db.deleteEmailVerification(email)
  try {
    const { existed } = db.subscribe(email)
    return res.json({
      ok: true,
      existed,
      message: existed ? '该邮箱已在订阅列表中，已重新激活订阅' : '订阅成功，额度变动时将邮件通知您',
    })
  } catch (err) {
    console.error('[subscribe]', err)
    return res.status(500).json({ ok: false, message: '订阅失败，请稍后再试' })
  }
})

/** 退订：GET /api/unsubscribe?token=xxx */
app.get('/api/unsubscribe', (req, res) => {
  const token = String(req.query.token || '')
  if (!token) {
    return res.status(400).send('<h3>无效的退订链接</h3><p>请从邮件中的退订链接进入。</p>')
  }
  const ok = db.unsubscribe(token)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(
    ok
      ? '<h3>已成功退订</h3><p>您将不再收到 QDII 额度变动通知。如需恢复，可在页面重新订阅。</p>'
      : '<h3>退订链接无效或已失效</h3><p>可能链接已过期，可忽略本邮件。</p>'
  )
})

/** 状态查询：GET /api/status?email=xxx（供前端回显是否已订阅） */
app.get('/api/status', (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return res.json({ ok: true, subscribed: false })
  res.json({ ok: true, subscribed: db.isSubscribed(email) })
})

// 启动前检查发信配置（缺失时打警告，不影响 API 可用）
try {
  assertMailConfigured()
  console.log(`[config] 邮件通道已配置：${config.mailProvider}`)
} catch (err) {
  console.warn(`[config] ${err.message}（订阅/退订 API 仍可用，定时发信不会触发）`)
}

db.initDb()
console.log(`[db] 订阅数据库就绪：${config.dbPath}`)

// 启动定时检测（仅作为常驻服务时启用；--once 手动跑由 notify.js 自行处理）
const { cronStarted } = initCron()
if (cronStarted) {
  console.log(`[cron] 定时检测已启动：${config.notifyCron}`)
}

app.listen(config.port, () => {
  console.log(`[server] QDII 通知服务已启动：http://127.0.0.1:${config.port}`)
})
