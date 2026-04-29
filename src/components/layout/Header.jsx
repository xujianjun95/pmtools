import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import ThemeToggle from '../common/ThemeToggle'
import styles from './Header.module.css'

function Header() {
  const [localTime, setLocalTime] = useState('')
  const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false })
  const navRef = useRef(null)
  const location = useLocation()

  useEffect(() => {
    const formatTime = () =>
      new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date())

    setLocalTime(formatTime())
    const timer = window.setInterval(() => setLocalTime(formatTime()), 1000 * 30)
    return () => window.clearInterval(timer)
  }, [])

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const nav = navRef.current
      if (!nav) return

      const activeLink = nav.querySelector(`.${styles.active}`)
      if (!activeLink) {
        setIndicator((prev) =>
          prev.visible ? { ...prev, visible: false } : prev
        )
        return
      }

      setIndicator({
        left: activeLink.offsetLeft,
        width: activeLink.offsetWidth,
        visible: true,
      })
    }

    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [location.pathname])

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <NavLink to="/" className={styles.logo}>
          Pmtools
        </NavLink>
        <nav
          ref={navRef}
          className={styles.nav}
          style={{
            '--indicator-left': `${indicator.left}px`,
            '--indicator-width': `${indicator.width}px`,
            '--indicator-opacity': indicator.visible ? 1 : 0,
          }}
        >
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.active : ''}`
            }
          >
            构建
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.active : ''}`
            }
          >
            关于
          </NavLink>
        </nav>
      </div>
      <div className={styles.right}>
        <div className={styles.statusBar}>
          <span className={styles.statusItem}>
            <span className={styles.statusDot} aria-hidden="true" />
            System Online
          </span>
          <span className={styles.statusDivider}>//</span>
          <span className={styles.statusItem}>Local Time: {localTime}</span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}

export default Header
