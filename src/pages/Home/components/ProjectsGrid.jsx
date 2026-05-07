import { useEffect, useRef, useState } from 'react'
import { projects } from '../../../data/projects'
import PlaceholderProjectCard from '../../../components/common/PlaceholderProjectCard'
import ProjectCard from '../../../components/common/ProjectCard'
import { BUILDS_SECTION_ID } from '../../../utils/scrollBuildsGallery'
import styles from '../Home.module.css'

function ProjectsGrid() {
  const trackRef = useRef(null)
  const [atEnd, setAtEnd] = useState(false)

  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    const check = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el
      setAtEnd(scrollLeft + clientWidth >= scrollWidth - 10)
    }

    el.addEventListener('scroll', check, { passive: true })
    check()
    return () => el.removeEventListener('scroll', check)
  }, [])

  return (
    <section
      id={BUILDS_SECTION_ID}
      className={styles.buildsSection}
      aria-labelledby="builds-gallery-heading"
    >
      <div className={styles.buildsHeader}>
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
        <div
          ref={trackRef}
          className={styles.carouselTrack}
          role="region"
          aria-label="造物项目卡片列表"
          tabIndex={0}
        >
          {projects.map((project, index) => (
            <div key={project.id} className={styles.cardWrapper}>
              <ProjectCard
                project={project}
                delayClassName={`fi d${index + 4}`}
              />
            </div>
          ))}
          <div className={styles.cardWrapper}>
            <PlaceholderProjectCard delayClassName={`fi d${projects.length + 4}`} />
          </div>
        </div>
      </div>
    </section>
  )
}

export default ProjectsGrid
