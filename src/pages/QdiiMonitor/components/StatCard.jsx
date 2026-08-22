import styles from './StatCard.module.css'

export default function StatCard({ num, label, dotClass = 'all' }) {
  return (
    <div className={styles.stat}>
      <div className={styles.num}>{num}</div>
      <div className={styles.lbl}>
        <span className={`${styles.dot} ${styles[dotClass] || ''}`} />
        {label}
      </div>
    </div>
  )
}
