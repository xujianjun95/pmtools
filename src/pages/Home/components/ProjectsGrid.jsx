import { projects } from '../../../data/projects'
import PlaceholderProjectCard from '../../../components/common/PlaceholderProjectCard'
import ProjectCard from '../../../components/common/ProjectCard'
import { BUILDS_SECTION_ID } from '../../../utils/scrollBuildsGallery'
import styles from '../Home.module.css'

function ProjectsGrid() {
  return (
    <section
      id={BUILDS_SECTION_ID}
      className={styles.buildsSection}
      aria-labelledby="builds-gallery-heading"
    >
      <div className={styles.buildsHeader}>
        <h2 id="builds-gallery-heading" className={styles.buildsTitle}>
          构建
          <span className={styles.buildsCount}> / BUILDS</span>
        </h2>
        <p className={styles.buildsDesc}>滑动查看更多探索 →</p>
      </div>

      <div className={styles.carouselShell}>
        <div
          className={styles.carouselTrack}
          role="region"
          aria-label="构建项目卡片，可横向滑动"
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
