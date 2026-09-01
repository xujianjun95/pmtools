import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BUILDS_SECTION_ID,
  scrollToBuildsGallery,
  scrollToBuildsNavState,
} from '../../utils/scrollBuildsGallery'
import { scrollToSection } from '../../utils/scrollToSection'
import BloubWink from './BloubWink'
import styles from './PmtoolsCompanion.module.css'

const NEWS_SECTION_ID = 'news-section'
const NEWS_NAV_STATE = Object.freeze({ scrollToNews: true })
const VIEWBOX_CENTER = 50
const BLOB_RADIUS = 30
const POINT_COUNT = 16
const SHAPE_TRANSITION_MS = 420
const CONFIRM_DURATION_MS = 240
// 注视模型：对齐 bloub/gaze.ts（YAW_MAX=16, PITCH_MAX=13, 静止抬眼≈+7°）
const YAW_MAX = 16
const PITCH_MAX = 13
const BASE_PITCH = 7
const EYE_RADIUS = 26

const BLOB_SHAPES = Object.freeze({
  idle: [1, 1.02, 1.01, 0.98, 1, 1.03, 1.01, 0.98, 1, 1.02, 0.99, 0.97, 1, 1.03, 1.01, 0.99],
  attention: [0.97, 1, 1.04, 1.08, 1.07, 1.03, 0.98, 0.95, 0.96, 0.98, 1.02, 1.04, 1.03, 1, 0.97, 0.95],
  guide: [1, 1.02, 1.01, 0.98, 1, 1.03, 1.01, 0.98, 1, 1.02, 0.99, 0.97, 1, 1.03, 1.01, 0.99],
  confirm: [0.82, 0.91, 1.06, 1.18, 1.22, 1.17, 1.05, 0.9, 0.82, 0.91, 1.06, 1.18, 1.22, 1.17, 1.05, 0.9],
})

const NAV_ITEMS = Object.freeze([
  { id: 'builds', index: '01', label: '看项目' },
  { id: 'news', index: '02', label: '看资讯' },
  { id: 'about', index: '03', label: '关于我' },
])

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function easeOutQuint(value) {
  return 1 - (1 - value) ** 5
}

function interpolateShape(from, to, progress) {
  return from.map((radius, index) => radius + ((to[index] ?? radius) - radius) * progress)
}

