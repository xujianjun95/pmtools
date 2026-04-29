import styles from '../ProjectDetail.module.css'

function FeaturesSection({ project }) {
  return (
    <section className={styles.detailFeatures}>
      <span className="section-label fi">Features</span>
      <h2 className="section-title fi d1">核心功能</h2>
      <div className={styles.featGrid}>
        {project.features.map((feature, index) => (
          <div key={feature.title} className={`${styles.featCard} fi d${index + 2}`}>
            <span className={styles.featNum}>{String(index + 1).padStart(2, '0')}</span>
            <h3 className={styles.featTitle}>{feature.title}</h3>
            <p className={styles.featDesc}>{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default FeaturesSection
