/** 页面锚点定位工具 */

/** 字体加载完成前布局可能重排（文字尺寸变化），此时启动平滑滚动易被打断 */
const FONT_WAIT_TIMEOUT_MS = 2500

function waitForStableLayout() {
  const fontsReady =
    typeof document !== 'undefined' ? document.fonts?.ready : null
  if (!fontsReady) return Promise.resolve()

  const timeout = new Promise((resolve) =>
    window.setTimeout(resolve, FONT_WAIT_TIMEOUT_MS)
  )
  return Promise.race([fontsReady, timeout])
}

/**
 * 定位到指定 id 元素。
 *
 * 注意：全局 CSS `html { scroll-behavior: smooth }` 会覆盖 scrollIntoView 的
 * `behavior: 'auto'`，让"立即定位"实际变成平滑滚动动画。behavior 为 'auto'
 * 时，临时用内联样式禁用平滑，确保瞬间到位。
 *
 * behavior 为 'smooth' 时，先等字体加载稳定（布局重排会打断平滑动画），
 * 再启动平滑滚动，兼顾视觉体验与可靠性。
 */
export function scrollToSection(id, behavior = 'auto') {
  if (typeof document === 'undefined') return false
  const target = document.getElementById(id)
  if (!target) return false

  if (behavior === 'auto') {
    const html = document.documentElement
    const previousBehavior = html.style.scrollBehavior
    html.style.scrollBehavior = 'auto'
    target.scrollIntoView({ behavior: 'auto', block: 'start' })
    html.style.scrollBehavior = previousBehavior
    return true
  }

  waitForStableLayout().then(() => {
    document.getElementById(id)?.scrollIntoView({ behavior, block: 'start' })
  })
  return true
}