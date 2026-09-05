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

export function createAliyunClientConfig() {
  return new $OpenApiUtil.Config({
    accessKeyId: config.aliyun.accessKeyId,
    accessKeySecret: config.aliyun.accessKeySecret,
    endpoint: config.aliyun.endpoint,
    readTimeout: config.aliyun.readTimeout,
    connectTimeout: config.aliyun.connectTimeout,
  })
}

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
    dmClient = new DmClient(createAliyunClientConfig())
  }
  return dmClient
}

export function unsubscribeUrl(token) {
  return `${config.publicBaseUrl}/api/unsubscribe?token=${token}`
}

/**
 * 按"现值"语义匹配状态色——与站内 QDII 页面 FundTable 徽章对齐
 * （暖纸色系：开放=绿 / 暂停=赭石 / 限大额=棕 / 其他=主题青铜棕）。
 * 返回不透明色（邮件客户端不支持 color-mix / rgba 叠加语义）。
 */
function badgeColor(value) {
  const v = String(value)
  if (v.includes('开放')) return { bg: '#e9f4ec', fg: '#188038', border: '#b9d9c2' }
  if (v.includes('暂停')) return { bg: '#f7ebe6', fg: '#9a513d', border: '#d9bcae' }
  if (v.includes('限大额') || v.includes('限额')) return { bg: '#f6efdd', fg: '#8a6a2a', border: '#d6c39a' }
  return { bg: '#f3ede3', fg: '#7a6040', border: '#d3c5ae' }
}

/** 组装通知邮件正文（HTML）——邮箱客户端安全：table 布局 + 内联样式 */
export function buildMailBody(changes, meta) {
  const summary = summarize(changes)

  const mono = `'DM Mono',ui-monospace,Consolas,Menlo,monospace`
  const serif = `Georgia,'Noto Serif SC','Songti SC',serif`
  const body = `-apple-system,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif`

  const rows = changes
    .map((c) => {
      const toBadge = badgeColor(c.to)
      const rowBg = '#ffffff'
      return `<tr style="background:${rowBg};">
        <td style="padding:12px 14px;border-bottom:1px solid #e8e4dd;font-family:${mono};font-size:12px;color:#6f6a5e;white-space:nowrap;">${escapeHtml(c.code)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e8e4dd;font-family:${body};font-size:13px;font-weight:500;color:#1a1714;line-height:1.5;">${escapeHtml(c.name)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e8e4dd;font-family:${body};font-size:12px;color:#555048;white-space:nowrap;">${escapeHtml(c.field)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e8e4dd;font-family:${mono};font-size:12px;color:#a39e93;text-decoration:line-through;white-space:nowrap;">${escapeHtml(c.from)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e8e4dd;font-family:${body};white-space:nowrap;">
          <span style="display:inline-block;padding:3px 11px;border-radius:999px;background:${toBadge.bg};color:${toBadge.fg};border:1px solid ${toBadge.border};font-size:12px;font-weight:500;line-height:1.5;white-space:nowrap;"><span style="font-size:7px;vertical-align:2px;">&#9679;</span>&nbsp;${escapeHtml(c.to)}</span>
        </td>
      </tr>`
    })
    .join('')

  return {
    subject: `【QDII额度监控】${summary}`,
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f5f2" style="background:#f7f5f2;padding:32px 12px;font-family:${body};">
  <tr><td align="center">
    <table role="presentation" width="850" cellpadding="0" cellspacing="0" style="width:850px;max-width:850px;background:#ffffff;border:1px solid #e8e4dd;border-radius:12px;overflow:hidden;">
      <tr><td height="3" bgcolor="#7a6040" style="height:3px;background:#7a6040;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr>
        <td style="padding:30px 32px 22px;">
          <div style="font-family:${mono};font-size:11px;letter-spacing:2px;color:#7a6040;text-transform:uppercase;">QDII Fund Purchase Limit Monitor</div>
          <div style="font-family:${serif};font-size:24px;font-weight:400;color:#1a1714;margin-top:8px;line-height:1.4;">PMTOOLS·QDII 基金申购额度变动提醒</div>
          <div style="font-family:${mono};font-size:12px;letter-spacing:0.04em;color:#6f6a5e;margin-top:10px;">数据日期 ${meta.updatedAt} &middot; 每日扫描 &middot; 共 ${changes.length} 条变动</div>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e4dd;border-radius:10px;overflow:hidden;">
            <tr bgcolor="#faf8f4" style="background:#faf8f4;">
              <td style="padding:10px 14px;font-family:${mono};font-size:11px;letter-spacing:0.08em;color:#6f6a5e;">代码</td>
              <td style="padding:10px 14px;font-family:${mono};font-size:11px;letter-spacing:0.08em;color:#6f6a5e;">基金名称</td>
              <td style="padding:10px 14px;font-family:${mono};font-size:11px;letter-spacing:0.08em;color:#6f6a5e;">变动字段</td>
              <td style="padding:10px 14px;font-family:${mono};font-size:11px;letter-spacing:0.08em;color:#6f6a5e;">原值</td>
              <td style="padding:10px 14px;font-family:${mono};font-size:11px;letter-spacing:0.08em;color:#6f6a5e;">现值</td>
            </tr>
            ${rows}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px 28px;">
          <div style="border-top:1px solid #e8e4dd;padding-top:16px;font-size:12px;color:#6f6a5e;line-height:1.8;">
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
    if (c.field === '日累计限额') limitChanges += 1
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
    `<a href="${unsubscribeUrl(token)}" style="color:#7a6040;text-decoration:underline;">点击退订</a>`
  )
}

