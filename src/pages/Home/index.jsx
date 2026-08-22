import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BUILDS_SECTION_HASH,
  scrollToBuildsGallery,
  scrollToProjectCard,
} from '../../utils/scrollBuildsGallery'

const NEWS_SECTION_ID = 'news-section'
const HOME_HERO_SEEN_KEY = 'pmtools:home-hero-seen'

function scrollToNewsSection({ behavior } = {}) {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(NEWS_SECTION_ID)?.scrollIntoView({
    behavior: behavior || (reduced ? 'auto' : 'smooth'),
    block: 'start',
  })
}
import HomeIntro from './components/HomeIntro'
import ProjectsGrid from './components/ProjectsGrid'
import NewsFeed from './components/NewsFeed'
import styles from './Home.module.css'
import { useHomeScrollAnimations } from './useHomeScrollAnimations'

function HomePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const homeRef = useRef(null)
  const [playEntranceAnimation] = useState(() => {
    const hasScrollTarget =
      location.hash === BUILDS_SECTION_HASH ||
      Boolean(location.state?.scrollToBuilds) ||
      Boolean(location.state?.scrollToProjectId) ||
      Boolean(location.state?.scrollToNews)

    if (hasScrollTarget || typeof window === 'undefined') return false

    try {
      // ?hero 强制重播首屏动画，便于开发时反复验证
      if (window.location.search.includes('hero')) return true

      const hasSeenHero =
        window.sessionStorage.getItem(HOME_HERO_SEEN_KEY) === 'true'
      const isInitialPageEntry = location.key === 'default'

      window.sessionStorage.setItem(HOME_HERO_SEEN_KEY, 'true')
      return isInitialPageEntry && !hasSeenHero
    } catch {
      return location.key === 'default'
    }
  })
  const skipEntranceAnimation = !playEntranceAnimation
  const [isHeroComplete, setIsHeroComplete] = useState(skipEntranceAnimation)
  const handleHeroComplete = useCallback(() => setIsHeroComplete(true), [])

  useHomeScrollAnimations(homeRef, isHeroComplete, skipEntranceAnimation)

  useEffect(() => {
    if (location.pathname !== '/') return undefined

    const fromHash = location.hash === BUILDS_SECTION_HASH
    const fromBuilds = Boolean(location.state?.scrollToBuilds)
    const fromProjectId = location.state?.scrollToProjectId
    const fromNews = Boolean(location.state?.scrollToNews)
    if (!fromHash && !fromBuilds && !fromProjectId && !fromNews) return undefined

    let cancelled = false
    const scrollAfterLayout = () => {
      if (cancelled) return

      if (fromNews) {
        scrollToNewsSection({ behavior: 'auto' })
      } else if (
        fromProjectId &&
        scrollToProjectCard(fromProjectId, { behavior: 'auto' })
      ) {
        // 已定位到来源产品卡片。
      } else {
        scrollToBuildsGallery({ behavior: 'auto' })
      }
      navigate(
        { pathname: '/', search: location.search },
        { replace: true, state: {} }
      )
    }

    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollAfterLayout)
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(firstFrame)
    }
  }, [
    location.pathname,
    location.hash,
    location.search,
    location.state?.scrollToBuilds,
    location.state?.scrollToProjectId,
    location.state?.scrollToNews,
    navigate,
  ])

  return (
    <div ref={homeRef} className={styles.homePage}>
      <HomeIntro
        shouldAnimate={playEntranceAnimation}
        onComplete={handleHeroComplete}
      />
      <ProjectsGrid />
      <NewsFeed
        isHeroComplete={isHeroComplete}
        skipEntranceAnimation={skipEntranceAnimation}
      />
    </div>
  )
}

export default HomePage
