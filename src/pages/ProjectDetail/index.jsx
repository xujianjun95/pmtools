import { Link, useParams } from 'react-router-dom'
import { getProjectById } from '../../data/projects'
import styles from './ProjectDetail.module.css'
import DetailHero from './components/DetailHero'
import FeaturesSection from './components/FeaturesSection'
import TechStackSection from './components/TechStackSection'
import DetailLinks from './components/DetailLinks'

function ProjectDetailPage() {
  const { id } = useParams()
  const project = getProjectById(id)

  if (!project) {
    return (
      <section className={styles.page}>
        <Link to="/" className={styles.backLink}>
          <span className={styles.backArrow}>←</span> 返回项目列表
        </Link>
        <span className="section-label">Project</span>
        <h1 className="section-title">未找到项目</h1>
        <p className={styles.detailDesc}>项目 `{id}` 不存在。</p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <Link to="/" className={`${styles.backLink} fi`}>
        <span className={styles.backArrow}>←</span> 返回项目列表
      </Link>
      <DetailHero project={project} />
      <FeaturesSection project={project} />
      <TechStackSection project={project} />
      <DetailLinks project={project} />
    </section>
  )
}

export default ProjectDetailPage
