// 状态分组排序权重：开放 → 限大额 → 其他 → 暂停
export function statusRank(s) {
  if (s === '开放申购') return 0
  if (s === '限大额') return 1
  if (s === '暂停申购') return 3
  return 2
}

// 状态展示文案：数据源原始值 → 页面展示名
export function statusLabel(s) {
  if (s === '限大额') return '限大额申购'
  return s
}

// 返回 FundTable.module.css 中的状态类名（CSS Modules 驼峰命名）
export function statusClass(s) {
  if (s === '开放申购') return 'sOpen'
  if (s === '限大额') return 'sLimited'
  if (s === '暂停申购') return 'sSuspended'
  return 'sOther'
}

// 限额数值格式化：超过 5 位数（≥10 万）万元化、≥1 亿亿元化，其余千分位。
// 只返回数值部分，不带「元/日」后缀（调用方按各自排版拼接）
export function fmtLimit(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1e11) return '无限额'
  if (n >= 1e8) return `${Number((n / 1e8).toFixed(4))} 亿`
  if (n >= 1e5) {
    const w = n / 1e4
    return `${w % 1 === 0 ? w.toLocaleString('zh-CN') : w.toFixed(1)} 万`
  }
  return n.toLocaleString('zh-CN')
}

function validLimit(value) {
  if (value == null || typeof value === 'boolean' || String(value).trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

// 暂停按既有展示规则隐藏；直销明确为 0 时不得回退代销。
export function getChannelLimit(fund, channel = 'limit_amount') {
  if (String(fund.status).includes('暂停')) return null
  const amount = validLimit(fund[channel])
  return channel === 'direct_limit_amount' && amount === null ? validLimit(fund.limit_amount) : amount
}

export function limitText(value) {
  const n = validLimit(value)
  if (n === null || n === 0) return '—'
  return n >= 1e11 ? '无限额' : `${fmtLimit(n)} 元/日`
}

// 变更值展示：仅限额字段做数值格式化，状态类字段走展示文案映射
export function fmtChangeVal(field, v) {
  if (field === 'limit_amount' || field === 'direct_limit_amount') {
    return limitText(v)
  }
  return statusLabel(v)
}

// 历史降采样：只保留与前一快照不同的节点 + 首个节点，时间线只画变化点
export function compactHistory(history) {
  const out = []
  for (const h of history || []) {
    const p = out[out.length - 1]
    if (!p || p.status !== h.status || p.limit_amount !== h.limit_amount ||
        p.direct_limit_amount !== h.direct_limit_amount || p.redeem !== h.redeem) {
      out.push(h)
    }
  }
  return out
}

export const FIELD_LABELS = {
  status: '申购状态',
  limit_amount: '日累计限额（代销）',
  direct_limit_amount: '日累计限额（直销）',
  redeem: '赎回状态',
}
