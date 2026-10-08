import { useEffect, useMemo, useState } from 'react'
import {
  HALF_VIEWBOX,
  MORPH_DURATION,
  RADIUS,
  round,
  sampleAttentive,
  sampleWink,
} from './bloubWinkMotion'

/** @param {{active: boolean, reducedMotion?: boolean, className?: string, expression?: 'wink' | 'attentive'}} props */
function BloubWink({ active, reducedMotion = false, className = '', expression = 'wink' }) {
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
    () => (expression === 'attentive' ? sampleAttentive : sampleWink)(reducedMotion ? MORPH_DURATION : elapsed),
    [elapsed, reducedMotion, expression]
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
