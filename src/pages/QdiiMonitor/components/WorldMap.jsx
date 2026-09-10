import { memo } from 'react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import { WORLD_GEO_URL } from '../worldFunds'
import styles from './WorldMap.module.css'

// topojson id 归一化：world-atlas 为 3 位零填充 numeric 字符串
const normId = (id) => String(id ?? '').padStart(3, '0')

// 南极及亚南极无人岛：GeoJSON 自带地理，非收录市场（无基金、无圆点）。
// 在 hero 小地图（geoEqualEarth / scale 170 / 800x400）底部会被裁成几块米色碎块，
// 按 ISO numeric 过滤掉，不改投影、不影响已收录市场的填色与圆点。
const HIDDEN_IDS = new Set(['010', '239', '260', '334'])

// 世界地图。
//
// 交互约定：只有 coveredIds 里的国家可点、可聚焦、有 hover 反馈，并由 markers 标注圆点；
// 其余国家是纯装饰——无圆点、cursor: default、tabIndex -1，点击也不上报。
// 悬停/聚焦的视觉反馈（填色 + 其余国家后退）全部由 CSS 完成，不经过 React state，
// 避免 170 余个国家 path 在每次悬停时重渲染。
//
// 因此调用方必须保证 coveredIds / markers / labels 是稳定引用（模块级常量），
// 否则会击穿本组件的 memo，让上面的性能取舍失效。
function WorldMap({ coveredIds, markers, labels, selectedId, onHover, onSelect }) {
  return (
    <div className={styles.mapWrap}>
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 170 }}
        width={800}
        height={400}
        className={styles.mapSvg}
      >
        <Geographies geography={WORLD_GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const id = normId(geo.id)
              if (HIDDEN_IDS.has(id)) return null
              const isCovered = coveredIds.has(id)
              const name = geo.properties?.name || id
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  tabIndex={isCovered ? 0 : -1}
                  aria-label={isCovered ? labels[id] || name : undefined}
                  aria-hidden={isCovered ? undefined : true}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isCovered) onSelect(id, name)
                  }}
                  onMouseEnter={() => {
                    if (isCovered) onHover(id)
                  }}
                  onMouseLeave={() => onHover('')}
                  onFocus={() => {
                    if (isCovered) onHover(id)
                  }}
                  onBlur={() => onHover('')}
                  className={[
                    styles.geo,
                    isCovered ? styles.geoCovered : '',
                    id === selectedId ? styles.geoSelected : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              )
            })
          }
        </Geographies>
        {markers.map((m) => (
          <Marker key={m.id} coordinates={m.coordinates} className={styles.marker}>
            <circle r={7.5} className={styles.markerHalo} />
            <circle
              r={3.2}
              className={[styles.markerDot, m.id === selectedId ? styles.markerDotFocus : '']
                .filter(Boolean)
                .join(' ')}
            />
          </Marker>
        ))}
      </ComposableMap>
    </div>
  )
}

export default memo(WorldMap)
