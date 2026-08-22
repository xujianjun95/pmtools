import { FIELD_LABELS, fmtChangeVal } from '../utils'
import styles from './RecentChanges.module.css'

export default function RecentChanges({ changes }) {
  if (!changes.length) return null

  return (
    <section className={`section fi d5`}>
      <span className="section-label">Recent Changes</span>
      <h2 className="section-title">最近变更</h2>
      <div className={styles.changeList}>
        {changes.map((c, i) => (
          <div key={`${c.code}-${c.field}-${i}`} className={styles.changeItem}>
            <span className={styles.cdate}>{c.date}</span>
            <span className={styles.cname}>{c.name}</span>
            <span className={styles.ccode}>{c.code}</span>
            <span>{FIELD_LABELS[c.field] || c.field}</span>
            <span className={styles.old}>{fmtChangeVal(c.field, c.old_val)}</span>
            <span className={styles.arrow}>→</span>
            <span className={styles.new}>{fmtChangeVal(c.field, c.new_val)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
