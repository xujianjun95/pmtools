/** 页面锚点定位工具 */

/**
 * 定位到指定 id 元素。
 *
 * 注意：全局 CSS `html { scroll-behavior: smooth }` 会覆盖 scrollIntoView 的
 * `behavior: 'auto'`，让"立即定位"实际变成平滑滚动动画——页面布局尚未稳定时
 * （字体/图片/数据加载导致重排）动画易被打断，表现为锚点失效（停在页面顶部）。
 * 因此 behavior 为 'auto' 时，临时用内联样式禁用平滑，确保瞬间到位。
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

  target.scrollIntoView({ behavior, block: 'start' })
  return true
}