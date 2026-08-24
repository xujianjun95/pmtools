/** 页面锚点定位工具 */

/** 字体加载完成前布局可能重排（文字尺寸变化），此时启动平滑滚动易被打断 */
const FONT_WAIT_TIMEOUT_MS = 2500

/** 平滑滚动启动延迟：避开数据加载后 ScrollTrigger.refresh() 对滚动动画的打断 */
const SMOOTH_START_DELAY_MS = 400

/** 滚动动画完成后校验位置的等待时间（动画时长约 500-700ms） */
const SMOOTH_SETTLE_CHECK_MS = 900

/** 位置偏差容差（px），超过则视为滚动被打断，需要补滚 */
const SMOOTH_POSITION_TOLERANCE = 160

/** 补滚最大次数 */
const SMOOTH_MAX_RETRIES = 3

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
 * 平滑滚动：延迟启动避开页面初始化（数据加载、ScrollTrigger.refresh）
 * 对滚动动画的打断；滚动结束后校验位置，偏差过大则补滚兜底。
 */
function scheduleSmoothScroll(
  id,
  retriesLeft = SMOOTH_MAX_RETRIES,
  delay = SMOOTH_START_DELAY_MS
) {
  window.setTimeout(() => {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })

    window.setTimeout(() => {
      const el = document.getElementById(id)
      if (!el) return
      const offset = Math.abs(el.getBoundingClientRect().top)
      if (offset > SMOOTH_POSITION_TOLERANCE && retriesLeft > 0) {
        scheduleSmoothScroll(id, retriesLeft - 1, 500)
      }
    }, SMOOTH_SETTLE_CHECK_MS)
  }, delay)
}

/**
 * 定位到指定 id 元素。
 *
 * 注意：全局 CSS `html { scroll-behavior: smooth }` 会覆盖 scrollIntoView 的
 * `behavior: 'auto'`，让"立即定位"实际变成平滑滚动动画。behavior 为 'auto'
 * 时，临时用内联样式禁用平滑，确保瞬间到位。
 *
 * behavior 为 'smooth' 时，先等字体加载稳定，再延迟启动平滑滚动并在
 * 被打断时自动补滚，兼顾视觉体验与可靠性。
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
    scheduleSmoothScroll(id)
  })
  return true
}