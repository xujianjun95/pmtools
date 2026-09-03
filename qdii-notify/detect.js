/**
 * 额度变动检测：读取 scanner.py 生成的 data.json，与上次"已通知状态"快照对比，
 * 找出 status / limit_amount / redeem 发生变化（含新进入、移出监控）的基金。
 *
 * 幂等保证：快照保存的是"已通知"的最新状态；当前数据与之相同则无变动、不通知。
 * scanner 同日重跑幂等，因此本检测天然不会重复通知。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { config } from './config.js'

/** 与前端一致的过滤规则：只看人民币可买的份额，避免美元份额产生噪音 */
function extractState(funds) {
  const state = {}
  for (const f of funds) {
    if (/美元|美汇|美钞|现汇|现钞/.test(f.name)) continue
    const hasLimit = String(f.status).includes('暂停') || Number(f.limit_amount) > 0
    if (!hasLimit) continue
    state[f.code] = {
      name: f.name,
      status: f.status,
      limit_amount: Number(f.limit_amount),
      redeem: f.redeem,
    }
  }
  return state
}

/** 读取 data.json，返回 { updatedAt, generatedAt, state }；文件缺失返回 null */
export function readData() {
  if (!existsSync(config.dataJsonPath)) return null
  const raw = JSON.parse(readFileSync(config.dataJsonPath, 'utf8'))
  return {
    updatedAt: raw.updated_at,
    generatedAt: raw.generated_at,
    state: extractState(raw.funds || []),
    rawCount: (raw.funds || []).length,
  }
}

export function readSnapshot() {
  if (!existsSync(config.snapshotPath)) return null
  try {
    return JSON.parse(readFileSync(config.snapshotPath, 'utf8'))
  } catch {
    return null
  }
}

function writeSnapshot(payload) {
  writeFileSync(config.snapshotPath, JSON.stringify(payload, null, 2), 'utf8')
}

/**
 * 对比前后两份状态，返回变动列表（每条含 code/name/字段/旧值/新值）。
 * prevState / currState 为 extractState 的产物。
 */
export function diffStates(prevState, currState) {
  const changes = []
  const codes = new Set([...Object.keys(prevState), ...Object.keys(currState)])
  for (const code of codes) {
    const a = prevState[code]
    const b = currState[code]
    if (!a) {
      changes.push({
        code,
        name: b.name,
        type: 'added',
        field: '监控范围',
        from: '不在监控范围',
        to: `${b.status} · 限额 ${fmtField('limit_amount', b.limit_amount)}`,
      })
      continue
    }
    if (!b) {
      changes.push({
        code,
        name: a.name,
        type: 'removed',
        field: '监控范围',
        from: `${a.status} · 限额 ${fmtField('limit_amount', a.limit_amount)}`,
        to: '移出监控范围',
      })
      continue
    }
    for (const field of ['status', 'limit_amount', 'redeem']) {
      const pv = a[field]
      const cv = b[field]
      if (pv !== cv) {
        changes.push({
          code,
          name: b.name,
          type: 'changed',
          field: field === 'limit_amount' ? '日累计限额' : field === 'status' ? '申购状态' : '赎回状态',
          from: fmtField(field, pv),
          to: fmtField(field, cv),
        })
      }
    }
  }
  return changes
}

function fmtField(field, value) {
  // 避免 undefined/null/空值被渲染成字面量
  if (value === undefined || value === null || value === '') return '—'
  // 限额单位为"元/日"（与前端 FundTable limitText 口径一致），非万元
  if (field === 'limit_amount') return `${Number(value).toLocaleString('zh-CN')} 元/日`
  return value
}

/**
 * 检测：读数据 → 对比快照，返回 { changes, data, prevState, isFirstRun }。
 * 不做任何写操作；是否"消费"（推进快照）由调用方在发送成功后决定，
 * 避免 SMTP 故障时变动被提前消费导致永久丢通知。
 * 返回 null 表示数据文件缺失。
 */
export function detect() {
  const data = readData()
  if (!data) return null
  const prev = readSnapshot()
  const isFirstRun = !prev || !prev.state
  const prevState = prev && prev.state ? prev.state : {}
  const changes = diffStates(prevState, data.state)
  return { changes, data, prevState, isFirstRun }
}

/** 消费：把当前数据写入快照（仅在"已成功处理"后调用） */
export function consume(result) {
  writeSnapshot({
    updated_at: result.data.updatedAt,
    generated_at: result.data.generatedAt,
    state: result.data.state,
  })
}
