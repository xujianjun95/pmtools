import useTheme from '../../hooks/useTheme'
import styles from './ThemeToggle.module.css'

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      className={styles.textToggle}
      onClick={toggleTheme}
      aria-label="切换主题"
      aria-pressed={isDark}
    >
      <div className={styles.textTrack}>
        <div className={styles.textThumb} />
        <span className={`${styles.textItem} ${!isDark ? styles.textActive : ''}`}>light</span>
        <span className={`${styles.textItem} ${isDark ? styles.textActive : ''}`}>dark</span>
      </div>
    </button>
  )
}

export default ThemeToggle
