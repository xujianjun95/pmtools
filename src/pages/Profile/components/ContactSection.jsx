import styles from '../Profile.module.css'

function ContactSection() {
  return (
    <section className={styles.profileSection}>
      <span className="section-label fi">Contact</span>
      <h2 className="section-title fi d1">联系方式</h2>

      <div className={`${styles.contactList} fi d2`}>
        <div className={styles.contactItem}>
          <span className={styles.contactLabel}>Email</span>
          <span className={styles.contactValue}>
            <a href="mailto:hello@pmtools.com.cn">hello@pmtools.com.cn</a>
          </span>
        </div>

        <div className={styles.contactItem}>
          <span className={styles.contactLabel}>GitHub</span>
          <span className={styles.contactValue}>
            <a href="#">github.com/yourname</a>
          </span>
        </div>

        <div className={styles.contactItem}>
          <span className={styles.contactLabel}>Website</span>
          <span className={styles.contactValue}>
            <a href="#">pmtools.com.cn</a>
          </span>
        </div>
      </div>
    </section>
  )
}

export default ContactSection
