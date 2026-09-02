/**
 * 邮件发送封装。
 * 支持两种 provider（MAIL_PROVIDER）：
 *  - aliyun（默认）：阿里云邮件推送 API（SingleSendMail，AccessKey 鉴权）；
 *  - smtp：从 smtp.163.com / smtpdm.aliyun.com 等标准 SMTP（nodemailer，备用通道）。
 * 两种方式都支持按 BATCH_SIZE 分批群发，每封邮件带个性化退订链接。
 */
import nodemailer from 'nodemailer'
import { createRequire } from 'node:module'
import { $OpenApiUtil } from '@alicloud/openapi-core'
import { config, assertMailConfigured } from './config.js'

// 阿里云 DM SDK 为 CJS 编译产物（exports.default = Client），ESM namespace 导入
// interop 无法直接取到构造函数，用 createRequire 显式加载
const requireCjs = createRequire(import.meta.url)
const dmModule = requireCjs('@alicloud/dm20151123')
const DmClient = dmModule.default
const SingleSendMailRequest = dmModule.SingleSendMailRequest

let transporter = null
let dmClient = null

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: true, // 465 SSL
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
      // 163 对发送频率有风控，稳定比快重要
      pool: true,
      maxConnections: 1,
      rateDelta: 1000,
      rateLimit: 3,
    })
  }
  return transporter
}

/** 阿里云 DM API 客户端（懒加载单例） */
function getDmClient() {
  if (!dmClient) {
    dmClient = new DmClient(
      new $OpenApiUtil.Config({
        accessKeyId: config.aliyun.accessKeyId,
        accessKeySecret: config.aliyun.accessKeySecret,
        endpoint: config.aliyun.endpoint,
      })
    )
  }
  return dmClient
}

export function unsubscribeUrl(token) {
  return `${config.publicBaseUrl}/api/unsubscribe?token=${token}`
}

/** 按"现值"语义匹配状态色：开放=绿 / 暂停=红 / 限大额=琥珀 / 其他=蓝 */
function badgeColor(value) {
  const v = String(value)
  if (v.includes('开放')) return { bg: '#e6f4ea', fg: '#188038' }
  if (v.includes('暂停')) return { bg: '#fdecea', fg: '#c5221f' }
  if (v.includes('限大额') || v.includes('限额')) return { bg: '#fef7e0', fg: '#a06a00' }
  return { bg: '#e8f0fe', fg: '#1a73e8' }
}

