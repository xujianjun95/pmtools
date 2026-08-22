import styles from './FilterBar.module.css'

export default function FilterBar({
  indexOptions,
  statusOptions,
  indexKey,
  status,
  onIndexChange,
  onStatusChange,
  trailing,
}) {
  return (
    <div className={styles.filters}>
      <div className={styles.filterGroup}>
        <span className={styles.glabel}>跟踪指数</span>
        {indexOptions.map((opt) => (
          <button
            key={opt.key}
            className={`${styles.pill} ${indexKey === opt.key ? styles.active : ''}`}
            onClick={() => onIndexChange(opt.key)}
          >
            {opt.label}
            <span className={styles.count}>{opt.count}</span>
          </button>
        ))}
      </div>
      <div className={styles.filterGroup}>
        <span className={styles.glabel}>状态</span>
        {statusOptions.map((opt) => (
          <button
            key={opt.key}
            className={`${styles.pill} ${status === opt.key ? styles.active : ''}`}
            onClick={() => onStatusChange(opt.key)}
          >
            {opt.label}
            <span className={styles.count}>{opt.count}</span>
          </button>
        ))}
      </div>
      {trailing}
    </div>
  )
}
