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
          <div className={`${styles.detailStats} fi d5`}>
            {project.stats.map((item) => (
              <div key={`${item.value}-${item.label}`} className={styles.detailStat}>
                <span className={styles.detailStatVal}>{item.value}</span>
                <span className={styles.detailStatLbl}>{item.label}</span>
              </div>
            ))}
          </div>
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
