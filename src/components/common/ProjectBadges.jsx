import styles from './ProjectBadges.module.css'

function ProjectBadges({
  featuredBadge,
  badge,
  purchaseUrl,
  purchaseLabel = '点击购买',
  className = '',
}) {
  if (!featuredBadge && !badge && !purchaseUrl) return null

  const wrapClass = `${styles.badges}${className ? ` ${className}` : ''}`

  return (
    <div className={wrapClass}>
      {featuredBadge && (
        <span className={`${styles.badge} ${styles.featuredBadge}`}>
          ✦ {featuredBadge}
        </span>
      )}
      {badge && <span className={styles.badge}>⭐ {badge}</span>}
      {purchaseUrl && (
        <a
          href={purchaseUrl}
          className={styles.purchaseButton}
          target="_blank"
          rel="noreferrer"
        >
          {purchaseLabel} <span aria-hidden="true">↗</span>
        </a>
      )}
    </div>
  )
}

export default ProjectBadges
