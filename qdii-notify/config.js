/**
 * 配置加载：优先读环境变量，其次读 .env 文件（简单解析，不引第三方依赖）。
 * 所有路径都可用绝对路径覆盖，便于部署时通过 .env 指定。
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
    // 去掉首尾引号
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

export const config = {
  port: Number(env.PORT || 3100),
  dataJsonPath: env.DATA_JSON_PATH || path.join(__dirname, 'data.json'),
  snapshotPath: env.SNAPSHOT_PATH || path.join(__dirname, 'snapshot.json'),
  dbPath: env.DB_PATH || path.join(__dirname, 'subscribers.db'),
  // aliyun: 阿里云邮件推送 API（默认）；smtp: nodemailer 直连 SMTP 备用
  mailProvider: (env.MAIL_PROVIDER || 'aliyun').toLowerCase(),
  aliyun: {
    endpoint: env.ALIYUN_DM_ENDPOINT || 'dm.aliyuncs.com',
    accessKeyId: env.ALIYUN_DM_ACCESS_KEY_ID || '',
    accessKeySecret: env.ALIYUN_DM_ACCESS_KEY_SECRET || '',
    fromAddress: env.ALIYUN_DM_FROM_ADDRESS || '',
    readTimeout: Number(env.ALIYUN_DM_READ_TIMEOUT || 15000),
    connectTimeout: Number(env.ALIYUN_DM_CONNECT_TIMEOUT || 5000),
  },
  smtp: {
    host: env.SMTP_HOST || 'smtp.163.com',
    port: Number(env.SMTP_PORT || 465),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
  },
  mailFromName: env.MAIL_FROM_NAME || 'QDII额度监控',
  code: {
    ttlMinutes: Number(env.CODE_TTL_MINUTES || 10),
    maxSendPerDay: Number(env.CODE_MAX_SEND_PER_DAY || 10),
    maxAttempts: Number(env.CODE_MAX_ATTEMPTS || 5),
  },
  publicBaseUrl: (env.PUBLIC_BASE_URL || 'http://localhost:3100').replace(/\/+$/, ''),
  // 多个时间段用分号分隔，避免 cron 的“分钟 × 小时”组合产生额外触发。
  notifyCron: env.NOTIFY_CRON || '0 8 * * *;10 12,18 * * *',
  batchSize: Number(env.BATCH_SIZE || 10),
}

/** 校验当前 provider 的发信凭据是否已配置；未配置时给出明确提示（防止静默失败） */
export function assertMailConfigured() {
  if (config.mailProvider === 'aliyun') {
    if (!config.aliyun.accessKeyId || !config.aliyun.accessKeySecret || !config.aliyun.fromAddress) {
      throw new Error(
        '阿里云邮件推送未配置：请在 qdii-notify/.env 中填写 ALIYUN_DM_ACCESS_KEY_ID / ALIYUN_DM_ACCESS_KEY_SECRET / ALIYUN_DM_FROM_ADDRESS'
      )
    }
    return
  }
  if (config.mailProvider === 'smtp' && (!config.smtp.user || !config.smtp.pass)) {
    throw new Error(
      'SMTP 未配置：请在 qdii-notify/.env 中填写 SMTP_USER 与 SMTP_PASS（或改用 MAIL_PROVIDER=aliyun）'
    )
  }
}
