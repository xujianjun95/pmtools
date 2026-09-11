import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import WorldMap from './WorldMap'
import { OTHER_MARKET_COUNTRIES, countryById } from '../worldFunds'
import { fmtLimit } from '../utils'
import styles from './HeroSection.module.css'

// 以下三个常量必须是模块级：WorldMap 用 memo 包裹，靠引用稳定来避免
// 悬停时重渲染 170 余个国家 path（见 WorldMap.jsx 注释）。
const COVERED_IDS = new Set(OTHER_MARKET_COUNTRIES.map((c) => c.id))
const MARKERS = OTHER_MARKET_COUNTRIES.map((c) => ({ id: c.id, coordinates: c.marker }))
const LABELS = Object.fromEntries(
  OTHER_MARKET_COUNTRIES.map((c) => [c.id, `${c.zh}，${c.funds.length} 只基金，进入该国市场`])
)

const STATUS_ORDER = ['开放申购', '限大额', '暂停申购']

// 状态摘要：全部同一状态 → 均为「限大额」；混合 → 按 开放 → 限大额 → 暂停 排列
function statusSummary(funds) {
  const kinds = [...new Set(funds.map((f) => f.status))]
  if (kinds.length === 1) return `均为「${kinds[0]}」`
  return kinds
    .sort((a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b))
    .join(' / ')
}

// 限额区间：暂停申购没有有效限额、不参与统计；全部无有效值时返回 null
function limitRange(funds) {
  const values = funds
    .filter((f) => !String(f.status).includes('暂停'))
    .map((f) => Number(f.limit_amount))
    .filter((n) => n > 0)
  if (!values.length) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  return min === max ? `${fmtLimit(min)} 元/日` : `${fmtLimit(min)} – ${fmtLimit(max)} 元/日`
}

// Hero 右侧世界小地图。
//
// 交互：地图本体即入口——圆点国家可点、可悬停、可用 Tab 聚焦；悬停/聚焦时下方信息条
// 换成该国摘要。底部固定一行，左侧信息、右侧常驻「查看其他市场」，因此不依赖 hover
// 也能进入世界页。整卡不再是链接（此前整卡可点但悬停只提示"点击地图"，反馈与结果不一致）。
export default function HeroWorldMap() {
  const navigate = useNavigate()
  const [hoveredId, setHoveredId] = useState('')

  const handleHover = useCallback((id) => setHoveredId(id), [])
  const handleSelect = useCallback(
    (id) => {
      if (COVERED_IDS.has(id)) navigate(`/qdii/world?country=${id}`)
    },
    [navigate]
  )

  const hovered = hoveredId ? countryById(hoveredId) : null
  const limits = hovered ? limitRange(hovered.funds) : null

  return (
    <div className={`${styles.worldMini} fi d3`}>
      <WorldMap
        coveredIds={COVERED_IDS}
        markers={MARKERS}
        labels={LABELS}
        onHover={handleHover}
        onSelect={handleSelect}
      />
      <div className={styles.mapFoot}>
        <div className={styles.mapInfo} aria-live="polite">
          {/* 触摸端常驻提示：无 hover，由 @media (hover: none) 切换显示 */}
          <span className={styles.mapHintTouch}>点击圆点国家进入对应市场</span>
          {hovered ? (
            <span className={styles.infoHover}>
              <span className={styles.infoZh}>{hovered.zh}</span>
              <span className={styles.infoEn}>{hovered.en}</span>
              <span className={styles.infoMeta}>
                {hovered.funds.length} 只基金 · {statusSummary(hovered.funds)}
                {limits ? ` · ${limits}` : ''}
              </span>
            </span>
          ) : (
            <span className={styles.mapHintHover}>圆点为已收录市场 · 悬停查看，点击进入</span>
          )}
        </div>
        <Link to="/qdii/world" className={styles.mapAllLink}>
          查看其他市场 →
        </Link>
      </div>
    </div>
  )
}
