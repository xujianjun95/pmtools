import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BUILDS_SECTION_HASH,
  scrollToBuildsGallery,
  scrollToProjectCard,
} from '../../utils/scrollBuildsGallery'
import { scrollToSection } from '../../utils/scrollToSection'

const NEWS_SECTION_ID = 'news-section'

/**
 * 整页加载（首次进入或刷新）时的 history key。
 * 刷新后 React Router 会从 history.state 恢复 key，SPA 内导航则生成新 key，
 * 因此用「挂载时的 key === 整页加载时的 key」判断是否应播放首屏动画。
 */
const INITIAL_LOCATION_KEY =
  typeof window !== 'undefined' && window.history?.state?.key
    ? window.history.state.key
    : 'default'

function scrollToNewsSection({ behavior } = {}) {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  scrollToSection(NEWS_SECTION_ID, behavior || (reduced ? 'auto' : 'smooth'))
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

    // 开发模式始终重播首屏动画，便于反复调试；生产构建才走「只播一次」
    if (import.meta.env.DEV) return true

    // 整页加载（含刷新）时播放首屏动画；SPA 内导航回首页不重复播
    return location.key === INITIAL_LOCATION_KEY
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
        scrollToNewsSection()
      } else if (
        fromProjectId &&
        scrollToProjectCard(fromProjectId)
      ) {
        // 已定位到来源产品卡片。
      } else {
        scrollToBuildsGallery()
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
