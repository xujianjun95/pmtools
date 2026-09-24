import { useId, useLayoutEffect, useRef, useState } from 'react'
import styles from './HorizontalScroll.module.css'

const MIN_THUMB_WIDTH = 44
const OVERFLOW_TOLERANCE = 4

export default function HorizontalScroll({ children }) {
  const viewportId = useId()
  const viewportRef = useRef(null)
  const trackRef = useRef(null)
  const dragRef = useRef(null)
  const [metrics, setMetrics] = useState({ clientWidth: 0, scrollWidth: 0, scrollLeft: 0, trackWidth: 0 })

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return undefined

    const measure = () => {
      setMetrics((current) => {
        const next = {
          clientWidth: viewport.clientWidth,
          scrollWidth: viewport.scrollWidth,
          scrollLeft: viewport.scrollLeft,
          trackWidth: trackRef.current?.clientWidth || viewport.clientWidth - 24,
        }
        return Object.keys(next).every((key) => next[key] === current[key]) ? current : next
      })
    }

    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild)
    viewport.addEventListener('scroll', measure, { passive: true })
    measure()

    return () => {
      observer.disconnect()
      viewport.removeEventListener('scroll', measure)
    }
  }, [])

  const maxScroll = Math.max(0, metrics.scrollWidth - metrics.clientWidth)
  const hasOverflow = maxScroll > OVERFLOW_TOLERANCE
  const trackWidth = Math.max(0, metrics.trackWidth)
  const thumbWidth = Math.min(trackWidth, Math.max(MIN_THUMB_WIDTH, trackWidth * metrics.clientWidth / (metrics.scrollWidth || 1)))
  const thumbTravel = Math.max(0, trackWidth - thumbWidth)
  const thumbLeft = maxScroll ? metrics.scrollLeft / maxScroll * thumbTravel : 0

  const scrollToPosition = (clientX, drag) => {
    const viewport = viewportRef.current
    const rect = trackRef.current?.getBoundingClientRect()
    if (!viewport || !rect || !thumbTravel) return
    const thumbPosition = drag
      ? drag.startLeft + clientX - drag.startX
      : clientX - rect.left - thumbWidth / 2
    viewport.scrollLeft = Math.max(0, Math.min(thumbTravel, thumbPosition)) / thumbTravel * maxScroll
  }

  const handlePointerDown = (event) => {
    if (event.button !== 0) return
    const onThumb = event.target.dataset.thumb === 'true'
    const drag = { startX: event.clientX, startLeft: onThumb ? thumbLeft : event.clientX - trackRef.current.getBoundingClientRect().left - thumbWidth / 2 }
    dragRef.current = drag
    trackRef.current.setPointerCapture(event.pointerId)
    scrollToPosition(event.clientX, drag)
  }

  const handlePointerMove = (event) => {
    if (dragRef.current) scrollToPosition(event.clientX, dragRef.current)
  }

  const handlePointerEnd = (event) => {
    dragRef.current = null
    if (trackRef.current?.hasPointerCapture(event.pointerId)) trackRef.current.releasePointerCapture(event.pointerId)
  }

  const handleKeyDown = (event) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const steps = { ArrowLeft: -80, ArrowRight: 80, PageUp: -viewport.clientWidth, PageDown: viewport.clientWidth }
    if (event.key === 'Home') viewport.scrollLeft = 0
    else if (event.key === 'End') viewport.scrollLeft = maxScroll
    else if (event.key in steps) viewport.scrollLeft += steps[event.key]
    else return
    event.preventDefault()
  }

  return (
    <>
      <div id={viewportId} className={styles.viewport} ref={viewportRef}>{children}</div>
      {hasOverflow && (
        <div className={styles.bar}>
          <div
            className={styles.track}
            ref={trackRef}
            role="scrollbar"
            aria-label="基金表格横向滚动"
            aria-controls={viewportId}
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={Math.round(maxScroll)}
            aria-valuenow={Math.round(metrics.scrollLeft)}
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onKeyDown={handleKeyDown}
          >
            <span className={styles.thumb} data-thumb="true" style={{ width: thumbWidth, transform: `translateX(${thumbLeft}px)` }} />
          </div>
        </div>
      )}
    </>
  )
}
