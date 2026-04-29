import styles from './Mockups.module.css'

function MockupYesSir() {
  return (
    <div className={styles.mockYessir}>
      <div className={styles.bar}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <div className={styles.url} />
      </div>
      <div className={styles.body}>
        <div className={styles.brand}>YesSir</div>
        <div className={styles.search}>
          <span className={styles.searchIcon}>⌕</span>
          <span className={styles.searchText}>搜索标题、URL 或域名...</span>
        </div>
        <div className={styles.tabs}>
          <span className={`${styles.tab} ${styles.tabOn}`}>全部</span>
          <span className={styles.tab}>标签页</span>
          <span className={styles.tab}>AI</span>
        </div>
        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardIcon} />
            <div className={styles.cardLines}>
              <div className={styles.cardLine} style={{ width: '78%' }} />
              <div className={styles.cardLine} style={{ width: '48%' }} />
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardIcon} />
            <div className={styles.cardLines}>
              <div className={styles.cardLine} style={{ width: '62%' }} />
              <div className={styles.cardLine} style={{ width: '38%' }} />
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardIcon} />
            <div className={styles.cardLines}>
              <div className={styles.cardLine} style={{ width: '70%' }} />
              <div className={styles.cardLine} style={{ width: '52%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MockupYesSir
