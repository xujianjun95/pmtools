import { useCallback, useState } from 'react'
import styles from '../Profile.module.css'

function ContactSection() {
  const [toast, setToast] = useState(false)

  const copyWechat = useCallback(() => {
    navigator.clipboard.writeText('Nikola_Xu')
    setToast(true)
    setTimeout(() => setToast(false), 2000)
  }, [])

  return (
    <section className={styles.profileSection}>
      <span className="section-label fi">Contact</span>
      <h2 className="section-title fi d1">联系方式</h2>

      <div className={`${styles.contactList} fi d2`}>
        <div className={styles.contactItem}>
          <span className={styles.contactLabel}>Email</span>
          <span className={styles.contactValue}>
            <a href="mailto:xujianjun1995@gmail.com">xujianjun1995@gmail.com</a>
          </span>
        </div>

        <div className={styles.contactItem}>
          <span className={styles.contactLabel}>GitHub</span>
          <span className={styles.contactValue}>
            <a href="https://github.com/xujianjun95">github.com/xujianjun95</a>
          </span>
        </div>

        <div className={styles.contactItem}>
          <span className={styles.contactLabel}>Website</span>
          <span className={styles.contactValue}>
            <a href="#">pmtools.com.cn</a>
          </span>
        </div>

        <div className={styles.contactItem}>
          <span className={styles.contactLabel}>WeChat</span>
          <span className={styles.contactValue}>
            <span className={styles.wechatWrap}>
              <a href="#" onClick={(e) => { e.preventDefault(); copyWechat() }}>Nikola_Xu</a>
              {toast && <span className={styles.toast}>已复制微信号</span>}
            </span>
          </span>
        </div>
      </div>
    </section>
  )
}

export default ContactSection
