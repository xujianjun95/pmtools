import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BUILDS_SECTION_HASH } from '../../utils/scrollBuildsGallery'
import Header from './Header'
import Footer from './Footer'
import styles from './MainLayout.module.css'

function MainLayout() {
  const location = useLocation()

  useEffect(() => {
    // 复刻旧版 `show()` 中“重置 animation 以重新播放”的效果
    // 避免只在首次挂载时淡入的问题（例如 /project/:id 参数切换）。

    // pathname 切换时回到顶部；首页且将滚到构建区时不设顶（hash 仅兼容旧书签；新逻辑用 location.state.scrollToBuilds）
    const skipTop =
      location.pathname === '/' &&
      (Boolean(location.state?.scrollToBuilds) || location.hash === BUILDS_SECTION_HASH)
    if (typeof window !== 'undefined' && !skipTop) {
      window.scrollTo(0, 0)
    }

    const fiEls = document.querySelectorAll('.fi')
    fiEls.forEach((el) => {
      // eslint-disable-next-line no-param-reassign
      el.style.animation = 'none'
      // 强制 reflow，确保动画能重新触发
      // eslint-disable-next-line no-unused-expressions
      el.offsetHeight
      // eslint-disable-next-line no-param-reassign
      el.style.animation = ''
    })
    // 注意： deps 仅用 pathname/search。hash 去掉或清空 state 时不重复跑本 effect，否则会 scrollTo(0,0) 顶掉构建区滚动。
  }, [location.pathname, location.search])

  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default MainLayout
