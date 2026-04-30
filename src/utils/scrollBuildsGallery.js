/** 首页「构建」锚点区块 id，与 ProjectsGrid section 同步 */
export const BUILDS_SECTION_ID = 'builds-section'

/** 旧书签 `#builds-section`：Home 首次进入后会 replace 去掉，勿用于新跳转 */
export const BUILDS_SECTION_HASH = `#${BUILDS_SECTION_ID}`

/** 用 React Router `location.state` 触发滚动，避免 URL 带 # */
export const scrollToBuildsNavState = Object.freeze({ scrollToBuilds: true })

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** 纵向滚到构建区（尊重 scroll-margin-top，避让固定顶栏） */
export function scrollToBuildsGallery() {
  const reduced = prefersReducedMotion()
  document.getElementById(BUILDS_SECTION_ID)?.scrollIntoView({
    behavior: reduced ? 'auto' : 'smooth',
    block: 'start',
  })
}
