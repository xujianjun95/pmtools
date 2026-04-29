import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import styles from './MainLayout.module.css'

function MainLayout() {
  const location = useLocation()

  useEffect(() => {
    // 复刻旧版 `show()` 中“重置 animation 以重新播放”的效果
    // 避免只在首次挂载时淡入的问题（例如 /project/:id 参数切换）。
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
  }, [location.pathname, location.search, location.hash])

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
