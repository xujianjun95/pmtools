import { useState } from 'react'
import { FIELD_LABELS, fmtChangeVal } from '../utils'
import styles from './RecentChanges.module.css'

const COLLAPSED_COUNT = 5

export default function RecentChanges({ changes }) {
  const [expanded, setExpanded] = useState(false)
  if (!changes.length) return null

  const shown = expanded ? changes : changes.slice(0, COLLAPSED_COUNT)
  const hiddenCount = changes.length - COLLAPSED_COUNT

  return (
    <section className={`section fi d6`}>
      <span className="section-label">Recent Changes</span>
      <div className={styles.titleRow}>
        <h2 className="section-title">最近变更</h2>
        {changes.length > COLLAPSED_COUNT && (
          <button
            type="button"
            className={styles.toggleBtn}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '收起 ▴' : `展开全部（剩余 ${hiddenCount} 条）▾`}
          </button>
        )}
      </div>
      <div className={styles.changeList}>
        {shown.map((c, i) => (
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
