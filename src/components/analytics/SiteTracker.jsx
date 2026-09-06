import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { createSiteSession, trackEvent } from '../../utils/analytics.js'

/**
 * 全站埋点挂载点（数据看板数据源，spec §6）：
 * - 页面进入/离开/心跳：createSiteSession 按路由路径上报 page_view / page_leave
 * - 外链跳转：capture 监听 click/auxclick 记录 outbound_click，不拦截、不改变
 *   中键/Cmd+点击/新窗口等原生行为
 *
 * 只在 MainLayout 内渲染：/background 后台路由天然不产生任何埋点。
 */
export default function SiteTracker() {
  const location = useLocation()
  const sessionRef = useRef(null)

  useEffect(() => {
    const session = createSiteSession()
    sessionRef.current = session

    const isOutbound = (a) =>
      Boolean(a?.href) && /^https?:/.test(a.href) && a.origin !== window.location.origin
    const onClick = (event) => {
      const anchor = event.target?.closest?.('a')
      if (isOutbound(anchor)) {
        trackEvent('outbound_click', { url: anchor.href.slice(0, 200) })
      }
    }
    document.addEventListener('click', onClick, true)
    document.addEventListener('auxclick', onClick, true)

    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('auxclick', onClick, true)
      session.dispose()
      sessionRef.current = null
    }
  }, [])

  useEffect(() => {
    sessionRef.current?.trackPath(location.pathname)
  }, [location.pathname])

  return null
}
