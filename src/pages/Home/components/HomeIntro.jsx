import styles from '../Home.module.css'

function HomeIntro() {
  return (
    <section className={styles.homeIntro}>
      <span className="section-label fi">Portfolio</span>
      <h1 className="section-title fi d1">作品集</h1>
      <p className={`fi d2 ${styles.homeIntroDesc}`}>
        独立开发的工具类产品，从需求到上线，全流程独立完成。
      </p>
    </section>
  )
}

export default HomeIntro
