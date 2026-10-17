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
  // 邮件底部/顶部"回到站点"的落地页：QDII 监控面板
  const siteUrl = `${config.siteBaseUrl}/qdii`

  const mono = `'DM Mono',ui-monospace,Consolas,Menlo,monospace`
  const serif = `Georgia,'Noto Serif SC','Songti SC',serif`
  const body = `-apple-system,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif`

  const rows = changes
    .map((c) => {
      const toBadge = badgeColor(c.to)
      const dir = changeDirection(c.from, c.to)
      // 箭头比圆点多一层信息：同样是"变了"，收紧和放宽对申购人意义相反
      const marker = dir === 'down' ? '&#8595;' : dir === 'up' ? '&#8593;' : '&#9679;'
      const markerColor = dir === 'down' ? '#9a513d' : dir === 'up' ? '#188038' : toBadge.fg
      const markerStyle = dir
        ? `font-size:10px;vertical-align:1px;color:${markerColor};`
        : `font-size:7px;vertical-align:2px;`
      const rowBg = '#ffffff'
      return `<tr style="background:${rowBg};">
        <td style="padding:12px 14px;border-bottom:1px solid #e8e4dd;font-family:${mono};font-size:12px;color:#6f6a5e;white-space:nowrap;">${escapeHtml(c.code)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e8e4dd;font-family:${body};font-size:13px;font-weight:500;color:#1a1714;line-height:1.5;">${escapeHtml(c.name)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e8e4dd;font-family:${body};font-size:12px;color:#555048;white-space:nowrap;">${escapeHtml(c.field)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e8e4dd;font-family:${mono};font-size:12px;color:#a39e93;text-decoration:line-through;white-space:nowrap;">${escapeHtml(c.from)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e8e4dd;font-family:${body};white-space:nowrap;">
          <span style="display:inline-block;padding:3px 11px;border-radius:999px;background:${toBadge.bg};color:${toBadge.fg};border:1px solid ${toBadge.border};font-size:12px;font-weight:500;line-height:1.5;white-space:nowrap;"><span style="${markerStyle}">${marker}</span>&nbsp;${escapeHtml(c.to)}</span>
        </td>
      </tr>`
    })
    .join('')

  return {
    subject: buildSubject(changes),
    html: `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(buildPreheader(changes))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f5f2" style="background:#f7f5f2;padding:32px 12px;font-family:${body};">
  <tr><td align="center">
    <table role="presentation" width="850" cellpadding="0" cellspacing="0" style="width:850px;max-width:850px;background:#ffffff;border:1px solid #e8e4dd;border-radius:12px;overflow:hidden;">
      <tr><td height="3" bgcolor="#7a6040" style="height:3px;background:#7a6040;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr>
        <td style="padding:30px 32px 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td valign="top" style="vertical-align:top;">
                <div style="font-family:${mono};font-size:11px;letter-spacing:2px;color:#7a6040;text-transform:uppercase;">QDII Fund Purchase Limit Monitor</div>
                <div style="font-family:${serif};font-size:24px;font-weight:400;color:#1a1714;margin-top:8px;line-height:1.4;">PMTOOLS·QDII 基金申购额度变动提醒</div>
                <div style="font-family:${mono};font-size:12px;letter-spacing:0.04em;color:#6f6a5e;margin-top:10px;">数据日期 ${meta.updatedAt} &middot; 每日扫描 &middot; 共 ${changes.length} 条变动</div>
              </td>
              <td valign="top" align="right" style="vertical-align:top;padding-left:16px;white-space:nowrap;">
                <a href="${siteUrl}" target="_blank" style="display:inline-block;padding:8px 14px;border:1px solid #d6c39a;border-radius:999px;background:#f6efdd;color:#7a6040;font-family:${mono};font-size:12px;line-height:1.4;text-decoration:none;white-space:nowrap;">打开 PMTOOLS 官网 &#8594;</a>
              </td>
            </tr>
          </table>
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

/** 从额度文案里取出数值（识别"万""亿"），取不到返回 null */
function parseAmount(value) {
  const m = String(value)
    .replace(/,/g, '')
    .match(/(\d+(?:\.\d+)?)\s*(亿|万)?/)
  if (!m) return null
  const n = Number(m[1])
  if (m[2] === '亿') return n * 100000000
  if (m[2] === '万') return n * 10000
  return n
}

/**
 * 转成可比较的额度值：
 * 无限额 = +Infinity（比任何金额都宽），暂停/封闭 = -1（比 0 额度还紧）。
 * 解析不出数字（如"限大额""开放申购"）返回 null，交给状态等级兜底。
 */
function comparableAmount(value) {
  const s = String(value).trim()
  if (/无限额|不限|无限制/.test(s)) return Number.POSITIVE_INFINITY
  if (/暂停|封闭/.test(s)) return -1
  return parseAmount(s)
}

/** 状态等级兜底：暂停 0 < 限大额 1 < 开放 2，仅在没有具体金额时使用 */
function stateRank(value) {
  const s = String(value)
  if (/无限额|不限|无限制/.test(s)) return 2
  if (/暂停|封闭/.test(s)) return 0
  if (/限大额|限额/.test(s)) return 1
  if (/开放/.test(s)) return 2
  return null
}

/**
 * 判断变动方向：down = 收紧（额度变小或转为限制申购），up = 放宽。
 * 申购人最关心的就是这个方向——同样是"变了"，收紧和放宽的意义完全相反。
 * 先比金额（含无限额/暂停的极值），金额不可比时退回状态等级。
 */
function changeDirection(from, to) {
  const fromAmount = comparableAmount(from)
  const toAmount = comparableAmount(to)
  if (fromAmount !== null && toAmount !== null) {
    if (toAmount < fromAmount) return 'down'
    if (toAmount > fromAmount) return 'up'
    return null
  }
  const fromRank = stateRank(from)
  const toRank = stateRank(to)
  if (fromRank !== null && toRank !== null) {
    if (toRank < fromRank) return 'down'
    if (toRank > fromRank) return 'up'
  }
  return null
}

/** 基金简称：去掉 QDII 标记、币种、份额后缀，主题行里放得下 */
function shortName(name) {
  const cleaned = String(name)
    .replace(/[（(]\s*QDII\s*[)）]/gi, '')
    .replace(/(人民币|美元|美汇|美钞|现汇|现钞)/g, '')
    .replace(/[（(]\s*[)）]/g, '')
    .replace(/类$/, '')
    .replace(/[A-E]$/, '')
    .trim()
  const chars = Array.from(cleaned)
  return chars.length > 14 ? `${chars.slice(0, 14).join('')}…` : cleaned
}

/** 字段简称：日累计限额（直销）→ 直销；申购状态 → 状态 */
function shortField(field) {
  const channel = String(field).match(/[（(](直销|代销)[)）]/)
  if (channel) return channel[1]
  if (String(field).includes('状态')) return '状态'
  if (String(field).includes('限额')) return '限额'
  return String(field)
}

/**
 * 主题行：一眼能看出"谁的什么方向"，避免用户在收件箱里只看到"变动 2 条"。
 * 单只基金直接写名字；多只写成"XX 等 N 只基金"。
 * N 按基金代码去重——同一基金的直销/代销可能各变一条，那是 1 只不是 2 只。
 */
function buildSubject(changes) {
  const downs = changes.filter((c) => changeDirection(c.from, c.to) === 'down').length
  const ups = changes.filter((c) => changeDirection(c.from, c.to) === 'up').length
  let trend = '额度变动'
  if (downs > 0 && ups === 0) trend = '额度收紧'
  else if (ups > 0 && downs === 0) trend = '额度放宽'
  else if (downs > 0 && ups > 0) trend = '额度有变化'

  const lead = shortName(changes[0].name)
  const fundCount = new Set(changes.map((c) => c.code || c.name)).size
  if (fundCount === 1) return `【QDII额度监控】${lead} ${trend}`
  return `【QDII额度监控】${lead} 等 ${fundCount} 只基金${trend}`
}

/**
 * 邮件列表里的预览文字（preheader）：正文里隐藏，收件箱可见。
 * 不写的话客户端会抓正文第一句英文，白白浪费一块最显眼的展示位。
 * 格式刻意压到 40 字内：多数手机客户端只显示这么长，超出会把"现值"截掉。
 */
function buildPreheader(changes) {
  const c = changes[0]
  const stripUnit = (v) =>
    String(v)
      .replace(/\s*元\s*\/\s*日$/, '')
      .replace(/\s*元$/, '')
      .trim()
  const unit = /元\s*\/\s*日$/.test(String(c.to)) ? '元/日' : ''
  const more = changes.length > 1 ? `，另有 ${changes.length - 1} 条` : ''
  return `${c.code} ${shortName(c.name)} ${shortField(c.field)} ${stripUnit(c.from)}→${stripUnit(c.to)}${unit}${more}`
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
