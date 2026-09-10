import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import WorldMap from './WorldMap'
import styles from './HeroSection.module.css'

// 外层只高亮美国：传空集合，所有非美国国家都渲染为未选中态
const NO_COVERED = new Set()

// Hero 右侧小地图：只高亮美国（呼应本页纳指/标普监控），其余国家一律未选中状态。
// 默认干净无文案；鼠标移入浮现暗色遮罩 + 居中按钮，点击进世界页并保持选中连贯。
export default function HeroWorldMap() {
  const navigate = useNavigate()
  const [hovering, setHovering] = useState(false)

  const go = (country) => navigate(country ? `/qdii/world?country=${country}` : '/qdii/world')

  return (
    <div
      className={`${styles.worldMini} fi d3`}
      role="link"
      tabIndex={0}
      aria-label="点击地图查看其他国家市场主动基金信息"
      onClick={() => go()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') go()
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
    >
      <WorldMap
        coveredIds={NO_COVERED}
        selectedId="840"
        hoverName=""
        onHover={() => {}}
        onSelect={(id) => go(id)}
        showCaption={false}
        quietHover
      />
      <div className={`${styles.mapVeil} ${hovering ? styles.mapVeilOn : ''}`} aria-hidden="true">
        <span className={styles.mapCta}>
          点击地图查看其他国家市场主动基金信息
          <span className={styles.mapTagArrow} aria-hidden="true">→</span>
        </span>
      </div>
    </div>
  )
}
