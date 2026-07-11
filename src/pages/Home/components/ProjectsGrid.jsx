import { useCallback, useEffect, useRef, useState } from 'react'
import { projects } from '../../../data/projects'
import PlaceholderProjectCard from '../../../components/common/PlaceholderProjectCard'
import ProjectCard from '../../../components/common/ProjectCard'
import { BUILDS_SECTION_ID } from '../../../utils/scrollBuildsGallery'
import styles from '../Home.module.css'

function ProjectsGrid() {
  const trackRef = useRef(null)
  const [atEnd, setAtEnd] = useState(false)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = trackRef.current
    if (!el) return

    const { scrollLeft, scrollWidth, clientWidth } = el
    const maxScrollLeft = Math.max(0, scrollWidth - clientWidth)

    setCanScrollPrev(scrollLeft > 10)
    setCanScrollNext(scrollLeft < maxScrollLeft - 10)
    setAtEnd(scrollLeft + clientWidth >= scrollWidth - 10)
  }, [])

  const scrollByCard = useCallback((direction) => {
    const el = trackRef.current
    if (!el) return

    const firstCard = el.querySelector('[data-home-build-card]')
    const styles = window.getComputedStyle(el)
    const gap = Number.parseFloat(styles.columnGap || styles.gap || '0') || 0
    const cardWidth = firstCard?.getBoundingClientRect().width || el.clientWidth

    el.scrollBy({
      left: direction * (cardWidth + gap),
      behavior: 'smooth',
    })
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    el.addEventListener('scroll', updateScrollState, { passive: true })
    const resizeObserver = new ResizeObserver(updateScrollState)
    resizeObserver.observe(el)
    updateScrollState()

    return () => {
      el.removeEventListener('scroll', updateScrollState)
      resizeObserver.disconnect()
    }
  }, [updateScrollState])

  return (
    <section
      id={BUILDS_SECTION_ID}
      className={styles.buildsSection}
      aria-labelledby="builds-gallery-heading"
      data-home-builds-section
    >
      <div
        className={styles.buildsHeader}
        data-home-scroll-header
        data-home-builds-header
      >
        <h2 id="builds-gallery-heading" className={styles.buildsTitle}>
          造物
          <span className={styles.buildsCount}> / BUILDS</span>
        </h2>
        <p className={styles.buildsDesc}>
          滑动探索更多
          <span className={styles.arrowRight}> →</span>
          <span className={styles.arrowDown}> ↓</span>
        </p>
      </div>

      <div className={`${styles.carouselShell}${atEnd ? ` ${styles.carouselShellAtEnd}` : ''}`}>
        <div className={styles.carouselControls} aria-label="造物项目滑动控制">
          <button
            type="button"
            className={`${styles.carouselButton} ${styles.carouselButtonPrev}`}
            onClick={() => scrollByCard(-1)}
            disabled={!canScrollPrev}
            aria-label="向左滑动造物项目"
          >
            <svg
              className={styles.carouselButtonIcon}
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M14.5 6.5L9 12L14.5 17.5" />
            </svg>
          </button>
          <button
            type="button"
            className={`${styles.carouselButton} ${styles.carouselButtonNext}`}
            onClick={() => scrollByCard(1)}
            disabled={!canScrollNext}
            aria-label="向右滑动造物项目"
          >
            <svg
              className={styles.carouselButtonIcon}
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M9.5 6.5L15 12L9.5 17.5" />
            </svg>
          </button>
        </div>
        <div
          ref={trackRef}
          className={styles.carouselTrack}
          role="region"
          aria-label="造物项目卡片列表"
          tabIndex={0}
          data-home-builds-track
        >
          {projects.map((project, index) => (
            <div key={project.id} className={styles.cardWrapper} data-home-build-card>
              <ProjectCard
                project={project}
                delayClassName={`fi d${index + 4}`}
              />
            </div>
          ))}
          <div className={styles.cardWrapper} data-home-build-card>
            <PlaceholderProjectCard delayClassName={`fi d${projects.length + 4}`} />
          </div>
        </div>
      </div>
    </section>
  )
}

export default ProjectsGrid
