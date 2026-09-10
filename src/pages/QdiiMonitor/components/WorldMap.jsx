import { memo } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { WORLD_GEO_URL } from '../worldFunds'
import styles from './WorldMap.module.css'

// topojson id 归一化：world-atlas 为 3 位零填充 numeric 字符串
const normId = (id) => String(id ?? '').padStart(3, '0')

function WorldMap({ coveredIds, selectedId, hoverName, onHover, onSelect, showCaption = true, quietHover = false }) {
  return (
    <div className={`${styles.mapWrap} ${quietHover ? styles.noHover : ''}`}>
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
              const isCovered = coveredIds.has(id)
              const isSelected = id === selectedId
              const name = geo.properties?.name || id
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  tabIndex={isCovered ? 0 : -1}
                  aria-label={name}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect(id, name)
                  }}
                  onMouseEnter={() => onHover(name, id)}
                  onMouseLeave={() => onHover('', '')}
                  onFocus={() => onHover(name, id)}
                  onBlur={() => onHover('', '')}
                  className={[
                    styles.geo,
                    isCovered ? styles.geoCovered : '',
                    isSelected ? styles.geoSelected : '',
                  ].join(' ')}
                />
              )
            })
          }
        </Geographies>
      </ComposableMap>
      {showCaption && (
        <div className={styles.mapCaption} aria-live="polite">
          {hoverName || '悬停查看国名 · 点击切换对应基金'}
        </div>
      )}
    </div>
  )
}

export default memo(WorldMap)
