/**
 * 配置加载：优先读环境变量，其次读 .env 文件（简单解析，不引第三方依赖）。
 * 与 qdii-notify/config.js 同构。所有值都可通过环境变量覆盖，便于测试注入。
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadDotEnv() {
  const envFile = path.join(__dirname, '.env')
  if (!existsSync(envFile)) return {}
  const out = {}
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const env = { ...loadDotEnv(), ...process.env }

function parseOrigins(raw) {
  const list = String(raw || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  return list
}

export const config = {
  port: Number(env.PORT || 3200),
  dbPath: env.DB_PATH || path.join(__dirname, 'articles.db'),
  // 单管理员密码与会话签名密钥；改密码后须同步轮换 SESSION_SECRET 使旧会话失效（spec §8）
  adminPassword: env.ADMIN_PASSWORD || '',
  sessionSecret: env.SESSION_SECRET || '',
  // 写操作 Origin/Referer 白名单（逗号分隔；尾斜杠归一化）
  allowedOrigins: parseOrigins(
    env.ADMIN_ALLOWED_ORIGINS ||
      'https://www.pmtools.com.cn,https://pmtools.com.cn,http://localhost:5173'
  ),
  oss: {
    region: env.OSS_REGION || 'oss-cn-beijing',
    bucket: env.OSS_BUCKET || 'pmtools27',
    accessKeyId: env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: env.OSS_ACCESS_KEY_SECRET || '',
    // 图片目录前缀；本地联调用 OSS_IMAGES_PREFIX 隔离测试目录
    imagesPrefix: env.OSS_IMAGES_PREFIX || 'articles/images',
  },
  // 看板只读挂载的 qdii-notify 数据库（spec §4.2）；生产通过 .env 指向 /opt/qdii-notify
  qdii: {
    subscribersDbPath: env.QDII_DB_PATH || path.join(__dirname, '..', 'qdii-notify', 'subscribers.db'),
    analyticsDbPath:
      env.QDII_ANALYTICS_DB_PATH || path.join(__dirname, '..', 'qdii-notify', 'subscribers.db.analytics.db'),
  },
}

/** 鉴权凭据是否齐备；缺任一项时 admin 端点整体停用（fail closed），公开端点不受影响 */
export function isAuthConfigured() {
  return Boolean(config.adminPassword && config.sessionSecret)
}
