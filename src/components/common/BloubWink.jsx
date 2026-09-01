import { useEffect, useMemo, useState } from 'react'
import {
  HALF_VIEWBOX,
  MORPH_DURATION,
  RADIUS,
  round,
  sampleWink,
} from './bloubWinkMotion'

function BloubWink({ active, reducedMotion = false, className = '' }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!active || reducedMotion) return undefined

    const startedAt = performance.now()
    let animationFrame = 0
    const renderFrame = (now) => {
      setElapsed((now - startedAt) / 1000)
      animationFrame = window.requestAnimationFrame(renderFrame)
    }
    animationFrame = window.requestAnimationFrame(renderFrame)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [active, reducedMotion])

  const frame = useMemo(
    () => sampleWink(reducedMotion ? MORPH_DURATION : elapsed),
    [elapsed, reducedMotion]
  )

  return (
    <svg
      className={className}
      viewBox={`${-HALF_VIEWBOX} ${-HALF_VIEWBOX} ${HALF_VIEWBOX * 2} ${HALF_VIEWBOX * 2}`}
      aria-hidden="true"
      focusable="false"
    >
      <g transform={`translate(${round(frame.driftX)} ${round(frame.driftY)})`}>
        <ellipse
          cx="0"
          cy="0"
          rx={RADIUS}
          ry={round(RADIUS * frame.breath)}
          fill="var(--companion-ink)"
        />
        {frame.eyes.map((eye, index) => (
          <path
            key={index}
            d={eye.path}
            transform={eye.transform}
            opacity={eye.opacity}
            fill="var(--surface)"
          />
        ))}
      </g>
    </svg>
  )
}

export default BloubWink
