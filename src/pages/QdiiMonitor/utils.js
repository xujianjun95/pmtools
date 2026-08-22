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

export function fmtLimit(v) {
  const n = Number(v)
  if (!n || n <= 0) return '—'
  return n >= 1e8 ? `${(n / 1e8).toFixed(0)} 亿` : n.toLocaleString('zh-CN')
}

// 变更值展示：仅限额字段做数值格式化，状态类字段走展示文案映射
export function fmtChangeVal(field, v) {
  if (field === 'limit_amount') {
    const n = Number(v)
    return n > 0 ? `${n.toLocaleString('zh-CN')} 元/日` : '不限'
  }
  return statusLabel(v)
}

// 历史降采样：只保留与前一快照不同的节点 + 首个节点，时间线只画变化点
export function compactHistory(history) {
  const out = []
  for (const h of history || []) {
    const p = out[out.length - 1]
    if (!p || p.status !== h.status || p.limit_amount !== h.limit_amount || p.redeem !== h.redeem) {
      out.push(h)
    }
  }
  return out
}

export const FIELD_LABELS = {
  status: '申购状态',
  limit_amount: '日累计限额',
  redeem: '赎回状态',
}
