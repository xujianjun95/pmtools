import ProjectMockup from '../../../components/mockups/ProjectMockup'

import styles from '../ProjectDetail.module.css'

function DetailHero({ project }) {
  return (
    <section className={styles.detailHero}>
      <div className={styles.detailHeroInner}>
        <div className={styles.detailHeroText}>
          <span className="section-label fi d1">Project</span>
          <h1 className={`${styles.detailName} fi d2`}>{project.title}</h1>
          <p className={`${styles.detailTagline} fi d3`}>{project.tagline}</p>
          <p className={`${styles.detailDesc} fi d4`}>{project.detailDescription}</p>
          <div className={`${styles.heroActions} fi d5`}>
            <a
              href={project.links.project}
              className={`${styles.dlBtn} ${styles.primary}`}
              target="_blank"
              rel="noreferrer"
            >
              {project.ctaLabel ?? '前往 Chrome 商店安装'}{' '}
              <span className={styles.linkArrow}>↗</span>
            </a>
          </div>
          {project.id === 'yessir' && (
            <div className={`${styles.sciNote} fi d5`}>前往 Google Chrome 商店需科学上网</div>
          )}
        </div>

        <div className={`${styles.detailHeroVisual} fi d6`}>
          <div className={styles.detailVisualMockup}>
            <ProjectMockup type={project.mockupType} />
          </div>
        </div>
      </div>
    </section>
  )
}

export default DetailHero
