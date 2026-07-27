import styles from './DiaGradient.module.css'

const DIA_STOPS = [
  { offset: 0, color: '#340B05' },
  { offset: 0.1827, color: '#0358F7' },
  { offset: 0.2837, color: '#5092C7' },
  { offset: 0.4135, color: '#4C8ED8' },
  { offset: 0.5866, color: '#FFD400' },
  { offset: 0.6827, color: '#FA3D1D' },
  { offset: 0.8029, color: '#FD02F5' },
  { offset: 1, color: '#FFC0FD00' },
]

const VIEWBOX_WIDTH = 1271
const VIEWBOX_HEIGHT = 599
const BAR_COUNT = 9
const BLUR_AMOUNT = 15
const PEAK_HEIGHT = 0.98
const VALLEY_HEIGHT = 0.55

function getBellHeights() {
  const middle = (BAR_COUNT - 1) / 2

  return Array.from({ length: BAR_COUNT }, (_, index) => {
    const distance = middle === 0 ? 0 : Math.abs(index - middle) / middle
    const eased = 1 - Math.pow(distance, 1.24)

    return (
      PEAK_HEIGHT *
      VIEWBOX_HEIGHT *
      (VALLEY_HEIGHT + (1 - VALLEY_HEIGHT) * eased)
    )
  })
}

function DiaGradient() {
  const heights = getBellHeights()
  const columnWidth = VIEWBOX_WIDTH / BAR_COUNT

  return (
    <div className={styles.stage} aria-hidden="true">
      <svg
        className={styles.svg}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="pmtools-dia-gradient" x1="0" y1="1" x2="0" y2="0">
            {DIA_STOPS.map(({ offset, color }) => (
              <stop
                key={`${offset}-${color}`}
                offset={offset}
                stopColor={color}
              />
            ))}
          </linearGradient>
          <filter
            id="pmtools-dia-blur"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur stdDeviation={BLUR_AMOUNT} />
          </filter>
        </defs>

        {heights.map((height, index) => {
          const edgeBleed = BLUR_AMOUNT * 4
          const leftBleed = index === 0 ? edgeBleed : 0
          const rightBleed =
            index === heights.length - 1 ? edgeBleed : 0
          const columnX = index * columnWidth - leftBleed
          const renderedWidth =
            columnWidth * 1.23 + leftBleed + rightBleed

          return (
            <g key={index} filter="url(#pmtools-dia-blur)">
              <rect
                x={columnX}
                y={VIEWBOX_HEIGHT - BLUR_AMOUNT * 2}
                width={renderedWidth}
                height={BLUR_AMOUNT * 4}
                fill={DIA_STOPS[0].color}
              />
              <rect
                x={columnX}
                y={VIEWBOX_HEIGHT - height}
                width={renderedWidth}
                height={height}
                fill="url(#pmtools-dia-gradient)"
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default DiaGradient
