import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { scrollToBuildsGallery, scrollToBuildsNavState } from '../../utils/scrollBuildsGallery'
import { scrollToSection } from '../../utils/scrollToSection'
import ThemeToggle from '../common/ThemeToggle'

const NEWS_SECTION_ID = 'news-section'
const scrollToNewsNavState = Object.freeze({ scrollToNews: true })

function scrollToNewsSection() {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  scrollToSection(NEWS_SECTION_ID, reduced ? 'auto' : 'smooth')
}

import styles from './Header.module.css'

const ICON_FILL_OPACITY = 0.18

// 各轮廓的最长边统一为 13px，在 16px 图标框内保持相同的视觉占比。
const NAV_ICON_VIEW_BOXES = {
  builds: '-0.2558 -0.1008 24.2215 24.2215',
  news: '31.1277 27.1867 961.7415 961.7415',
  qdii: '0.5546 0.1846 23.6308 23.6308',
  articles: '0.9231 1.0947 22.1538 22.1538',
  about: '0.9231 0.9231 22.1538 22.1538',
}

const NAV_ICON_PATHS = {
  builds: [
    'M12.82 2.44 L19.66 6.4 Q20.62 6.95 20.62 8.04 V15.96 Q20.62 17 19.66 17.63 L12.82 21.58 Q11.88 22.12 10.95 21.58 L4.08 17.63 Q3.09 17.06 3.09 15.96 V8.04 Q3.09 6.94 4.08 6.4 L10.95 2.44 Q11.88 1.9 12.82 2.44 Z',
    'M6.92 9.4 L11.84 12.18 L16.8 9.4',
    'M11.84 12.18 V17.68',
  ],
  news: [
    // 将提供的填充式 SVG 转成中心线描边，保留原有外框和内容比例。
    'M170.159 145.265 H852.287 Q902.706 145.265 902.706 195.656 V820.431 Q902.706 870.85 852.287 870.85 H171.711 Q121.291 870.85 121.291 820.431 V194.131 Q121.291 145.265 170.159 145.265 Z',
    'M232.921 312.654 H791.05',
    'M250.686 480.129 H437.871 Q456.183 480.129 456.183 498.455 V685.093 Q456.183 703.404 437.871 703.404 H251.233 Q232.921 703.404 232.921 685.093 V497.885 Q232.921 480.129 250.686 480.129 Z',
    'M623.74 478.712 H791.051',
    'M623.74 646.679 H791.051',
  ],
  qdii: [
    'M2.77 6.46 V21.23 H21.23',
    'M2.77 15.86 L7 12 L10.91 13.74 L12.85 7.09 L21.23 2.77',
  ],
  articles: [
    'M12 6 C9 4 6 4 3 5 L3 19 C6 18 9 18 12 20 C15 18 18 18 21 19 L21 5 C18 4 15 4 12 6 Z',
    'M12 6 L12 20',
    'M6 9 Q8 8.5 9.5 9.5',
    'M14.5 9.5 Q16 8.5 18 9',
    'M6 13 Q8 12.5 9.5 13.5',
    'M14.5 13.5 Q16 12.5 18 13',
  ],
  about: [
    'M12 11 C14.2 11 16 9.2 16 7 C16 4.8 14.2 3 12 3 C9.8 3 8 4.8 8 7 C8 9.2 9.8 11 12 11 Z',
    'M5 21 L5 19 C5 15.5 8 14 12 14 C16 14 19 15.5 19 19 L19 21',
  ],
}

