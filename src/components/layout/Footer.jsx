import styles from './Footer.module.css'

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.copy}>© 2026 Pmtools</span>
        <span className={styles.note}>Crafted with care</span>
      </div>
    </footer>
  )
}

export default Footer
