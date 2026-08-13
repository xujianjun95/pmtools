import { useState } from 'react'
import { Link } from 'react-router-dom'
import ProjectMockup from '../mockups/ProjectMockup'
import ProjectBadges from './ProjectBadges'
import TechTag from './TechTag'
import styles from './ProjectCard.module.css'

function ProjectCard({ project, reversed = false }) {
  const [isPreviewActive, setIsPreviewActive] = useState(false)
  const cardClass = `${styles.card}${reversed ? ` ${styles.reversed}` : ''}`

  return (
    <Link
      to={`/project/${project.id}`}
      className={cardClass}
      onMouseEnter={() => setIsPreviewActive(true)}
      onMouseLeave={() => setIsPreviewActive(false)}
      onFocus={() => setIsPreviewActive(true)}
      onBlur={() => setIsPreviewActive(false)}
    >
      <div className={styles.mockupWrap}>
        <div className={styles.mockupInner} data-project-preview>
          <ProjectMockup type={project.mockupType} isActive={isPreviewActive} />
        </div>
      </div>

      <div className={styles.content} data-project-copy>
        <div className={styles.header}>
          <span className={styles.num}>{project.number}</span>
          <span className={styles.arrow}>↗</span>
        </div>
        <div className={styles.nameRow}>
          <h3 className={styles.name}>{project.title}</h3>
        </div>
        {(project.featuredBadge || project.badge) && (
          <ProjectBadges
            featuredBadge={project.featuredBadge}
            badge={project.badge}
            className={styles.cardBadges}
          />
        )}
        <p className={styles.tagline}>{project.tagline}</p>
        <p className={styles.desc}>{project.description}</p>
        <div className={styles.footer}>
          <div className={styles.tags}>
            {project.tags.map((tag) => (
              <TechTag key={tag} className={styles.cardTag}>
                {tag}
              </TechTag>
            ))}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default ProjectCard
