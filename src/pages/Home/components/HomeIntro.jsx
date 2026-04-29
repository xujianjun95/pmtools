import styles from '../Home.module.css'

function HomeIntro() {
  return (
    <section className={styles.homeIntro}>
      <span className="section-label fi">Portfolio</span>
      <h1 className="section-title fi d1">实验室</h1>
      <p className={`fi d2 ${styles.homeIntroDesc}`}>
        探索、构建并交付那些能解决问题的工具。
      </p>
    </section>
  )
}

export default HomeIntro
