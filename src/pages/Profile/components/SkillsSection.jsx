import styles from '../Profile.module.css'

function SkillsSection() {
  return (
    <section className={styles.profileSection}>
      <span className="section-label fi d4">Skills</span>
      <h2 className="section-title fi d5">技能</h2>

      <div className={`${styles.skillGroup} fi d6`}>
        <h3 className={styles.skillGroupTitle}>Frontend</h3>
        <div className={styles.skillTags}>
          <span className={styles.skillTag}>React</span>
          <span className={styles.skillTag}>JavaScript</span>
          <span className={styles.skillTag}>HTML</span>
          <span className={styles.skillTag}>CSS</span>
          <span className={styles.skillTag}>Vite</span>
        </div>
      </div>

      <div className={`${styles.skillGroup} fi d7`}>
        <h3 className={styles.skillGroupTitle}>Extension</h3>
        <div className={styles.skillTags}>
          <span className={styles.skillTag}>Chrome Extension API</span>
          <span className={styles.skillTag}>Manifest V3</span>
        </div>
      </div>

      <div className={`${styles.skillGroup} fi d8`}>
        <h3 className={styles.skillGroupTitle}>Design &amp; Tools</h3>
        <div className={styles.skillTags}>
          <span className={styles.skillTag}>产品设计</span>
          <span className={styles.skillTag}>UI / UX</span>
          <span className={styles.skillTag}>Figma</span>
          <span className={styles.skillTag}>Git</span>
        </div>
      </div>
    </section>
  )
}

export default SkillsSection
