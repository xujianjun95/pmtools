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
      <div className={styles.icons}>
        <span className={`${styles.icon} ${styles.sun}`}>☀</span>
        <span className={`${styles.icon} ${styles.moon}`}>☾</span>
      </div>
      <div className={styles.dot} />
    </button>
  )
}

export default ThemeToggle
