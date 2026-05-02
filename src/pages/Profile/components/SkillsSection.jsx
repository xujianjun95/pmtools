import styles from '../Profile.module.css'

function SkillsSection() {
  return (
    <section className={styles.profileSection}>
      <span className="section-label fi d4">Skills</span>
      <h2 className="section-title fi d5">技能</h2>

      <div className={`${styles.skillGroup} fi d6`}>
        <h3 className={styles.skillGroupTitle}>DISCOVERY</h3>
        <div className={styles.skillTags}>
          <span className={styles.skillTag}>G 端/B 端</span>
          <span className={styles.skillTag}>业务逻辑梳理</span>
          <span className={styles.skillTag}>竞品分析</span>
          <span className={styles.skillTag}>产品原型设计</span>
          <span className={styles.skillTag}>...</span>
        </div>
      </div>

      <div className={`${styles.skillGroup} fi d7`}>
        <h3 className={styles.skillGroupTitle}>CRAFTING</h3>
        <div className={styles.skillTags}>
          <span className={styles.skillTag}>Figma</span>
          <span className={styles.skillTag}>Axure</span>
          <span className={styles.skillTag}>墨刀</span>
          <span className={styles.skillTag}>...</span>
        </div>
      </div>

      <div className={`${styles.skillGroup} fi d8`}>
        <h3 className={styles.skillGroupTitle}>BUILDING</h3>
        <div className={styles.skillTags}>
          <span className={styles.skillTag}>Vibecoding</span>
          <span className={styles.skillTag}>Prompt Engineering</span>
          <span className={styles.skillTag}>前端框架应用</span>
          <span className={styles.skillTag}>...</span>
        </div>
      </div>
    </section>
  )
}

export default SkillsSection
