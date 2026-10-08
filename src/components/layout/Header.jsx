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
  dashboard: '0 0 1024 1024',
  articles: '0.9231 1.0947 22.1538 22.1538',
  about: '0.9231 0.9231 22.1538 22.1538',
}

const NAV_ICON_PATHS = {
  dashboard: ['M1023.968793 512.0972c0-282.258242-228.984556-511.073966-511.452563-511.073966-282.473122 0-511.462795 228.815722-511.462795 511.073966 0 260.737573 195.390741 475.854231 447.837044 507.156 14.231147 2.999101 31.564741 4.746785 52.209522 4.746785 5.795601 0 11.384509-0.304924 16.78207-0.857471C797.877943 1020.265179 1023.968793 792.575015 1023.968793 512.0972zM950.836169 519.328399c-1.471411-25.500029-4.8399-50.460814-9.969375-74.718637 0.455339-8.661681 0.579151-16.868022 0.346877-24.49726 6.343032 29.660502 9.687986 60.432236 9.687986 91.984698C950.902679 514.513057 950.875051 516.921751 950.836169 519.328399zM74.120572 512.0972c0-30.977405 3.225236-61.200685 9.345202-90.360825 18.931886 20.247766 63.554125 19.769915 74.436224-10.483039 19.471131 11.604504 45.637286 13.717484 45.637286 36.912165 0 76.550227 2.725897 158.618759 72.279247 159.886547 1.958471 0.025581 38.788778 13.957944 56.316786 59.416164 6.060619 15.711767 30.032959 0 56.321902 0 13.124008 0 0 22.110053 0 69.921714 0 47.626454 102.680569 120.959633 102.680569 120.959633-0.475804 31.525858 0.818588 57.017702 3.442161 77.38314-23.177287-0.426689-42.709813 2.645062-58.055262 7.868674C230.627375 907.644909 74.120572 728.142955 74.120572 512.0972zM620.440877 936.783561c-2.272604-11.126653-12.215375-17.220015-30.356301-12.451742 14.474677-61.640676 21.511461-96.169728 51.728602-122.387045 43.719746-37.898564 5.206218-80.04355-28.063232-75.076769-26.222433 3.958895-9.651149-32.467234-33.055594-34.481983-23.404445-1.958471-53.969486-48.511552-87.653346-64.530291-17.855443-8.479545-35.402894-31.203539-62.940184-32.221658-24.407215-0.946492-60.07615 20.637618-60.07615 3.999824 0-53.590889-5.426213-91.832236-6.541539-107.104012-0.900446-12.269607-8.020113-4.132845 24.974087-3.339838 17.956744 0.48092 9.185577-36.067997 26.959162-37.495409 17.456382-1.381367 59.052916 16.341056 69.650557 9.277668 9.845564-6.577352 72.371338 164.12683 72.371338 28.216717 0-16.126177-8.351641-44.163828 0-59.436629 33.030013-60.352424 63.952163-109.539311 61.175104-116.734697-1.575781-4.050986-33.792323-7.39594-59.569649 1.253462-8.699541 2.904963 2.766826 16.530355-9.727892 19.440434-46.814006 10.807404-88.175196-12.622623-73.691309-34.645701 14.831785-22.570509 68.571044-9.845564 73.282016-55.124718 2.710549-25.935927 4.956549-55.974003 6.45968-78.298935 63.004648 9.852726 56.069163-81.7677-37.613081-91.574381 189.525561 2.217349 350.128371 124.61565 409.062591 294.48692-2.980683-2.718734-6.448425-4.371258-10.453365-4.774413-28.324157-70.749511-97.074267-19.547874-73.752703 42.855112-124.959457 96.057172-92.973143 163.052434-51.9179 201.416569 21.603552 20.166931 42.200242 50.496628 55.610754 72.279247-14.596442 42.561444 53.781211 25.518448 87.503954-46.709636C890.911457 782.384621 771.249286 898.633281 620.440877 936.783561z'],
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
        <path key={index} d={path} vectorEffect="non-scaling-stroke" fill={kind === 'dashboard' ? 'currentColor' : undefined} stroke={kind === 'dashboard' ? 'none' : undefined} />
      ))}
    </svg>
  )
}

function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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
    location.pathname === '/qdii/dashboard' ? 'dashboard' :
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
      } else if (location.pathname === '/qdii/dashboard') {
        targetEl = dashboardLinkRef.current
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
              <Link
                ref={qdiiLinkRef}
                to="/qdii"
                className={styles.navLink}
                data-active={currentNav === 'qdii'}
                aria-current={location.pathname === '/qdii' ? 'page' : undefined}
                onClick={() => setActiveNav(null)}
              >
                <NavIcon kind="qdii" />
                QDII 监控
              </Link>
              <Link
                ref={dashboardLinkRef}
                to="/qdii/dashboard"
                className={styles.navLink}
                data-active={currentNav === 'dashboard'}
                aria-current={currentNav === 'dashboard' ? 'page' : undefined}
                onClick={() => setActiveNav(null)}
              >
                <NavIcon kind="dashboard" />
                全球行情
              </Link>
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
          <Link to="/qdii/dashboard" data-active={currentNav === 'dashboard'} aria-current={currentNav === 'dashboard' ? 'page' : undefined}><NavIcon kind="dashboard" />全球行情</Link>
          <Link to="/articles" data-active={currentNav === 'articles'} aria-current={location.pathname === '/articles' ? 'page' : undefined}><NavIcon kind="articles" />文章</Link>
          <Link to="/about" data-active={currentNav === 'about'} aria-current={location.pathname === '/about' ? 'page' : undefined}><NavIcon kind="about" />关于我</Link>
        </nav>
        <div className={styles.mobileTheme}><span>外观</span><ThemeToggle /></div>
      </div>
    </header>
  )
}

export default Header
