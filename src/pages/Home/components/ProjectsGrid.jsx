import { projects } from '../../../data/projects'
import ProjectCard from '../../../components/common/ProjectCard'
import styles from '../Home.module.css'

function ProjectsGrid() {
  return (
    <div className={styles.projectsGrid}>
      {projects.map((project, index) => (
        <ProjectCard
          key={project.id}
          project={project}
          delayClassName={`fi d${index + 3}`}
        />
      ))}
    </div>
  )
}

export default ProjectsGrid
