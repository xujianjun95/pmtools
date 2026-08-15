import { useEffect, useRef } from 'react'
import styles from './CustomCursor.module.css'

/** 可交互元素判定：hover 到这些元素上时箭头切换为圆点 */
const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], input, textarea, select, label, summary, [data-cursor="pointer"]'

/**
 * 全局自定义光标：
 * - 平时显示黑色三角箭头（遮盖系统光标，所有页面统一）
 * - hover 可交互元素时箭头收起，切换为主题色（--accent）半透明圆点
 * - 仅在有精确指针（鼠标/触控板）的设备上启用，触屏设备保持原样
 */
export default function CustomCursor() {
  const cursorRef = useRef(null)

  useEffect(() => {
    // 触屏等无精确指针的设备不启用
    if (!window.matchMedia('(pointer: fine)').matches) return undefined

    const el = cursorRef.current
    if (!el) return undefined

    const root = document.documentElement
    root.classList.add('has-custom-cursor')

    let shown = false
    const show = () => {
      if (!shown) {
        el.style.opacity = '1'
        shown = true
      }
    }
    const hide = () => {
      el.style.opacity = '0'
      shown = false
    }

    const onMove = (e) => {
      el.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`
      el.classList.toggle(
        styles.hover,
        e.target instanceof Element && !!e.target.closest(INTERACTIVE_SELECTOR),
      )
      show()
    }
    // 光标移出窗口 / 窗口失焦时复位，避免圆点卡住
    const onLeave = () => {
      hide()
      el.classList.remove(styles.hover)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('blur', onLeave)
    root.addEventListener('mouseleave', onLeave)

    return () => {
      root.classList.remove('has-custom-cursor')
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('blur', onLeave)
      root.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <div ref={cursorRef} className={styles.cursor} aria-hidden="true">
      <svg
        className={styles.arrow}
        width="28"
        height="28"
        viewBox="0 0 28 28"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3 2 L25 12.5 L14.8 14.8 L11 25.5 Z"
          fill="#16130f"
          stroke="rgba(255, 255, 255, 0.85)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <span className={styles.dot} />
    </div>
  )
}
