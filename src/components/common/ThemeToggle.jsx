import useTheme from '../../hooks/useTheme'
import styles from './ThemeToggle.module.css'

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label="切换主题"
      aria-pressed={isDark}
    >
      <div className={styles.track}>
        <span className={styles.trackSun}>☀</span>
        <span className={styles.trackMoon}>☾</span>
        <div className={styles.thumb}>
          <span className={styles.thumbIcon}>{isDark ? '☾' : '☀'}</span>
        </div>
      </div>
    </button>
  )
}

export default ThemeToggle
