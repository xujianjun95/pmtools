import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import DiaGradient from './DiaGradient'
import styles from './Footer.module.css'

function Footer() {
  const location = useLocation()
  const gradientStageRef = useRef(null)
  const gradientRef = useRef(null)
  const showHomeGradient = location.pathname === '/'

  useEffect(() => {
    const stage = gradientStageRef.current
    const gradient = gradientRef.current
    if (!showHomeGradient || !stage || !gradient) return undefined

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    )
    let frameId

    const updateReveal = () => {
      frameId = undefined

      const viewportHeight = window.innerHeight || 1
      const stageTop = stage.getBoundingClientRect().top
      const revealStart = viewportHeight
      const revealEnd = 0
      const rawProgress =
        (revealStart - stageTop) / (revealStart - revealEnd)
      const progress = reduceMotion.matches
        ? Number(stageTop < revealStart)
        : Math.max(0, Math.min(1, rawProgress))

      gradient.dataset.revealState =
        progress <= 0
          ? 'idle'
          : progress >= 0.999
            ? 'complete'
            : 'active'
      gradient.style.setProperty(
        '--gradient-scale-y',
        progress.toFixed(4)
      )
    }

    const scheduleRevealUpdate = () => {
      if (frameId !== undefined) return
      frameId = window.requestAnimationFrame(updateReveal)
    }

    scheduleRevealUpdate()
    window.addEventListener('scroll', scheduleRevealUpdate, { passive: true })
    window.addEventListener('resize', scheduleRevealUpdate, { passive: true })
    reduceMotion.addEventListener?.('change', scheduleRevealUpdate)

    return () => {
      if (frameId !== undefined) window.cancelAnimationFrame(frameId)
      window.removeEventListener('scroll', scheduleRevealUpdate)
      window.removeEventListener('resize', scheduleRevealUpdate)
      reduceMotion.removeEventListener?.('change', scheduleRevealUpdate)
    }
  }, [showHomeGradient])

  return (
    <footer
      className={`${styles.footer} ${
        showHomeGradient ? styles.footerWithGradient : ''
      }`}
    >
      <div className={styles.inner}>
        <span className={styles.copy}>2026 PMTOOLS</span>
        <span className={styles.note}>Crafted with care</span>
      </div>

      {showHomeGradient && (
        <div
          ref={gradientStageRef}
          className={styles.gradientStage}
        >
          <div
            ref={gradientRef}
            className={styles.gradient}
          >
            <DiaGradient />
          </div>
        </div>
      )}
    </footer>
  )
}

export default Footer
