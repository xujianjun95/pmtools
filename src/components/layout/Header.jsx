import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { scrollToBuildsGallery, scrollToBuildsNavState } from '../../utils/scrollBuildsGallery'
import ThemeToggle from '../common/ThemeToggle'

const NEWS_SECTION_ID = 'news-section'
const scrollToNewsNavState = Object.freeze({ scrollToNews: true })

function scrollToNewsSection() {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(NEWS_SECTION_ID)?.scrollIntoView({
    behavior: reduced ? 'auto' : 'smooth',
    block: 'start',
  })
}
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
  /** 首页点「造物」或「资讯」后把指示线挪到对应链接下；点 Logo 或进作者页会清掉 */
  const [activeNav, setActiveNav] = useState(null) // 'builds' | 'news' | null
  const navRef = useRef(null)
  const buildsLinkRef = useRef(null)
  const newsLinkRef = useRef(null)
  const aboutLinkRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const timer = window.setInterval(() => setLocalTime(formatHeaderTime()), 1000 * 30)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (location.pathname !== '/profile') return
    const id = window.requestAnimationFrame(() => setActiveNav(null))
    return () => window.cancelAnimationFrame(id)
  }, [location.pathname])

  // 接收从 HomePage 传来的滚动状态，自动高亮对应导航
  useEffect(() => {
    if (location.pathname !== '/') return
    if (location.state?.scrollToBuilds) setActiveNav('builds')
    if (location.state?.scrollToNews) setActiveNav('news')
  }, [location.pathname, location.state])

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const nav = navRef.current
      if (!nav) return

      let targetEl = null
      if (location.pathname === '/profile') {
        targetEl = aboutLinkRef.current
      } else if (location.pathname === '/') {
        if (activeNav === 'builds') targetEl = buildsLinkRef.current
        if (activeNav === 'news') targetEl = newsLinkRef.current
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
  }, [location.pathname, activeNav])

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const handleLogoClick = (e) => {
    setActiveNav(null)
    if (location.pathname !== '/') return
    e.preventDefault()
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }

  const handleBuildsClick = (e) => {
    e.preventDefault()
    setActiveNav('builds')
    if (location.pathname !== '/') {
      navigate('/', { state: scrollToBuildsNavState })
      return
    }
    scrollToBuildsGallery()
  }

  const handleNewsClick = (e) => {
    e.preventDefault()
    setActiveNav('news')
    if (location.pathname !== '/') {
      navigate('/', { state: scrollToNewsNavState })
      return
    }
    scrollToNewsSection()
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
                造物
              </Link>
              <Link
                ref={newsLinkRef}
                to="/"
                className={styles.navLink}
                onClick={handleNewsClick}
              >
                资讯
              </Link>
              <NavLink
                ref={aboutLinkRef}
                to="/profile"
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.active : ''}`
                }
                onClick={() => setActiveNav(null)}
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