function NavIcon({ kind }) {
  const paths = NAV_ICON_PATHS[kind]
  if (!paths) return null

  return (
    <svg
      className={styles.navIcon}
      viewBox={NAV_ICON_VIEW_BOXES[kind] ?? '0 0 24 24'}
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'qdii' && (
        <path
          data-icon-fill=""
          d="M2.77 15.86 L7 12 L10.91 13.74 L12.85 7.09 L21.97 2.77 V21.23 H2.77 Z"
          fill="currentColor"
          stroke="none"
          opacity={ICON_FILL_OPACITY}
        />
      )}
      {paths.map((path, index) => (
        <path key={index} d={path} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}

function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [qdiiMenuOpen, setQdiiMenuOpen] = useState(false)
  const dashboardLinkRef = useRef(null)
  const mobileMenuRef = useRef(null)
  const mobileToggleRef = useRef(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false })
  /** 首页点「造物」或「资讯」后把指示线挪到对应链接下；点 Logo 会清掉 */
  const [activeNav, setActiveNav] = useState(null) // 'builds' | 'news' | null
  const navRef = useRef(null)
  const buildsLinkRef = useRef(null)
  const newsLinkRef = useRef(null)
  const articlesLinkRef = useRef(null)
  const aboutLinkRef = useRef(null)
  const qdiiLinkRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const currentNav =
    location.pathname === '/qdii' || location.pathname.startsWith('/qdii/') ? 'qdii' :
    location.pathname === '/articles' ? 'articles' :
    location.pathname === '/about' ? 'about' :
    location.pathname === '/' ? activeNav : null

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
      if (location.pathname === '/about') {
        targetEl = aboutLinkRef.current
      } else if (location.pathname === '/articles') {
        targetEl = articlesLinkRef.current
      } else if (location.pathname === '/qdii' || location.pathname.startsWith('/qdii/')) {
        targetEl = qdiiLinkRef.current
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
        left: targetEl.getBoundingClientRect().left - nav.getBoundingClientRect().left,
        width: targetEl.offsetWidth,
        visible: true,
      })
    }

    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [location.pathname, activeNav])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const handlePointerDown = (event) => {
      if (!mobileMenuRef.current?.contains(event.target) && !mobileToggleRef.current?.contains(event.target)) {
        setMobileMenuOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
        mobileToggleRef.current?.focus()
      }
    }
    const breakpoint = window.matchMedia('(max-width: 768px)')
    const handleBreakpoint = () => {
      if (!breakpoint.matches) setMobileMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    breakpoint.addEventListener('change', handleBreakpoint)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      breakpoint.removeEventListener('change', handleBreakpoint)
    }
  }, [mobileMenuOpen])

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const handleLogoClick = (e) => {
    setMobileMenuOpen(false)
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
                data-active={currentNav === 'builds'}
                aria-current={currentNav === 'builds' ? 'location' : undefined}
                onClick={handleBuildsClick}
              >
                <NavIcon kind="builds" />
                造物
              </Link>
              <Link
                ref={newsLinkRef}
                to="/"
                className={styles.navLink}
                data-active={currentNav === 'news'}
                aria-current={currentNav === 'news' ? 'location' : undefined}
                onClick={handleNewsClick}
              >
                <NavIcon kind="news" />
                资讯
              </Link>
              <div
                className={styles.navGroup}
                onMouseEnter={() => setQdiiMenuOpen(true)}
                onMouseLeave={() => setQdiiMenuOpen(false)}
                onFocus={() => setQdiiMenuOpen(true)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setQdiiMenuOpen(false)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    qdiiLinkRef.current?.focus()
                    setQdiiMenuOpen(false)
                  } else if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setQdiiMenuOpen(true)
                    window.requestAnimationFrame(() => dashboardLinkRef.current?.focus())
                  }
                }}
              >
                <Link
                  ref={qdiiLinkRef}
                  to="/qdii"
                  className={styles.navLink}
                  data-active={currentNav === 'qdii'}
                  aria-current={location.pathname === '/qdii' ? 'page' : undefined}
                  onClick={() => { setActiveNav(null); setQdiiMenuOpen(false) }}
                >
                  <NavIcon kind="qdii" />
                  QDII 监控
                </Link>
                <button
                  type="button"
                  className={styles.submenuToggle}
                  aria-label="展开 QDII 子菜单"
                  aria-expanded={qdiiMenuOpen}
                  aria-controls="qdii-site-submenu"
                  onClick={() => setQdiiMenuOpen((open) => !open)}
                >
                  <span className={styles.submenuChevron} aria-hidden="true" />
                </button>
                <div id="qdii-site-submenu" className={styles.submenu} hidden={!qdiiMenuOpen}>
                  <Link
                    ref={dashboardLinkRef}
                    to="/qdii/dashboard"
                    aria-current={location.pathname === '/qdii/dashboard' ? 'page' : undefined}
                    onClick={() => { setActiveNav(null); setQdiiMenuOpen(false) }}
                  >
                    市场看板
                  </Link>
                </div>
              </div>
              <Link
                ref={articlesLinkRef}
                to="/articles"
                className={styles.navLink}
                data-active={currentNav === 'articles'}
                aria-current={location.pathname === '/articles' ? 'page' : undefined}
                onClick={() => setActiveNav(null)}
              >
                <NavIcon kind="articles" />
                文章
              </Link>
              <Link
                ref={aboutLinkRef}
                to="/about"
                className={styles.navLink}
                data-active={currentNav === 'about'}
                aria-current={location.pathname === '/about' ? 'page' : undefined}
                onClick={() => setActiveNav(null)}
              >
                <NavIcon kind="about" />
                关于我
              </Link>
            </nav>
          </div>
          <button
            ref={mobileToggleRef}
            type="button"
            className={styles.mobileToggle}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-site-nav"
            aria-label={mobileMenuOpen ? '关闭网站导航' : '打开网站导航'}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <span className={styles.menuIcon} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
          <div className={styles.right}>
            <ThemeToggle />
          </div>
        </div>
      </div>
      <div
        ref={mobileMenuRef}
        id="mobile-site-nav"
        className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.mobileMenuOpen : ''}`}
        aria-hidden={!mobileMenuOpen}
        inert={!mobileMenuOpen}
      >
        <nav aria-label="手机网站导航" onClick={(event) => {
          if (event.target.closest('a')) setMobileMenuOpen(false)
        }}>
          <Link to="/" data-active={currentNav === 'builds'} aria-current={currentNav === 'builds' ? 'location' : undefined} onClick={handleBuildsClick}><NavIcon kind="builds" />造物</Link>
          <Link to="/" data-active={currentNav === 'news'} aria-current={currentNav === 'news' ? 'location' : undefined} onClick={handleNewsClick}><NavIcon kind="news" />资讯</Link>
          <Link to="/qdii" data-active={currentNav === 'qdii'} aria-current={location.pathname === '/qdii' ? 'page' : undefined}><NavIcon kind="qdii" />QDII 监控</Link>
          <Link to="/qdii/dashboard" className={styles.mobileSubmenuLink} aria-current={location.pathname === '/qdii/dashboard' ? 'page' : undefined}>市场看板</Link>
          <Link to="/articles" data-active={currentNav === 'articles'} aria-current={location.pathname === '/articles' ? 'page' : undefined}><NavIcon kind="articles" />文章</Link>
          <Link to="/about" data-active={currentNav === 'about'} aria-current={location.pathname === '/about' ? 'page' : undefined}><NavIcon kind="about" />关于我</Link>
        </nav>
        <div className={styles.mobileTheme}><span>外观</span><ThemeToggle /></div>
      </div>
    </header>
  )
}

export default Header
