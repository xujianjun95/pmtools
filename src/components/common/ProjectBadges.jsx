import styles from './ProjectBadges.module.css'

function ProjectBadges({ featuredBadge, badge, className = '' }) {
  if (!featuredBadge && !badge) return null

  const wrapClass = `${styles.badges}${className ? ` ${className}` : ''}`

  return (
    <div className={wrapClass}>
      {featuredBadge && (
        <span className={`${styles.badge} ${styles.featuredBadge}`}>
          ✦ {featuredBadge}
        </span>
      )}
      {badge && <span className={styles.badge}>⭐ {badge}</span>}
    </div>
  )
}

export default ProjectBadges
