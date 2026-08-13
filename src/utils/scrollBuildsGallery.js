/** 首页「构建」锚点区块 id，与 ProjectsGrid section 同步 */
export const BUILDS_SECTION_ID = 'builds-section'

/** 旧书签 `#builds-section`：Home 首次进入后会 replace 去掉，勿用于新跳转 */
export const BUILDS_SECTION_HASH = `#${BUILDS_SECTION_ID}`

/** 用 React Router `location.state` 触发滚动，避免 URL 带 # */
export const scrollToBuildsNavState = Object.freeze({ scrollToBuilds: true })

const PROJECT_ANCHOR_PREFIX = 'build-project-'

export function getProjectAnchorId(projectId) {
  const normalizedId = typeof projectId === 'string' ? projectId.trim() : ''
  return normalizedId ? `${PROJECT_ANCHOR_PREFIX}${normalizedId}` : null
}

export function createScrollToProjectNavState(projectId) {
  const normalizedId = typeof projectId === 'string' ? projectId.trim() : ''
  return normalizedId
    ? { scrollToProjectId: normalizedId }
    : scrollToBuildsNavState
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** 纵向滚到构建区（尊重 scroll-margin-top，避让固定顶栏） */
export function scrollToBuildsGallery({ behavior } = {}) {
  const scrollBehavior = behavior || (prefersReducedMotion() ? 'auto' : 'smooth')
  document.getElementById(BUILDS_SECTION_ID)?.scrollIntoView({
    behavior: scrollBehavior,
    block: 'start',
  })
}

/** 返回首页时优先定位来源产品；目标不存在时由调用方回退到构建区 */
export function scrollToProjectCard(projectId, { behavior } = {}) {
  const anchorId = getProjectAnchorId(projectId)
  const projectCard = anchorId ? document.getElementById(anchorId) : null
  if (!projectCard) return false

  const scrollBehavior = behavior || (prefersReducedMotion() ? 'auto' : 'smooth')
  projectCard.scrollIntoView({
    behavior: scrollBehavior,
    block: 'start',
  })
  return true
}
