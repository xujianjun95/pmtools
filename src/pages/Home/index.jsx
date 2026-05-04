import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BUILDS_SECTION_HASH,
  scrollToBuildsGallery,
} from '../../utils/scrollBuildsGallery'

const NEWS_SECTION_ID = 'news-section'

function scrollToNewsSection() {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(NEWS_SECTION_ID)?.scrollIntoView({
    behavior: reduced ? 'auto' : 'smooth',
    block: 'start',
  })
}
import HomeIntro from './components/HomeIntro'
import ProjectsGrid from './components/ProjectsGrid'
import NewsFeed from './components/NewsFeed'

function HomePage() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.pathname !== '/') return undefined

    const fromHash = location.hash === BUILDS_SECTION_HASH
    const fromBuilds = Boolean(location.state?.scrollToBuilds)
    const fromNews = Boolean(location.state?.scrollToNews)
    if (!fromHash && !fromBuilds && !fromNews) return undefined

    const id = window.setTimeout(() => {
      if (fromNews) {
        scrollToNewsSection()
      } else {
        scrollToBuildsGallery()
      }
      navigate(
        { pathname: '/', search: location.search },
        { replace: true, state: {} }
      )
    }, 0)

    return () => window.clearTimeout(id)
  }, [
    location.pathname,
    location.hash,
    location.search,
    location.state?.scrollToBuilds,
    location.state?.scrollToNews,
    navigate,
  ])

  return (
    <>
      <HomeIntro />
      <ProjectsGrid />
      <NewsFeed />
    </>
  )
}

export default HomePage
