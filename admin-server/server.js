/**
 * pmtools 后台服务入口。
 * 挂载于 /background-api 前缀（nginx 专用前缀 location 原样透传，spec §3.2）。
 * 职责（一期）：健康检查 + 单管理员登录鉴权；文章/图片/看板端点按实现计划 Phase 2-3 逐批挂载。
 */
import express from 'express'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { config, isAuthConfigured } from './config.js'
import {
  makeRateLimit,
  makeRequireAuth,
  isAllowedOrigin,
  sessionCookie,
  clearedSessionCookie,
  constantTimeEqual,
  signSession,
} from './auth.js'

/**
 * 构建 Express 应用（导出以便 node --test 直接驱动；直接运行时才 listen）。
 * 限流器在 createApp 内创建，保证每个应用实例状态隔离。
 */
export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  // 部署在 nginx 反代之后：信任第一跳代理，req.ip 才是真实客户端 IP
  app.set('trust proxy', 1)
  app.use(express.json({ limit: '2mb' }))

  const api = express.Router()

  api.get('/health', (req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() })
  })

  if (isAuthConfigured()) {
    const requireAuth = makeRequireAuth(config.sessionSecret)
    const loginLimiter = makeRateLimit(60 * 1000, 10)
    const assertWriteOrigin = (req, res, next) => {
      if (!isAllowedOrigin(req, config.allowedOrigins)) {
        return res.status(403).json({ ok: false, message: '请求来源不被允许' })
      }
      next()
    }

    // 登录：POST /background-api/admin/login  body: { password }
    api.post('/admin/login', loginLimiter, assertWriteOrigin, (req, res) => {
      const password = typeof req.body?.password === 'string' ? req.body.password : ''
      if (!password || !constantTimeEqual(password, config.adminPassword)) {
        return res.status(401).json({ ok: false, message: '密码错误' })
      }
      const { token } = signSession(config.sessionSecret)
      res.setHeader('Set-Cookie', sessionCookie(token))
      res.json({ ok: true })
    })

    // 退出：清除 cookie；无状态会话无需服务端撤销
    api.post('/admin/logout', assertWriteOrigin, (req, res) => {
      res.setHeader('Set-Cookie', clearedSessionCookie())
      res.json({ ok: true })
    })

    // 会话检查：前端启动时探测登录态
    api.get('/admin/session', requireAuth, (req, res) => {
      res.json({ ok: true })
    })
  } else {
    // fail closed：凭据缺失时 admin 面板整体不可用
    api.all('/admin', (req, res) => {
      res.status(503).json({ ok: false, message: '鉴权未配置：请在 .env 填写 ADMIN_PASSWORD 与 SESSION_SECRET' })
    })
    api.all('/admin/*', (req, res) => {
      res.status(503).json({ ok: false, message: '鉴权未配置：请在 .env 填写 ADMIN_PASSWORD 与 SESSION_SECRET' })
    })
  }

  api.use((req, res) => {
    res.status(404).json({ ok: false, message: 'Not Found' })
  })

  app.use('/background-api', api)
  return app
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  if (!isAuthConfigured()) {
    console.warn('[config] ADMIN_PASSWORD / SESSION_SECRET 未配置，admin 端点已停用（公开端点不受影响）')
  }
  createApp().listen(config.port, () => {
    console.log(`[pmtools-admin] listening on http://127.0.0.1:${config.port}/background-api`)
  })
}
