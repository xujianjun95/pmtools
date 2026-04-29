import styles from '../Home.module.css'

function PlaceholderGrid() {
  return (
    <div className={`${styles.placeholderGrid} ${styles.placeholderGridSingle} fi d5`}>
      <div className={styles.placeholderCard}>
        <span className={styles.phNum}>03</span>
        <h3 className={styles.phTitle}>
          Next<span className={styles.cursor}>_</span>
        </h3>
        <p className={styles.phDesc}>保持观察，让直觉自然落地。</p>
      </div>
    </div>
  )
}

export default PlaceholderGrid