/** 组装通知邮件正文（HTML）——邮箱客户端安全：table 布局 + 内联样式 */
export function buildMailBody(changes, meta) {
  const summary = summarize(changes)

  const rows = changes
    .map((c, i) => {
      const toBadge = badgeColor(c.to)
      const rowBg = i % 2 ? '#f7f8fa' : '#ffffff'
      return `<tr style="background:${rowBg};">
        <td style="padding:12px 14px;border-bottom:1px solid #eef0f3;font-family:ui-monospace,Consolas,Menlo,monospace;font-size:12px;color:#57606a;white-space:nowrap;">${escapeHtml(c.code)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #eef0f3;font-size:13px;color:#1f2328;line-height:1.5;">${escapeHtml(c.name)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #eef0f3;font-size:12px;color:#57606a;white-space:nowrap;">${escapeHtml(c.field)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #eef0f3;font-size:12px;color:#9aa3ad;text-decoration:line-through;white-space:nowrap;">${escapeHtml(c.from)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #eef0f3;white-space:nowrap;">
          <span style="display:inline-block;padding:4px 11px;border-radius:999px;background:${toBadge.bg};color:${toBadge.fg};font-size:12px;font-weight:600;line-height:1.4;">${escapeHtml(c.to)}</span>
        </td>
      </tr>`
    })
    .join('')

  return {
    subject: `【QDII额度监控】${summary}`,
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f2f4f7" style="background:#f2f4f7;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:680px;max-width:680px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(17,24,39,0.08);">
      <tr>
        <td bgcolor="#16202e" style="background:#16202e;padding:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td height="6" bgcolor="#4f7cff" style="height:6px;background:#4f7cff;font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr>
              <td style="padding:28px 32px 22px;">
                <div style="font-size:11px;letter-spacing:2px;color:#7f95b0;text-transform:uppercase;">QDII Fund Limit Alert</div>
                <div style="font-size:22px;font-weight:700;color:#ffffff;margin-top:6px;">QDII 基金申购额度变动提醒</div>
                <div style="font-size:12px;color:#9fb3c8;margin-top:8px;">数据日期 ${meta.updatedAt} · 每日扫描 · 共 ${changes.length} 条变动</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 24px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef0f3;border-radius:12px;overflow:hidden;">
            <tr bgcolor="#f6f8fa" style="background:#f6f8fa;">
              <td style="padding:10px 14px;font-size:12px;color:#57606a;font-weight:600;">代码</td>
              <td style="padding:10px 14px;font-size:12px;color:#57606a;font-weight:600;">基金名称</td>
              <td style="padding:10px 14px;font-size:12px;color:#57606a;font-weight:600;">变动字段</td>
              <td style="padding:10px 14px;font-size:12px;color:#57606a;font-weight:600;">原值</td>
              <td style="padding:10px 14px;font-size:12px;color:#57606a;font-weight:600;">现值</td>
            </tr>
            ${rows}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 24px 28px;">
          <div style="border-top:1px solid #f0f2f5;padding-top:16px;font-size:12px;color:#8c959f;line-height:1.8;">
            本邮件由系统自动发送，若不再需要接收，<!--UNSUB_LINK-->。
            <br/>无变动时不会打扰；若此邮件非您本人订阅，可直接忽略。
          </div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>`,
  }
}

function summarize(changes) {
  const statuses = new Set()
  let limitChanges = 0
  for (const c of changes) {
    if (c.field === '申购状态') statuses.add(c.to)
    if (c.field === '单日累计购买上限') limitChanges += 1
  }
  const parts = []
  if (statuses.size) parts.push(`状态变化(${[...statuses].join('/')})`)
  if (limitChanges) parts.push(`额度变化${limitChanges}条`)
  if (!parts.length) parts.push(`${changes.length}条变动`)
  return parts.join(' ')
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 把邮件正文里的退订链接占位符替换为订阅者专属链接 */
function personalizeHtml(html, token) {
  return html.replace(
    '<!--UNSUB_LINK-->',
    `<a href="${unsubscribeUrl(token)}">点击退订</a>`
  )
}

/**
 * 给一组订阅者发送同一封邮件（正文里嵌入各自的退订链接）。
 * aliyun：每封单独一次 SingleSendMail（个性化退订链接不能合发）；
 * smtp：nodemailer 群发。
 * 按 BATCH_SIZE 分批，逐批 await，失败不中断整批。
 * 返回 { sent, failed, failedEmails }
 */
export async function sendToSubscribers(subscribers, mailBody) {
  assertMailConfigured()
  const provider = config.mailProvider
  let sent = 0
  const failedEmails = []
  const batches = []
  for (let i = 0; i < subscribers.length; i += config.batchSize) {
    batches.push(subscribers.slice(i, i + config.batchSize))
  }
  for (const batch of batches) {
    await Promise.all(
      batch.map(async (sub) => {
        const html = personalizeHtml(mailBody.html, sub.token)
        try {
          if (provider === 'aliyun') {
            await getDmClient().singleSendMail(
              new SingleSendMailRequest({
                accountName: config.aliyun.fromAddress,
                addressType: 1,
                replyToAddress: false,
                fromAlias: config.mailFromName,
                tagName: 'qdii-notify',
                toAddress: sub.email,
                subject: mailBody.subject,
                htmlBody: html,
              })
            )
          } else {
            await getTransporter().sendMail({
              from: `"${config.mailFromName}" <${config.smtp.user}>`,
              to: sub.email,
              subject: mailBody.subject,
              html,
            })
          }
          sent += 1
        } catch (err) {
          failedEmails.push(sub.email)
          console.error(`[mail] 发送失败 ${sub.email}:`, err.message)
        }
      })
    )
    // 批次间稍作间隔，降低发送频率
    if (batches.length > 1) await new Promise((r) => setTimeout(r, 2000))
  }
  return { sent, failed: failedEmails.length, failedEmails }
}
