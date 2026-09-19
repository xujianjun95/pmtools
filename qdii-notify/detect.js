/**
 * 额度变动检测：读取 scanner.py 生成的 data.json，与上次"已通知状态"快照对比，
 * 仅找出前后均存在、有效日累计限额发生变化的基金。
 *
 * 幂等保证：快照保存的是"已通知"的最新状态；当前数据与之相同则无变动、不通知。
 * scanner 同日重跑幂等，因此本检测天然不会重复通知。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import { classifyRegion } from './regions.js'

/** 与前端一致的过滤规则：只看人民币可买的份额，避免美元份额产生噪音 */
export function extractState(funds) {
  const state = {}
  for (const f of funds) {
    if (/美元|美汇|美钞|现汇|现钞/.test(f.name)) continue
    state[f.code] = {
      name: f.name,
      status: f.status,
      limit_amount: normalizeLimit(f.limit_amount),
      direct_limit_amount: normalizeLimit(f.direct_limit_amount),
      redeem: f.redeem,
    }
  }
  return state
}

/** 两个申购渠道的日累计限额：任一变动都通知。直销数据缺失（老数据/抓取失败）按"无法对比"跳过 */
export const LIMIT_FIELDS = [
  { key: 'limit_amount', label: '日累计限额（代销）' },
  { key: 'direct_limit_amount', label: '日累计限额（直销）' },
]

/** 读取 data.json，返回 { updatedAt, generatedAt, state }；文件缺失返回 null */
export function readData() {
  if (!existsSync(config.dataJsonPath)) return null
  const raw = JSON.parse(readFileSync(config.dataJsonPath, 'utf8'))
  const validFunds = funds => Array.isArray(funds) && funds.every(f => f && /^\d{6}$/.test(f.code) && typeof f.name === 'string')
  if (!validFunds(raw.funds)) throw new Error('美国基金数据格式异常')
  const worldPath = config.worldDataJsonPath || path.join(path.dirname(config.dataJsonPath), 'worldpage-data.json')
  let world = null
  if (existsSync(worldPath)) {
    try {
      world = JSON.parse(readFileSync(worldPath, 'utf8'))
      if (!validFunds(world.funds)) throw new Error('基金条目格式异常')
    } catch (error) {
      console.warn(`[detect] 世界基金数据不可用，保留其通知基线：${error.message}`)
      world = null
    }
  }
  // 同一代码只检测一次，美国源优先（世界清单也包含少量美国基金）。
  const fundsByCode = new Map((world?.funds || []).map(f => [f.code, f]))
  for (const fund of raw.funds) fundsByCode.set(fund.code, fund)
  const funds = [...fundsByCode.values()]
  return {
    updatedAt: raw.updated_at,
    generatedAt: raw.generated_at,
    state: extractState(funds),
    rawCount: funds.length,
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
 * 对比前后两份状态，返回变动列表（每条含 code/name/region/字段/旧值/新值）。
 * 代销与直销限额分别对比，各自产生一条变动（同只基金两渠道都变时是两条）。
 * prevState / currState 为 extractState 的产物。
 */
export function diffStates(prevState, currState) {
  const changes = []
  for (const [code, b] of Object.entries(currState)) {
    const a = prevState[code]
    // 新增/移出基金不发信；缺失或非法额度不能当作 0 比较。
    if (!a) continue
    for (const { key, label } of LIMIT_FIELDS) {
      const previousLimit = normalizeLimit(a[key])
      const currentLimit = normalizeLimit(b[key])
      if (previousLimit === null || currentLimit === null || previousLimit === currentLimit) continue
      changes.push({
        code,
        name: b.name,
        region: classifyRegion(b.name),
        type: 'changed',
        field: label,
        from: fmtAmount(previousLimit),
        to: fmtAmount(currentLimit),
      })
    }
  }
  return changes
}

function normalizeLimit(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

function fmtAmount(value) {
  // 避免 undefined/null/空值被渲染成字面量
  if (value === undefined || value === null || value === '') return '—'
  // 超过 5 位数（≥10 万）万元化、≥1 亿亿元化，与前端 fmtLimit 口径一致
  const n = Number(value)
  if (n >= 1e11) return '无限额'
  if (n >= 1e8) return `${Number((n / 1e8).toFixed(4))} 亿元/日`
  if (n >= 1e5) {
    const w = n / 1e4
    return `${w % 1 === 0 ? w.toLocaleString('zh-CN') : w.toFixed(1)} 万元/日`
  }
  return `${n.toLocaleString('zh-CN')} 元/日`
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
  // 暂时缺行或缺字段不擦除最后一次有效额度，恢复后仍能比较真实变化。
  const state = { ...result.prevState }
  for (const [code, current] of Object.entries(result.data.state)) {
    const previous = result.prevState[code]
    state[code] = { ...current }
    for (const { key } of LIMIT_FIELDS) {
      if (normalizeLimit(current[key]) === null && normalizeLimit(previous?.[key]) !== null) {
        state[code][key] = previous[key]
      }
    }
  }
  writeSnapshot({
    updated_at: result.data.updatedAt,
    generated_at: result.data.generatedAt,
    state,
  })
}
