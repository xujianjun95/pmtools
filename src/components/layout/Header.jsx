import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { scrollToBuildsGallery, scrollToBuildsNavState } from '../../utils/scrollBuildsGallery'
import ThemeToggle from '../common/ThemeToggle'
import styles from './Header.module.css'

function formatHeaderTime() {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
}

function Header() {
  const [localTime, setLocalTime] = useState(() => formatHeaderTime())
  const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false })
  /** 首页点「构建」后把指示线挪到该链接下；点 Logo 或进作者页会清掉 */
  const [buildsNavUnderline, setBuildsNavUnderline] = useState(false)
  const navRef = useRef(null)
  const buildsLinkRef = useRef(null)
  const aboutLinkRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const timer = window.setInterval(() => setLocalTime(formatHeaderTime()), 1000 * 30)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (location.pathname !== '/profile') return
    const id = window.requestAnimationFrame(() => setBuildsNavUnderline(false))
    return () => window.cancelAnimationFrame(id)
  }, [location.pathname])

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const nav = navRef.current
      if (!nav) return

      let targetEl = null
      if (location.pathname === '/profile') {
        targetEl = aboutLinkRef.current
      } else if (location.pathname === '/' && buildsNavUnderline) {
        targetEl = buildsLinkRef.current
      }

      if (!targetEl) {
        setIndicator((prev) =>
          prev.visible ? { ...prev, visible: false } : prev
        )
        return
      }

      setIndicator({
        left: targetEl.offsetLeft,
        width: targetEl.offsetWidth,
        visible: true,
      })
    }

    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [location.pathname, buildsNavUnderline])

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const handleLogoClick = (e) => {
    setBuildsNavUnderline(false)
    if (location.pathname !== '/') return
    e.preventDefault()
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }

  const handleBuildsClick = (e) => {
    e.preventDefault()
    setBuildsNavUnderline(true)
    if (location.pathname !== '/') {
      navigate('/', { state: scrollToBuildsNavState })
      return
    }
    scrollToBuildsGallery()
  }

  return (
    <header className={styles.shell}>
      <div className={styles.bar}>
        <div className={styles.barInner}>
          <div className={styles.left}>
            <Link to="/" className={styles.logo} onClick={handleLogoClick}>
              Pmtools
            </Link>
            <nav
              ref={navRef}
              className={styles.nav}
              style={{
                '--indicator-left': `${indicator.left}px`,
                '--indicator-width': `${indicator.width}px`,
                '--indicator-opacity': indicator.visible ? 1 : 0,
              }}
            >
              <Link
                ref={buildsLinkRef}
                to="/"
                className={styles.navLink}
                onClick={handleBuildsClick}
              >
                构建
              </Link>
              <NavLink
                ref={aboutLinkRef}
                to="/profile"
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.active : ''}`
                }
                onClick={() => setBuildsNavUnderline(false)}
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
        </div>
      </div>
    </header>
  )
}

export default Header