/**
 * 发送订阅邮箱验证码（阿里云 DM SingleSendMail）。
 * 每封独立调用，无个性化退订链接，TagName=qdii-verify 与通知邮件区分。
 * 返回是否成功（写入邮件发送成功与否由调用方决定是否计数）。
 */
export async function sendVerificationCode(toEmail, code, ttlMinutes) {
  assertMailConfigured()
  const mono = `'DM Mono',ui-monospace,Consolas,Menlo,monospace`
  const serif = `Georgia,'Noto Serif SC','Songti SC',serif`
  const body = `-apple-system,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif`
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f5f2" style="background:#f7f5f2;font-family:${body};">
  <tr><td align="center" style="padding:48px 12px;">
    <table role="presentation" width="420" align="center" cellpadding="0" cellspacing="0" style="width:420px;max-width:420px;background:#ffffff;border:1px solid #e8e4dd;border-radius:12px;overflow:hidden;margin:0 auto;">
      <tr><td height="3" bgcolor="#7a6040" style="height:3px;background:#7a6040;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr>
        <td style="padding:26px 28px 0;">
          <div style="font-family:${mono};font-size:11px;letter-spacing:2px;color:#7a6040;text-transform:uppercase;">QDII Fund Purchase Limit Monitor</div>
          <div style="font-family:${serif};font-size:20px;font-weight:400;color:#1a1714;margin-top:8px;line-height:1.4;">PMTOOLS·QDII 额度变动订阅验证</div>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 28px 28px;">
          <div style="font-size:13px;color:#3a3530;line-height:1.8;">您正在进行 QDII 额度变动邮件订阅，验证码为：</div>
          <div style="font-family:${mono};font-size:32px;font-weight:500;letter-spacing:10px;color:#7a6040;background:#f7f5f2;border:1px solid #e8e4dd;border-radius:10px;margin:16px 0;padding:14px 0 14px 10px;text-align:center;">${escapeHtml(code)}</div>
          <div style="font-size:12px;color:#6f6a5e;line-height:1.8;">${ttlMinutes} 分钟内有效，请勿泄露给他人。<br/>如非本人操作，请忽略此邮件。</div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>`
  try {
    await getDmClient().singleSendMail(
      new SingleSendMailRequest({
        accountName: config.aliyun.fromAddress,
        addressType: 1,
        replyToAddress: false,
        fromAlias: config.mailFromName,
        tagName: 'qdii-verify',
        toAddress: toEmail,
        subject: `【QDII额度监控】邮箱验证码：${code}`,
        htmlBody: html,
      })
    )
    return true
  } catch (err) {
    console.error(`[mail] 验证码发送失败 ${toEmail}:`, err.message)
    return false
  }
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
