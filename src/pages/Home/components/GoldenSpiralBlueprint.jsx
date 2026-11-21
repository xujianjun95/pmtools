import { useEffect, useLayoutEffect, useRef } from 'react'
import styles from './GoldenSpiralBlueprint.module.css'

const PHI = (1 + Math.sqrt(5)) / 2
const WIDTH = 1000
const HEIGHT = WIDTH / PHI
const PAPER_WIDTH = WIDTH + 124
const ARC_POINTS = 40
const SQUARE_COUNT = 9
const FIBONACCI_LABELS = [34, 21, 13, 8, 5, 3]

const FRAME_DURATION = 500
const SQUARE_START = 300
const SQUARE_INTERVAL = 120
const SQUARE_DURATION = 350
const SPIRAL_START = 700
const SPIRAL_DURATION = 2400
const SPIRAL_END = SPIRAL_START + SPIRAL_DURATION
const ANNOTATION_START = SPIRAL_END - 600
const ANNOTATION_INTERVAL = 120
const ANNOTATION_DURATION = 420
const PULSE_DURATION = 400
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const PARALLAX_MEDIA = '(min-width: 769px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
const POINTER_EASING = 0.09
const POINTER_SETTLE_DISTANCE = 0.001

const ANNOTATIONS = [
  { x: 0, y: -26, text: 'La divina proportione — Luca Pacioli, 1509' },
  { x: WIDTH, y: -26, anchor: 'end', text: 'Sectio aurea' },
  { x: 0, y: HEIGHT + 89, text: 'φ = (1 + √5) / 2 = 1.6180339887…' },
  { x: WIDTH, y: HEIGHT + 89, anchor: 'end', text: 'a / b = b / (a + b) = φ' },
  { x: WIDTH / 2, y: HEIGHT + 137, anchor: 'middle', text: 'Fibonacci sequence — the growth of nature' },
]
const DRAW_END = Math.max(
  SPIRAL_END + PULSE_DURATION,
  ANNOTATION_START + (ANNOTATIONS.length - 1) * ANNOTATION_INTERVAL + ANNOTATION_DURATION,
)

function createBlueprint() {
  const squares = []
  const points = []
  let left = 0
  let top = 0
  let right = WIDTH
  let bottom = HEIGHT
  let totalRadius = 0

  for (let index = 0; index < SQUARE_COUNT; index++) {
    const direction = index % 4
    const side = Math.min(right - left, bottom - top)
    const x = direction === 2 ? right - side : left
    const y = direction === 3 ? bottom - side : top

    // The arc centers rotate from bottom-right to bottom-left, top-left, and top-right.
    const centerX = x + (direction === 0 || direction === 3 ? side : 0)
    const centerY = y + (direction < 2 ? side : 0)
    const startAngle = (direction + 2) * Math.PI / 2

    squares.push({ x, y, side, radiusBeforeArc: totalRadius })
    totalRadius += side

    // Adjacent arcs share an endpoint. Add it only once to the continuous polyline.
    for (let pointIndex = index === 0 ? 0 : 1; pointIndex < ARC_POINTS; pointIndex++) {
      const angle = startAngle + (pointIndex / (ARC_POINTS - 1)) * Math.PI / 2
      points.push([
        centerX + side * Math.cos(angle),
        centerY + side * Math.sin(angle),
      ])
    }

    switch (direction) {
      case 0: left += side; break
      case 1: top += side; break
      case 2: right -= side; break
      case 3: bottom -= side; break
    }
  }

  return {
    squares,
    path: points.map(([x, y], index) => (
      `${index === 0 ? 'M' : 'L'}${x.toFixed(6)} ${y.toFixed(6)}`
    )).join(' '),
    endpoint: points.at(-1),
    // Every arc has the same angular step, so its polyline length is proportional to its radius.
    labelProgress: squares.slice(0, FIBONACCI_LABELS.length)
      .map(({ radiusBeforeArc }) => radiusBeforeArc / totalRadius),
  }
}

const BLUEPRINT = createBlueprint()
const DIMENSION_Y = HEIGHT + 33
const DIMENSION_TICKS = [0, HEIGHT, WIDTH]

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function easeInOutQuad(progress) {
  return progress < 0.5 ? 2 * progress ** 2 : 1 - 2 * (1 - progress) ** 2
}

