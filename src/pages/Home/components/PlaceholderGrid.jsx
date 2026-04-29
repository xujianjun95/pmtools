import styles from '../Home.module.css'

function PlaceholderGrid() {
  return (
    <div className={`${styles.placeholderGrid} fi d5`}>
      <div className={styles.placeholderCard}>
        <span className={styles.phNum}>03</span>
        <h3 className={styles.phTitle}>即将推出</h3>
        <p className={styles.phDesc}>下一个项目正在酝酿中</p>
      </div>
      <div className={styles.placeholderCard}>
        <span className={styles.phNum}>04</span>
        <h3 className={styles.phTitle}>即将推出</h3>
        <p className={styles.phDesc}>更多创意正在路上</p>
      </div>
    </div>
  )
}

export default PlaceholderGrid
