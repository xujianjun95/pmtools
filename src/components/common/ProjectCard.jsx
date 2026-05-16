import { Link } from 'react-router-dom'
import ProjectMockup from '../mockups/ProjectMockup'
import TechTag from './TechTag'
import styles from './ProjectCard.module.css'

function ProjectCard({ project, delayClassName = '' }) {
  const cardClass = `${styles.card} ${delayClassName}`.trim()

  return (
    <Link to={`/project/${project.id}`} className={cardClass}>
      <div className={styles.mockupWrap}>
        <div className={styles.mockupInner}>
          <ProjectMockup type={project.mockupType} />
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.num}>{project.number}</span>
          <span className={styles.arrow}>↗</span>
        </div>
        <h3 className={styles.name}>{project.title}</h3>
        <p className={styles.tagline}>{project.tagline}</p>
        <p className={styles.desc}>{project.description}</p>
        <div className={styles.tags}>
          {project.tags.map((tag) => (
            <TechTag key={tag} className={styles.cardTag}>
              {tag}
            </TechTag>
          ))}
        </div>
        <span className={styles.link}>查看详情 →</span>
      </div>
    </Link>
  )
}

export default ProjectCard
