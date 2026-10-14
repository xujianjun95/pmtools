import styles from './Footer.module.css'

function Footer({ compact = false }) {
  return (
    <footer className={compact ? `${styles.footer} ${styles.compact}` : styles.footer}>
      <div className={styles.inner}>
        {!compact && <span className={styles.copy}>2026 PMTOOLS</span>}
        <a
          className={styles.filing}
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
        >
          京ICP备2026019538号-1
        </a>
        {!compact && <span className={styles.note}>Crafted with care</span>}
      </div>
    </footer>
  )
}

export default Footer
