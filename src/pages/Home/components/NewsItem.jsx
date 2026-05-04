import { useState } from 'react'
import styles from './NewsItem.module.css'

function NewsItem({ item, index }) {
  const [expanded, setExpanded] = useState(false)
  const num = String(index + 1).padStart(2, '0')

  return (
    <article
      className={styles.item}
      onClick={() => setExpanded((v) => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setExpanded((v) => !v)
        }
      }}
    >
      <span className={styles.num}>{num}</span>
      <div className={styles.body}>
        <h4 className={styles.title}>{item.title}</h4>
        <div className={styles.summaryRow}>
          <p className={styles.summary}>「{item.summary}」</p>
          <div className={styles.meta}>
            <span className={styles.source}>{item.source}</span>
            <span className={styles.sep} />
            <time className={styles.date}>
              {new Date(item.publishedAt).toLocaleDateString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
              })}
            </time>
          </div>
        </div>
        <div className={`${styles.expanded} ${expanded ? styles.expandedOpen : ''}`}>
          <a
            className={styles.link}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            阅读原文 →
          </a>
        </div>
      </div>
    </article>
  )
}

export default NewsItem
