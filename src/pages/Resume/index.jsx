import styles from './Resume.module.css'

function ResumePage() {
  return (
    <section className={styles.page}>
      <span className="section-label">Resume</span>
      <h1 className="section-title">在线简历</h1>
      <p className={styles.desc}>预留页面，后续将由 `src/data/resume.js` 数据驱动渲染。</p>
    </section>
  )
}

export default ResumePage