function drawBlueprint(svg) {
  const frame = svg.querySelector('[data-frame]')
  const squares = svg.querySelectorAll('[data-square]')
  const spiral = svg.querySelector('[data-spiral]')
  const pen = svg.querySelector('[data-pen]')
  const ring = svg.querySelector('[data-ring]')
  const labels = svg.querySelectorAll('[data-number]')
  const annotations = svg.querySelectorAll('[data-annotation]')
  const spiralLength = spiral.getTotalLength()
  const setProgress = (node, name, value) => node.style.setProperty(name, value)
  let frameId
  let startedAt

  function paint(elapsed) {
    const spiralTime = clamp((elapsed - SPIRAL_START) / SPIRAL_DURATION)
    const progress = easeInOutQuad(spiralTime)
    const isDrawing = elapsed >= SPIRAL_START && elapsed < SPIRAL_END
    const pulse = clamp((elapsed - SPIRAL_END) / PULSE_DURATION)

    setProgress(frame, '--offset', 1 - clamp(elapsed / FRAME_DURATION))
    squares.forEach((square, index) => {
      const delay = SQUARE_START + SQUARE_INTERVAL * index
      setProgress(square, '--offset', 1 - clamp((elapsed - delay) / SQUARE_DURATION))
    })
    setProgress(svg, '--dimension-offset', 1 - clamp((elapsed - SQUARE_START) / SQUARE_DURATION))
    setProgress(svg, '--spiral-offset', 1 - progress)
    setProgress(pen, '--visibility', Number(isDrawing))
    if (isDrawing) {
      const point = spiral.getPointAtLength(spiralLength * progress)
      pen.setAttribute('cx', point.x)
      pen.setAttribute('cy', point.y)
    }

    setProgress(svg, '--endpoint-opacity', clamp((elapsed - SPIRAL_END) / 160))
    setProgress(ring, '--visibility', elapsed < SPIRAL_END ? 0 : (1 - pulse) * 0.75)
    ring.setAttribute('r', 6 + 21 * (1 - (1 - pulse) ** 2))
    ring.style.setProperty('--offset', 1 - clamp(pulse * 3))

    labels.forEach((label, index) => {
      const start = BLUEPRINT.labelProgress[index]
      const arrival = start < 0.5 ? Math.sqrt(start / 2) : 1 - Math.sqrt((1 - start) / 2)
      setProgress(label, '--visibility', clamp((elapsed - SPIRAL_START - arrival * SPIRAL_DURATION) / 250))
    })
    annotations.forEach((annotation, index) => {
      const delay = ANNOTATION_START + index * ANNOTATION_INTERVAL
      setProgress(annotation, '--visibility', clamp((elapsed - delay) / ANNOTATION_DURATION))
    })
  }

  function tick(now) {
    startedAt ??= now
    const elapsed = now - startedAt
    paint(elapsed)
    if (elapsed < DRAW_END) {
      frameId = requestAnimationFrame(tick)
    } else {
      svg.removeAttribute('data-drawing')
    }
  }

  paint(0)
  svg.setAttribute('data-drawing', '')
  frameId = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(frameId)
    svg.removeAttribute('data-drawing')
  }
}

function bindPaperPointer(stage, coordinateLabel) {
  const media = window.matchMedia(PARALLAX_MEDIA)
  let frameId = null
  let currentX = 0
  let currentY = 0
  let targetX = 0
  let targetY = 0

  function easePointer(current, target) {
    const distance = target - current
    return Math.abs(distance) < POINTER_SETTLE_DISTANCE ? target : current + distance * POINTER_EASING
  }

  function updateParallax() {
    currentX = easePointer(currentX, targetX)
    currentY = easePointer(currentY, targetY)
    stage.style.setProperty('--pointer-x', currentX)
    stage.style.setProperty('--pointer-y', currentY)
    frameId = currentX === targetX && currentY === targetY ? null : requestAnimationFrame(updateParallax)
  }

  function scheduleParallax() {
    if (frameId === null) frameId = requestAnimationFrame(updateParallax)
  }

  function handlePointer(event) {
    if (event.pointerType !== 'mouse' || !media.matches) return

    const { left, top, width, height } = stage.getBoundingClientRect()
    if (!width || !height) return

    const x = clamp((event.clientX - left) / width)
    const y = clamp((event.clientY - top) / height)
    // SVG group translations use viewBox units, so convert the requested screen pixels.
    stage.style.setProperty('--drawing-unit', PAPER_WIDTH / width)
    stage.style.setProperty('--measure-x', `${x * width}px`)
    stage.style.setProperty('--measure-y', `${y * height}px`)
    coordinateLabel.textContent = `x ${x.toFixed(3)}  y ${y.toFixed(3)}`
    stage.setAttribute('data-measuring', '')

    targetX = x * 2 - 1
    targetY = y * 2 - 1
    scheduleParallax()
  }

  function leavePaper() {
    if (!stage.hasAttribute('data-measuring')) return
    stage.removeAttribute('data-measuring')
    targetX = 0
    targetY = 0
    scheduleParallax()
  }

  function clearPointer() {
    if (frameId !== null) cancelAnimationFrame(frameId)
    frameId = null
    currentX = 0
    currentY = 0
    targetX = 0
    targetY = 0
    stage.removeAttribute('data-measuring')
    stage.style.removeProperty('--pointer-x')
    stage.style.removeProperty('--pointer-y')
  }

  stage.addEventListener('pointerenter', handlePointer)
  stage.addEventListener('pointermove', handlePointer)
  stage.addEventListener('pointerleave', leavePaper)
  stage.addEventListener('pointercancel', leavePaper)
  media.addEventListener('change', clearPointer)

  return () => {
    stage.removeEventListener('pointerenter', handlePointer)
    stage.removeEventListener('pointermove', handlePointer)
    stage.removeEventListener('pointerleave', leavePaper)
    stage.removeEventListener('pointercancel', leavePaper)
    media.removeEventListener('change', clearPointer)
    clearPointer()
  }
}

