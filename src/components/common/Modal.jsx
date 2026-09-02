import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import styles from './Modal.module.css'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

function Modal({ open, onClose, title, children }) {
  const backdropRef = useRef(null)
  const modalRef = useRef(null)
  /** 打开前的焦点元素，关闭后归还焦点 */
  const previousFocusRef = useRef(null)
  /** 用 ref 保存最新 onClose：避免父组件每次渲染生成新回调引用，
   *  导致 useEffect 反复重跑、把焦点抢回第一个可聚焦元素（关闭按钮） */
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return undefined

    previousFocusRef.current = document.activeElement
    // 焦点移入对话框（优先关闭按钮，保证有可落点）
    const modalEl = modalRef.current
    const firstFocusable =
      modalEl?.querySelector(FOCUSABLE_SELECTOR) || modalEl
    firstFocusable?.focus()

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      // 简易 focus trap：Tab 在对话框内循环
      if (e.key !== 'Tab' || !modalEl) return
      const focusables = Array.from(
        modalEl.querySelectorAll(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null)
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
      // 焦点还给触发元素
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus()
      }
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className={styles.backdrop}
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose()
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={modalRef}
        tabIndex={-1}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <button className={styles.close} onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body
  )
}

export default Modal
