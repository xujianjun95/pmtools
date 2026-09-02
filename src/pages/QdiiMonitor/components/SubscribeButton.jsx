import { useEffect, useState } from 'react'
import Modal from '../../../components/common/Modal'
import styles from './SubscribeButton.module.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const STORAGE_KEY = 'qdii-sub-email'

export default function SubscribeButton() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle') // idle | submitting | success | error
  const [message, setMessage] = useState('')
  const [subscribedEmail, setSubscribedEmail] = useState(null)

  // 打开弹窗时：若有本地订阅记录，查询后端确认订阅状态并提示
  useEffect(() => {
    if (!open) return
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    fetch(`/api/status?email=${encodeURIComponent(saved)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.subscribed) {
          setSubscribedEmail(saved)
          setEmail(saved)
        }
      })
      .catch(() => {
        /* 网络异常时静默，不打扰输入 */
      })
  }, [open])

  const reset = () => {
    setEmail('')
    setState('idle')
    setMessage('')
    setSubscribedEmail(null)
  }

  const close = () => {
    setOpen(false)
    // 关闭后短暂延迟重置，避免下次打开闪现旧状态
    setTimeout(reset, 300)
  }

  const submit = async (e) => {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!EMAIL_RE.test(value)) {
      setState('error')
      setMessage('请输入有效的邮箱地址')
      return
    }
    setState('submitting')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      })
      const json = await res.json().catch(() => ({ message: '服务暂不可用' }))
      if (res.ok && json.ok) {
        localStorage.setItem(STORAGE_KEY, value)
        setSubscribedEmail(value)
        setState('success')
        setMessage(json.message || '订阅成功')
      } else {
        setState('error')
        setMessage(json.message || '订阅失败，请稍后再试')
      }
    } catch (err) {
      setState('error')
      setMessage('无法连接通知服务，请稍后再试')
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.subscribeBtn}
        onClick={() => {
          setOpen(true)
        }}
      >
        订阅通知
        <span className={styles.btnDot} aria-hidden="true" />
      </button>

      <Modal open={open} onClose={close} title="QDII 额度变动订阅">
        <div className={styles.body}>
          {subscribedEmail && state === 'idle' ? (
            <div className={`${styles.feedback} ${styles.successBox}`} role="status">
              <div className={styles.successIcon} aria-hidden="true">✓</div>
              <p>
                <strong>{subscribedEmail}</strong> 已在订阅列表中，额度变动时会邮件通知您。
              </p>
              <button className={styles.doneBtn} onClick={close}>
                好的
              </button>
            </div>
          ) : (
            <>
              <p className={styles.desc}>
                当监控基金出现<strong>申购状态 / 单日累计购买上限</strong>变动时，
                我们会第一时间通过邮件通知您。无变动不打扰。
              </p>

              {state === 'success' ? (
                <div className={`${styles.feedback} ${styles.successBox}`} role="status">
                  <div className={styles.successIcon} aria-hidden="true">✓</div>
                  <p>{message}</p>
                  <button className={styles.doneBtn} onClick={close}>
                    好的
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} noValidate>
                  <label className={styles.label} htmlFor="sub-email">
                    接收通知的邮箱
                  </label>
                  <div className={styles.inputRow}>
                    <input
                      id="sub-email"
                      className={styles.input}
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) =>
                        // 仅允许英文/数字/符号（ASCII 可打印字符），过滤中文、全角、空格、emoji 等
                        setEmail(e.target.value.replace(/[^\x21-\x7E]/g, ''))
                      }
                      disabled={state === 'submitting'}
                      autoComplete="email"
                    />
                    <button
                      type="submit"
                      className={styles.submitBtn}
                      disabled={state === 'submitting'}
                    >
                      {state === 'submitting' ? '提交中…' : '订阅'}
                    </button>
                  </div>
                  {state === 'error' && (
                    <p className={`${styles.feedback} ${styles.errorBox}`} role="alert">
                      {message}
                    </p>
                  )}
                </form>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  )
}
