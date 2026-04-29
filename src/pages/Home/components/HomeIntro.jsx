import styles from '../Home.module.css'

function HomeIntro() {
  return (
    <section className={styles.homeIntro}>
      <div className={styles.homeIntroBlock}>
        <span className="section-label fi">Builds</span>
        <h1 className="section-title fi d1">构建</h1>
        <p className={`fi d2 ${styles.homeIntroDescEn}`}>
          Why suffer poor design when you can build the standard?
        </p>
        <p className={`fi d3 ${styles.homeIntroDescZh}`}>
          与其忍受糟糕的体验，不如自己动手重塑标准。
        </p>
      </div>
    </section>
  )
}

export default HomeIntro
