import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BUILDS_SECTION_HASH,
  scrollToBuildsGallery,
} from '../../utils/scrollBuildsGallery'
import HomeIntro from './components/HomeIntro'
import ProjectsGrid from './components/ProjectsGrid'
import NewsFeed from './components/NewsFeed'

function HomePage() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.pathname !== '/') return undefined

    const fromHash = location.hash === BUILDS_SECTION_HASH
    const fromState = Boolean(location.state?.scrollToBuilds)
    if (!fromHash && !fromState) return undefined

    const id = window.setTimeout(() => {
      scrollToBuildsGallery()
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