function shapeToPath(radii) {
  const points = radii.map((radius, index) => {
    const angle = -Math.PI / 2 + (index / POINT_COUNT) * Math.PI * 2
    return {
      x: VIEWBOX_CENTER + Math.cos(angle) * BLOB_RADIUS * radius,
      y: VIEWBOX_CENTER + Math.sin(angle) * BLOB_RADIUS * radius,
    }
  })

  const first = points[0]
  let path = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`

  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length]
    const current = points[index]
    const next = points[(index + 1) % points.length]
    const afterNext = points[(index + 2) % points.length]
    const controlOne = {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6,
    }
    const controlTwo = {
      x: next.x - (afterNext.x - current.x) / 6,
      y: next.y - (afterNext.y - current.y) / 6,
    }
    path += ` C ${controlOne.x.toFixed(2)} ${controlOne.y.toFixed(2)}, ${controlTwo.x.toFixed(2)} ${controlTwo.y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`
  }

  return `${path} Z`
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    const updateMatch = () => setMatches(mediaQuery.matches)
    updateMatch()
    mediaQuery.addEventListener('change', updateMatch)
    return () => mediaQuery.removeEventListener('change', updateMatch)
  }, [query])

  return matches
}

function useBlobShape(visualState, reducedMotion) {
  const [radii, setRadii] = useState(BLOB_SHAPES.idle)
  const radiiRef = useRef(BLOB_SHAPES.idle)

  useEffect(() => {
    const target = BLOB_SHAPES[visualState]
    if (reducedMotion) {
      radiiRef.current = target
      return undefined
    }

    const from = [...radiiRef.current]
    const startedAt = performance.now()
    let animationFrame = 0

    const animateShape = (now) => {
      const progress = clamp((now - startedAt) / SHAPE_TRANSITION_MS, 0, 1)
      const next = interpolateShape(from, target, easeOutQuint(progress))
      radiiRef.current = next
      setRadii(next)
      if (progress < 1) animationFrame = window.requestAnimationFrame(animateShape)
    }

    animationFrame = window.requestAnimationFrame(animateShape)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [reducedMotion, visualState])

  return useMemo(
    () => shapeToPath(reducedMotion ? BLOB_SHAPES[visualState] : radii),
    [radii, reducedMotion, visualState]
  )
}

function PmtoolsCompanion() {
  const location = useLocation()
  const navigate = useNavigate()
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const eyesRef = useRef(null)
  const headRef = useRef(null)
  const pointerFrameRef = useRef(0)
  const pointerRef = useRef(null)
  const headTargetRef = useRef({ x: 0, y: 0, rot: 0 })
  const headCurrentRef = useRef({ x: 0, y: 0, rot: 0 })
  const confirmTimerRef = useRef(0)
  const sectionPulseTimerRef = useRef(0)
  const buildsPulseSeenRef = useRef(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [sectionPulse, setSectionPulse] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [blinking, setBlinking] = useState(false)
  const [entering, setEntering] = useState(true)
  const [pageVisible, setPageVisible] = useState(() =>
    typeof document === 'undefined' ? true : !document.hidden
  )
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const finePointer = useMediaQuery('(any-pointer: fine)')

  const visualState = confirming
    ? 'confirm'
    : panelOpen
      ? 'guide'
      : hovered || focused || sectionPulse
        ? 'attention'
        : 'idle'
  const blobPath = useBlobShape(visualState, reducedMotion)

  const resetEyes = useCallback(() => {
    pointerRef.current = null
    headTargetRef.current = { x: 0, y: 0, rot: 0 }
    if (eyesRef.current) {
      eyesRef.current.setAttribute('transform', 'translate(0 0)')
      eyesRef.current.style.transform = ''
    }
    if (headRef.current) {
      headRef.current.setAttribute('transform', 'rotate(0 50 50)')
    }
    headCurrentRef.current = { x: 0, y: 0, rot: 0 }
  }, [])

  useEffect(() => {
    if (reducedMotion) return undefined
    const timer = window.setTimeout(() => setEntering(false), 760)
    return () => window.clearTimeout(timer)
  }, [reducedMotion])

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden
      setPageVisible(visible)
      if (!visible) setBlinking(false)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    if (!finePointer || !pageVisible) {
      resetEyes()
      return undefined
    }

    const updateEyes = () => {
      pointerFrameRef.current = 0
      const pointer = pointerRef.current
      const button = buttonRef.current
      const eyes = eyesRef.current
      const head = headRef.current
      if (!pointer || !button || !eyes || !head) return

      const rect = button.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      // 注视方向：bloub 同款半屏归一化。pitch 正值 = 向上看（SVG y 向下，故取反）
      const demiW = Math.max(1, window.innerWidth / 2)
      const demiH = Math.max(1, window.innerHeight / 2)
      const nx = clamp((pointer.x - centerX) / demiW, -1, 1)
      const ny = clamp((pointer.y - centerY) / demiH, -1, 1)

      const scale = reducedMotion ? 0.3 : 1
      const rad = Math.PI / 180
      const yaw = nx * YAW_MAX * scale
      const pitch = (BASE_PITCH - ny * PITCH_MAX) * scale

      // 眼球沿球面滑移：sin(yaw/pitch) 投影到平面
      const eyeX = Math.sin(yaw * rad) * EYE_RADIUS
      const eyeY = -Math.sin(pitch * rad) * EYE_RADIUS
      eyes.setAttribute('transform', `translate(${eyeX.toFixed(2)} ${eyeY.toFixed(2)})`)

      // 头部仅轻微迎合，不位移拖拽（bloub 身体不移动，眼睛在球面滑移）
      const headRot = reducedMotion ? 0 : yaw * 0.35
      head.setAttribute('transform', `rotate(${headRot.toFixed(2)} 50 50)`)
    }

    const handlePointerMove = (event) => {
      if (event.pointerType === 'touch') return
      pointerRef.current = { x: event.clientX, y: event.clientY }
      if (!pointerFrameRef.current) {
        pointerFrameRef.current = window.requestAnimationFrame(updateEyes)
      }
    }

    const handlePointerOut = (event) => {
      if (event.relatedTarget !== null) return
      resetEyes()
    }

    const handleLeave = () => resetEyes()

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('mousemove', handlePointerMove, { passive: true })
    window.addEventListener('pointerout', handlePointerOut)
    window.addEventListener('mouseout', handleLeave)
    document.addEventListener('mouseleave', handleLeave)
    window.addEventListener('blur', handleLeave)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('pointerout', handlePointerOut)
      window.removeEventListener('mouseout', handleLeave)
      document.removeEventListener('mouseleave', handleLeave)
      window.removeEventListener('blur', handleLeave)
      window.cancelAnimationFrame(pointerFrameRef.current)
      pointerFrameRef.current = 0
      resetEyes()
    }
  }, [finePointer, pageVisible, reducedMotion, resetEyes])

  useEffect(() => {
    if (reducedMotion || !pageVisible) return undefined

    let blinkTimer = 0
    let reopenTimer = 0
    const scheduleBlink = () => {
      const delay = 2800 + Math.random() * 2400
      blinkTimer = window.setTimeout(() => {
        setBlinking(true)
        reopenTimer = window.setTimeout(() => {
          setBlinking(false)
          scheduleBlink()
        }, 150)
      }, delay)
    }
    scheduleBlink()

    return () => {
      window.clearTimeout(blinkTimer)
      window.clearTimeout(reopenTimer)
    }
  }, [pageVisible, reducedMotion])

  useEffect(() => {
    if (location.pathname !== '/' || buildsPulseSeenRef.current || reducedMotion) return undefined

    let observer
    const setupFrame = window.requestAnimationFrame(() => {
      const buildsSection = document.getElementById(BUILDS_SECTION_ID)
      if (!buildsSection) return
      observer = new IntersectionObserver(
        ([entry]) => {
          if (
            buildsPulseSeenRef.current ||
            !entry.isIntersecting ||
            entry.intersectionRatio < 0.3
          ) {
            return
          }
          buildsPulseSeenRef.current = true
          setSectionPulse(true)
          sectionPulseTimerRef.current = window.setTimeout(() => setSectionPulse(false), 1200)
          observer?.disconnect()
        },
        { threshold: [0.3] }
      )
      observer.observe(buildsSection)
    })

    return () => {
      window.cancelAnimationFrame(setupFrame)
      observer?.disconnect()
    }
  }, [location.pathname, reducedMotion])

  useEffect(() => {
    const closeFrame = window.requestAnimationFrame(() => {
      setPanelOpen(false)
      setConfirming(false)
    })
    return () => window.cancelAnimationFrame(closeFrame)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!panelOpen) return undefined

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setPanelOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setPanelOpen(false)
      buttonRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [panelOpen])

  useEffect(
    () => () => {
      window.clearTimeout(confirmTimerRef.current)
      window.clearTimeout(sectionPulseTimerRef.current)
      window.cancelAnimationFrame(pointerFrameRef.current)
    },
    []
  )

  const goToDestination = useCallback(
    (destination) => {
      if (destination === 'builds') {
        if (location.pathname === '/') scrollToBuildsGallery()
        else navigate('/', { state: scrollToBuildsNavState })
        return
      }

      if (destination === 'news') {
        if (location.pathname === '/') {
          const behavior = reducedMotion ? 'auto' : 'smooth'
          scrollToSection(NEWS_SECTION_ID, behavior)
        } else {
          navigate('/', { state: NEWS_NAV_STATE })
        }
        return
      }

      navigate('/about')
    },
    [location.pathname, navigate, reducedMotion]
  )

  const handleNavigate = (destination) => {
    window.clearTimeout(confirmTimerRef.current)
    if (destination === 'builds') {
      buildsPulseSeenRef.current = true
      setSectionPulse(false)
    }
    setPanelOpen(false)
    setConfirming(!reducedMotion)
    buttonRef.current?.focus({ preventScroll: true })
    // 导航项关闭后把焦点安全地交还触发按钮，但不让这次程序化聚焦
    // 把角色永久留在横向拉伸的 attention 视觉状态。
    setFocused(false)
    confirmTimerRef.current = window.setTimeout(
      () => {
        setConfirming(false)
        goToDestination(destination)
      },
      reducedMotion ? 0 : CONFIRM_DURATION_MS
    )
  }

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-visible={pageVisible ? 'true' : 'false'}
      data-state={visualState}
    >
      <nav
        id="pmtools-companion-nav"
        className={`${styles.panel} ${panelOpen ? styles.panelOpen : ''}`}
        aria-label="PMTOOLS 快捷导航"
        aria-hidden={!panelOpen}
      >
        <div className={styles.panelHeading}>
          <span>PMTOOLS / GUIDE</span>
          <strong>想去哪里？</strong>
        </div>
        <div className={styles.navList}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.navItem}
              tabIndex={panelOpen ? 0 : -1}
              onClick={() => handleNavigate(item.id)}
            >
              <span>{item.index}</span>
              <strong>{item.label}</strong>
              <i aria-hidden="true">↗</i>
            </button>
          ))}
        </div>
      </nav>

      <button
        ref={buttonRef}
        type="button"
        className={`${styles.botButton} ${entering ? styles.entering : ''} ${blinking && pageVisible && !reducedMotion ? styles.blinking : ''}`}
        aria-label={panelOpen ? '关闭 PMTOOLS 快捷导航' : '打开 PMTOOLS 快捷导航'}
        aria-expanded={panelOpen}
        aria-controls="pmtools-companion-nav"
        onClick={() => setPanelOpen((open) => !open)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget)) setFocused(false)
        }}
      >
        <span className={styles.botShadow} aria-hidden="true" />
        <svg className={styles.botSvg} viewBox="0 0 100 100" aria-hidden="true">
          <g ref={headRef} className={styles.head}>
            <path className={styles.body} d={blobPath} />
            <g ref={eyesRef} className={styles.eyes}>
              {/* 用纯旋转矩阵而非 rotate(a cx cy)：
                  Chromium 会按 CSS 属性翻译 3 参 rotate 再叠加 fill-box 的
                  transform-origin（.eye 的 transform-box: fill-box），
                  导致两只眼睛被额外平移 (-8, +8.5) 偏到左下外缘（“自带向下趋势”的根因） */}
              <rect className={styles.eye} x="36" y="36" width="8" height="20" rx="4" transform="matrix(0.981627 -0.190809 0.190809 0.981627 0 0)" />
              <rect className={styles.eye} x="54" y="34" width="8" height="20" rx="4" transform="matrix(0.981627 -0.190809 0.190809 0.981627 0 0)" />
            </g>
          </g>
        </svg>
        <span className={styles.winkStage} aria-hidden="true">
          {panelOpen && (
            <BloubWink
              active={pageVisible}
              reducedMotion={reducedMotion}
              className={styles.winkBot}
            />
          )}
        </span>
        <span className={styles.focusRing} aria-hidden="true" />
      </button>
    </div>
  )
}

export default PmtoolsCompanion
