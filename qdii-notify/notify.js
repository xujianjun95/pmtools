/**
 * QDII 通知服务 - 定时检测 + 发信
 *
 * 两种运行方式：
 *  1. 常驻：由 server.js 调用 initCron()，按 NOTIFY_CRON 定时执行；
 *  2. 手动：`node notify.js --once` 立即检测一次（可用于 crontab 或首次测试）；
 *        `node notify.js --check` 只检测并打印结果，不发信（调试用）。
 */
import cron from 'node-cron'
import { config } from './config.js'
import { detect, consume } from './detect.js'
import { buildMailBody, sendToSubscribers } from './mailer.js'
import { listActiveEmails } from './db.js'

/**
 * 执行一次检测+发信。
 * 快照仅在"处理成功"后推进：首次建快照 / 无变动 / 发送完成（含部分失败）。
 * 发送整体抛错（如 SMTP 未配置、auth 失败）时不推进快照，下轮定时任务会重试，避免丢通知。
 * dryRun（--check）为纯只读预览，不推进快照。
 */
export async function runOnce({ dryRun = false } = {}) {
  const result = detect()
  if (!result) {
    console.log(`[notify] ${new Date().toISOString()} 数据文件缺失：${config.dataJsonPath}`)
    return { changes: 0, sent: 0, missing: true }
  }
  const { changes, data, isFirstRun } = result

  // ---- dryRun：只读预览，不推进快照 ----
  if (dryRun) {
    if (isFirstRun) {
      console.log(`[notify] 首次运行预览：将建立快照（${changes.length} 只基金入池），不会发送`)
      return { changes: 0, sent: 0, firstRun: true, dryRun: true }
    }
    if (changes.length === 0) {
      console.log(`[notify] 无额度变动（dryRun）`)
      return { changes: 0, sent: 0, dryRun: true }
    }
    console.log(`[notify] 检测到 ${changes.length} 条变动（dryRun，不发送）：`)
    changes.slice(0, 5).forEach((c) =>
      console.log(`  - ${c.code} ${c.name}: ${c.field} ${c.from} → ${c.to}`)
    )
    return { changes: changes.length, sent: 0, dryRun: true }
  }

  // ---- 正式模式 ----
  if (isFirstRun) {
    consume(result)
    console.log(
      `[notify] 首次运行：已建立状态快照（${changes.length} 只基金入池），不发送通知，后续仅在有变动时提醒`
    )
    return { changes: 0, sent: 0, firstRun: true }
  }

  if (changes.length === 0) {
    consume(result)
    console.log(`[notify] ${new Date().toISOString()} 无额度变动，跳过`)
    return { changes: 0, sent: 0 }
  }

  const subscribers = listActiveEmails()
  console.log(`[notify] 检测到 ${changes.length} 条变动，订阅者 ${subscribers.length} 人`)

  if (subscribers.length === 0) {
    console.warn('[notify] 有变动但暂无订阅者，跳过发信（已推进快照）')
    consume(result)
    return { changes: changes.length, sent: 0 }
  }

  const mailBody = buildMailBody(changes, {
    updatedAt: data.updatedAt,
    rawCount: data.rawCount,
  })

  let sent, failed
  try {
    ;({ sent, failed } = await sendToSubscribers(subscribers, mailBody))
  } catch (err) {
    // SMTP 整体故障（如连接失败/未配置）：不推进快照，保留变动，下轮重试
    console.error(`[notify] 发送失败，快照未推进，将在下轮重试：${err.message}`)
    throw err
  }

  // 全部发送失败（sent=0 且 failed>0，如 163 auth 拒绝/风控全拒）：
  // sendToSubscribers 内部逐封 catch 不抛错，若直接推进快照该变动将永久丢失。
  // 此处视为发送失败，不消费，下轮重试；部分成功（sent>0）才消费，避免成功者重复收到。
  if (sent === 0 && failed > 0) {
    console.error(`[notify] 全部发送失败（${failed} 封），快照未推进，将在下轮重试`)
    throw new Error(`全部发送失败：${failed} 封`)
  }

  consume(result) // 发送完成后才推进快照
  console.log(`[notify] 发送完成：成功 ${sent}，失败 ${failed}`)
  return { changes: changes.length, sent, failed }
}

/** 由 server.js 调用：注册定时任务（只注册一次） */
let cronStarted = false
export function initCron() {
  if (cronStarted) return { cronStarted: false }
  cron.schedule(config.notifyCron, () => {
    runOnce().catch((err) => console.error('[notify] 定时任务异常：', err))
  })
  cronStarted = true
  return { cronStarted: true }
}

// 直接运行时（node notify.js --once / --check）
const isDirectRun = process.argv[1] && process.argv[1].endsWith('notify.js')
if (isDirectRun) {
  const mode = process.argv.includes('--once') ? 'once' : process.argv.includes('--check') ? 'check' : 'help'
  if (mode === 'once') {
    runOnce().then(() => process.exit(0)).catch((err) => {
      console.error(err)
      process.exit(1)
    })
  } else if (mode === 'check') {
    runOnce({ dryRun: true }).then(() => process.exit(0)).catch((err) => {
      console.error(err)
      process.exit(1)
    })
  } else {
    console.log('用法：node notify.js --once（检测并发送）| --check（只检测，不发送）')
  }
}
