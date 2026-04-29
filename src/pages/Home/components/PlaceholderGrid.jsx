import styles from '../Home.module.css'

function PlaceholderGrid() {
  return (
    <div className={`${styles.placeholderGrid} ${styles.placeholderGridSingle} fi d5`}>
      <div className={styles.placeholderCard}>
        <span className={styles.phNum}>03</span>
        <h3 className={styles.phTitle}>即将推出</h3>
        <p className={styles.phDesc}>下一个项目正在酝酿中</p>
      </div>
    </div>
  )
}

export default PlaceholderGrid
