/**
 * 发送一封测试变更邮件（只发给指定收件人，不推进快照、不使用订阅者列表）。
 * 变更内容基于当前 data.json 的真实基金状态构造，仅作展示。
 *
 * 用法：node send-test-mail.mjs <收件邮箱>
 * 注意：若 .env 中 DATA_JSON_PATH 指向旧机器路径，运行时可用环境变量覆盖。
 */
import { config } from './config.js'
import { readData } from './detect.js'
import { buildMailBody, sendToSubscribers } from './mailer.js'

const to = process.argv[2]
if (!to) {
  console.error('用法：node send-test-mail.mjs <收件邮箱>')
  process.exit(1)
}

const data = readData()
if (!data) {
  console.error(`数据文件缺失：${config.dataJsonPath}`)
  process.exit(1)
}

// 基于当前真实状态构造典型变更（仅展示，不写任何状态文件）
const state = data.state
const pick = (code) => state[code]
const changes = []
if (pick('000834')) {
  changes.push({
    code: '000834',
    name: pick('000834').name,
    type: 'changed',
    field: '日累计限额',
    from: '10 元/日',
    to: '100 元/日',
  })
}
if (pick('000055')) {
  changes.push({
    code: '000055',
    name: pick('000055').name,
    type: 'changed',
    field: '申购状态',
    from: '限大额',
    to: '开放申购',
  })
}
if (pick('006479')) {
  changes.push({
    code: '006479',
    name: pick('006479').name,
    type: 'changed',
    field: '日累计限额',
    from: '5 元/日',
    to: '2 元/日',
  })
}
// 兜底：上述代码不在监控池时，取前 3 只构造
if (changes.length === 0) {
  for (const [code, s] of Object.entries(state).slice(0, 3)) {
    changes.push({
      code,
      name: s.name,
      type: 'changed',
      field: '日累计限额',
      from: `${Number(s.limit_amount).toLocaleString('zh-CN')} 元/日`,
      to: `${Math.max(1, Math.round(s.limit_amount / 2)).toLocaleString('zh-CN')} 元/日`,
    })
  }
}

const mailBody = buildMailBody(changes, {
  updatedAt: data.updatedAt,
  rawCount: data.rawCount,
})
console.log(`收件人：${to}`)
console.log(`主题：${mailBody.subject}`)

const { sent, failed, failedEmails } = await sendToSubscribers(
  [{ email: to, token: 'test-token' }],
  mailBody
)
console.log(`发送完成：成功 ${sent}，失败 ${failed}${failedEmails.length ? '（' + failedEmails.join(', ') + '）' : ''}`)
process.exit(failed > 0 ? 1 : 0)
