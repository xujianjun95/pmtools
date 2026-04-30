import { Link, useParams } from 'react-router-dom'
import { getProjectById } from '../../data/projects'
import { scrollToBuildsNavState } from '../../utils/scrollBuildsGallery'
import styles from './ProjectDetail.module.css'
import DetailHero from './components/DetailHero'
import FeaturesSection from './components/FeaturesSection'
import OriginSection from './components/OriginSection'
import ChangelogSection from './components/ChangelogSection'
import TechStackSection from './components/TechStackSection'
import YesSirPrivacySection from './components/YesSirPrivacySection'

function DetailTopBar({ currentTitle, withEnterAnimation }) {
  const wrapClass = withEnterAnimation ? `${styles.topNav} fi` : styles.topNav

  return (
    <div className={wrapClass}>
      <nav className={styles.breadcrumb} aria-label="页面位置">
        <ol className={styles.breadcrumbList}>
          <li className={styles.breadcrumbItem}>
            <Link to="/" className={styles.breadcrumbLink}>
              首页
            </Link>
          </li>
          <li className={styles.breadcrumbSep} aria-hidden="true">
            /
          </li>
          <li className={styles.breadcrumbItem}>
            <Link to="/" state={scrollToBuildsNavState} className={styles.breadcrumbLink}>
              构建
            </Link>
          </li>
          <li className={styles.breadcrumbSep} aria-hidden="true">
            /
          </li>
          <li className={styles.breadcrumbItem}>
            <span className={styles.breadcrumbCurrent} aria-current="page">
              {currentTitle}
            </span>
          </li>
        </ol>
      </nav>
      <Link to="/" className={styles.backLink}>
        <span className={styles.backArrow}>←</span> 返回
      </Link>
    </div>
  )
}

function ProjectDetailPage() {
  const { id } = useParams()
  const project = getProjectById(id)

  if (!project) {
    return (
      <section className={styles.page}>
        <DetailTopBar currentTitle="未找到项目" withEnterAnimation={false} />
        <span className="section-label">Project</span>
        <h1 className="section-title">未找到项目</h1>
        <p className={styles.detailDesc}>项目 `{id}` 不存在。</p>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <DetailTopBar currentTitle={project.title} withEnterAnimation />
      <DetailHero project={project} />
      <OriginSection project={project} />
      <FeaturesSection project={project} />
      <ChangelogSection project={project} />
      <TechStackSection project={project} />
      <YesSirPrivacySection project={project} />
    </section>
  )
}

export default ProjectDetailPage