export default function GoldenSpiralBlueprint({ autoPlay = true }) {
  const stageRef = useRef(null)
  const svgRef = useRef(null)
  const coordinatesRef = useRef(null)

  useLayoutEffect(() => {
    const motion = window.matchMedia(REDUCED_MOTION)
    if (!autoPlay || motion.matches) return undefined

    const stop = drawBlueprint(svgRef.current)
    const handleMotionChange = (event) => {
      if (event.matches) stop()
    }
    motion.addEventListener('change', handleMotionChange)
    return () => {
      motion.removeEventListener('change', handleMotionChange)
      stop()
    }
  }, [autoPlay])

  useEffect(() => bindPaperPointer(stageRef.current, coordinatesRef.current), [])

  const [endpointX, endpointY] = BLUEPRINT.endpoint

  return (
    <figure className={styles.blueprint}>
      <div ref={stageRef} className={styles.stage}>
        <svg
          ref={svgRef}
          className={styles.drawing}
          viewBox={`-62 -92 ${PAPER_WIDTH} ${HEIGHT + 270}`}
          role="img"
          aria-label="黄金矩形内的九个正方形和一笔画出的黄金螺旋"
        >
          <g className={styles.backgroundLayer}>
            <rect
              data-frame=""
              className={`${styles.stroke} ${styles.frame}`}
              width={WIDTH}
              height={HEIGHT}
              pathLength="1"
            />
            {BLUEPRINT.squares.map(({ x, y, side }) => (
              <rect
                key={side}
                data-square=""
                className={`${styles.stroke} ${styles.square}`}
                x={x}
                y={y}
                width={side}
                height={side}
                pathLength="1"
              />
            ))}
            <g className={styles.dimension}>
              <path className={styles.stroke} d={`M0 ${DIMENSION_Y} H${WIDTH}`} pathLength="1" />
              {DIMENSION_TICKS.map((x) => (
                <path key={x} className={styles.stroke} d={`M${x} ${DIMENSION_Y - 10} v20`} pathLength="1" />
              ))}
            </g>
          </g>
          <g className={styles.spiralLayer}>
            <path data-spiral="" className={`${styles.stroke} ${styles.spiral}`} d={BLUEPRINT.path} pathLength="1" />
            <circle data-pen="" className={styles.pen} r="6" />
            <circle data-ring="" className={`${styles.stroke} ${styles.ring}`} cx={endpointX} cy={endpointY} r="6" pathLength="1" />
            <circle className={styles.endpoint} cx={endpointX} cy={endpointY} r="6" />
          </g>
          <g className={styles.foregroundLayer}>
            {FIBONACCI_LABELS.map((label, index) => {
              const { x, y } = BLUEPRINT.squares[index]
              return (
                <text key={label} data-number="" className={styles.number} x={x + 9} y={y + 26}>
                  {label}
                </text>
              )
            })}
            {ANNOTATIONS.map(({ x, y, anchor, text }) => (
              <text key={text} data-annotation="" className={styles.annotation} x={x} y={y} textAnchor={anchor}>
                {text}
              </text>
            ))}
          </g>
        </svg>
        <div className={styles.measurement} aria-hidden="true">
          <svg className={styles.measurementLines}>
            <line className={styles.measureHorizontal} x2="100%" />
            <line className={styles.measureVertical} y2="100%" />
          </svg>
          <span ref={coordinatesRef} className={styles.coordinates} />
        </div>
      </div>
    </figure>
  )
}
