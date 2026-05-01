import styles from '../ProjectDetail.module.css'

function UseCasesSection({ project }) {
  if (!project.useCases?.length) return null

  return (
    <section className={styles.detailUseCases}>
      <span className="section-label fi">Use Cases</span>
      <h2 className="section-title fi d1">适用人群</h2>
      <div className={styles.useCaseGrid}>
        {project.useCases.map((item, index) => (
          <div key={item.role} className={`${styles.useCaseCard} fi d${index + 2}`}>
            <span className={styles.useCaseScenario}>{item.scenario}</span>
            <h3 className={styles.useCaseRole}>
              <span className={styles.useCaseIcon} aria-hidden="true">{item.icon}</span>
              {item.role}
            </h3>
            <p className={styles.useCaseDesc}>{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default UseCasesSection
