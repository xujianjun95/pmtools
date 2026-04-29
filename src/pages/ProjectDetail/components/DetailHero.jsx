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
