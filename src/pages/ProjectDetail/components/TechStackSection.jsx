import TechTag from '../../../components/common/TechTag'
import styles from '../ProjectDetail.module.css'

function TechStackSection({ project }) {
  return (
    <section className={styles.detailTech}>
      <span className="section-label fi">Tech Stack</span>
      <h2 className="section-title fi d1">技术栈</h2>
      <div className={`${styles.techTags} fi d2`}>
        {project.techStack.map((tech) => (
          <TechTag key={tech} className={styles.techTag}>
            {tech}
          </TechTag>
        ))}
      </div>
    </section>
  )
}

export default TechStackSection
