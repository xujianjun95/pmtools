import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BUILDS_SECTION_HASH,
  scrollToBuildsGallery,
} from '../../utils/scrollBuildsGallery'

const NEWS_SECTION_ID = 'news-section'

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
  const skipEntranceAnimation = useRef(
    location.hash === BUILDS_SECTION_HASH ||
      Boolean(location.state?.scrollToBuilds) ||
      Boolean(location.state?.scrollToNews)
  ).current
  const [isHeroComplete, setIsHeroComplete] = useState(skipEntranceAnimation)
  const handleHeroComplete = useCallback(() => setIsHeroComplete(true), [])

  useHomeScrollAnimations(homeRef, isHeroComplete, skipEntranceAnimation)

  useEffect(() => {
    if (location.pathname !== '/') return undefined

    const fromHash = location.hash === BUILDS_SECTION_HASH
    const fromBuilds = Boolean(location.state?.scrollToBuilds)
    const fromNews = Boolean(location.state?.scrollToNews)
    if (!fromHash && !fromBuilds && !fromNews) return undefined

    let cancelled = false
    const scrollAfterLayout = () => {
      if (cancelled) return

      if (fromNews) {
        scrollToNewsSection({ behavior: 'auto' })
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
    location.state?.scrollToNews,
    navigate,
  ])

  return (
    <div ref={homeRef} className={styles.homePage}>
      <HomeIntro onComplete={handleHeroComplete} />
      <ProjectsGrid />
      <NewsFeed
        isHeroComplete={isHeroComplete}
        skipEntranceAnimation={skipEntranceAnimation}
      />
    </div>
  )
}

export default HomePage
