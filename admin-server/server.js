/**
 * pmtools 后台服务入口。
 * 挂载于 /background-api 前缀（nginx 专用前缀 location 原样透传，spec §3.2）。
 *
 * 端点一览（spec §5）：
 * - 公开：GET /articles（仅上架）、GET /articles/:id
 * - 鉴权：POST /admin/login、POST /admin/logout、GET /admin/session
 * - 管理：GET/POST /admin/articles、GET/PUT/DELETE /admin/articles/:id
 * - 图片：POST /admin/upload/image（二进制 body，Content-Type: image/*）
 * - 看板：GET /admin/stats/summary|projects|qdii|dca|content
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
import {
  listPublished,
  getPublished,
  listAll,
  getAny,
  createArticle,
  updateArticle,
  deleteArticle,
  SLUG_RE,
} from './articles.js'
import { detectImageExt, isImageSizeOk, buildImageKey, putImageBuffer } from './oss.js'
import {
  parseDays,
  getSummary,
  getProjects,
  getQdiiSnapshot,
  getDca,
  getContent,
  closeStatsDbs,
} from './stats.js'

const UPLOAD_MAX_BYTES = 10 * 1024 * 1024

/** 收集二进制请求体（图片上传用），超限立即拒绝 */
function readRawBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBytes) {
        const err = new Error('payload too large')
        err.status = 413
        reject(err)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/**
 * 构建 Express 应用（导出以便 node --test 直接驱动；直接运行时才 listen）。
 * 限流器在 createApp 内创建，保证每个应用实例状态隔离。
 * options.ossPut：测试注入的 OSS 写入实现，签名 (key, buffer) => Promise<url>
 */
export function createApp(options = {}) {
  const ossPut = options.ossPut || putImageBuffer

  const app = express()
  app.disable('x-powered-by')
  // 部署在 nginx 反代之后：信任第一跳代理，req.ip 才是真实客户端 IP
  app.set('trust proxy', 1)
  app.use(express.json({ limit: '2mb' }))

  const api = express.Router()

  api.get('/health', (req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() })
  })

  // ---------- 公开文章端点 ----------
  api.get('/articles', (req, res) => {
    res.json({ ok: true, articles: listPublished() })
  })

  api.get('/articles/:id', (req, res) => {
    const article = getPublished(req.params.id)
    if (!article) {
      return res.status(404).json({ ok: false, message: '文章不存在或已下架' })
    }
    res.json({ ok: true, article })
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
    // 业务层返回 { status, body } 的处理器统一响应；意外异常兜底为 500，不泄漏堆栈
    const safe = (handler) => async (req, res) => {
      try {
        const result = await handler(req)
        res.status(result.status).json(result.body)
      } catch (err) {
        if (err.status === 413) {
          res.status(413).json({ ok: false, message: '图片超过 10MB 上限' })
          return
        }
        console.error('[admin] 处理失败：', err.code || err.name)
        res.status(500).json({ ok: false, message: '服务器内部错误' })
      }
    }
    // 看板分区：读取失败返回错误态（HTTP 200 + ok:false），前端据此显示"读取失败 + 重试"
    const stats = (section, compute) =>
      safe(async (req) => {
        const days = parseDays(req.query.days)
        const data = compute(days)
        return { status: 200, body: { ok: true, section, ...data } }
      })

    // ---------- 鉴权 ----------
    api.post('/admin/login', loginLimiter, assertWriteOrigin, (req, res) => {
      const password = typeof req.body?.password === 'string' ? req.body.password : ''
      if (!password || !constantTimeEqual(password, config.adminPassword)) {
        return res.status(401).json({ ok: false, message: '密码错误' })
      }
      const { token } = signSession(config.sessionSecret)
      res.setHeader('Set-Cookie', sessionCookie(token))
      res.json({ ok: true })
    })

    api.post('/admin/logout', assertWriteOrigin, (req, res) => {
      res.setHeader('Set-Cookie', clearedSessionCookie())
      res.json({ ok: true })
    })

    api.get('/admin/session', requireAuth, (req, res) => {
      res.json({ ok: true })
    })

    // ---------- 文章管理 ----------
    api.get('/admin/articles', requireAuth, (req, res) => {
      res.json({ ok: true, articles: listAll() })
    })

    api.get('/admin/articles/:id', requireAuth, (req, res) => {
      const article = getAny(req.params.id)
      if (!article) return res.status(404).json({ ok: false, message: '文章不存在' })
      res.json({ ok: true, article })
    })

    api.post('/admin/articles', requireAuth, assertWriteOrigin, safe((req) => {
      const result = createArticle(req.body || {})
      if (!result.ok) return { status: result.code, body: { ok: false, errors: result.errors } }
      return { status: 201, body: { ok: true, article: result.article } }
    }))

    api.put('/admin/articles/:id', requireAuth, assertWriteOrigin, safe((req) => {
      const result = updateArticle(req.params.id, req.body || {})
      if (!result.ok) return { status: result.code, body: { ok: false, errors: result.errors } }
      return { status: 200, body: { ok: true, article: result.article } }
    }))

    api.delete('/admin/articles/:id', requireAuth, assertWriteOrigin, (req, res) => {
      if (!deleteArticle(req.params.id)) {
        return res.status(404).json({ ok: false, message: '文章不存在' })
      }
      res.json({ ok: true })
    })

    // ---------- 图片上传：二进制 body（Content-Type: image/*），文件名放 X-File-Name ----------
    api.post(
      '/admin/upload/image',
      requireAuth,
      assertWriteOrigin,
      safe(async (req) => {
        const articleId = String(req.query.articleId || '')
        if (!SLUG_RE.test(articleId)) {
          return { status: 400, body: { ok: false, message: '缺少或非法的 articleId（先创建草稿再上传图片）' } }
        }
        if (!getAny(articleId)) {
          return { status: 404, body: { ok: false, message: '文章不存在' } }
        }
        const buffer = await readRawBody(req, UPLOAD_MAX_BYTES)
        const filename = String(req.headers['x-file-name'] || '')
        const ext = detectImageExt(filename, buffer)
        if (!ext) {
          return { status: 400, body: { ok: false, message: '不支持的图片类型（仅 jpg/png/webp/avif/gif，且需真实图片内容）' } }
        }
        if (!isImageSizeOk(buffer)) {
          return { status: 400, body: { ok: false, message: '图片内容为空或超过 10MB' } }
        }
        const key = buildImageKey(articleId, ext)
        const url = await ossPut(key, buffer)
        return { status: 201, body: { ok: true, url, key } }
      })
    )

    // ---------- 看板（单分区失败返回错误态，不拖垮其他分区） ----------
    api.get('/admin/stats/summary', requireAuth, stats('summary', getSummary))
    api.get('/admin/stats/projects', requireAuth, stats('projects', getProjects))
    api.get('/admin/stats/qdii', requireAuth, stats('qdii', () => getQdiiSnapshot()))
    api.get('/admin/stats/dca', requireAuth, stats('dca', getDca))
    api.get('/admin/stats/content', requireAuth, stats('content', getContent))
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

  // express 中间件抛错统一收口为 JSON（四参签名是 Express 识别错误中间件的依据）
  api.use((err, req, res, next) => {
    void next
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ ok: false, message: '请求体不合法' })
    }
    console.error('[admin] 未处理错误：', err?.code || err?.name)
    res.status(500).json({ ok: false, message: '服务器内部错误' })
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

export { closeStatsDbs }
