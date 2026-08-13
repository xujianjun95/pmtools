import { projects } from '../../../data/projects'
import PlaceholderProjectCard from '../../../components/common/PlaceholderProjectCard'
import ProjectCard from '../../../components/common/ProjectCard'
import {
  BUILDS_SECTION_ID,
  getProjectAnchorId,
} from '../../../utils/scrollBuildsGallery'
import styles from '../Home.module.css'

function ProjectsGrid() {
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
          滚动探索更多 <span aria-hidden="true">↓</span>
        </p>
      </div>

      <div className={styles.buildsList} role="list" aria-label="造物项目列表">
        {projects.map((project, index) => (
          <div
            key={project.id}
            id={getProjectAnchorId(project.id)}
            className={styles.buildCardShell}
            role="listitem"
            data-project-motion-card
          >
            <ProjectCard project={project} reversed={index % 2 === 1} />
          </div>
        ))}
        <div
          className={styles.buildCardShell}
          role="listitem"
          data-project-motion-card
        >
          <PlaceholderProjectCard />
        </div>
      </div>
    </section>
  )
}

export default ProjectsGrid
