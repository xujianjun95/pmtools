import { useEffect, useRef, useState } from 'react'
import Modal from '../../../components/common/Modal'
import styles from './SubscribeButton.module.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const CODE_RESEND_SECONDS = 60
const CODE_LENGTH = 6

export default function SubscribeButton() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''))
  const [state, setState] = useState('idle') // idle | sending | submitting | success | error
  const [message, setMessage] = useState('')
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef(null)
  const cellRefs = useRef([])

  useEffect(() => {
    return () => clearInterval(timerRef.current)
  }, [])

  const reset = () => {
    setEmail('')
    setDigits(Array(CODE_LENGTH).fill(''))
    setState('idle')
    setMessage('')
    setCountdown(0)
    clearInterval(timerRef.current)
  }

  const close = () => {
    setOpen(false)
    // 关闭后短暂延迟重置，避免下次打开闪现旧状态
    setTimeout(reset, 300)
  }

  const handleCellChange = (i, raw) => {
    const clean = String(raw).replace(/\D/g, '')
    const next = [...digits]
    if (!clean) {
      if (digits[i]) {
        next[i] = ''
        setDigits(next)
      }
      return
    }
    if (clean.length === 1) {
      next[i] = clean
      setDigits(next)
      if (i < CODE_LENGTH - 1) cellRefs.current[i + 1]?.focus()
      return
    }
    // 粘贴多字符：从当前格开始逐个分配
    let idx = i
    for (const ch of clean) {
      if (idx < CODE_LENGTH) {
        next[idx] = ch
        idx += 1
      }
    }
    setDigits(next)
    cellRefs.current[Math.min(idx, CODE_LENGTH - 1)]?.focus()
  }

  const handleCellKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault()
      cellRefs.current[i - 1]?.focus()
    }
  }

  const sendCode = async () => {
    const value = email.trim().toLowerCase()
    if (!EMAIL_RE.test(value)) {
      setState('error')
      setMessage('请输入有效的邮箱地址')
      return
    }
    setState('sending')
    setMessage('')
    setDigits(Array(CODE_LENGTH).fill(''))
    try {
      const res = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      })
      const json = await res.json().catch(() => ({ message: '服务暂不可用' }))
      if (res.ok && json.ok) {
        setMessage(json.message || '验证码已发送，请查收邮件')
        setCountdown(CODE_RESEND_SECONDS)
        timerRef.current = setInterval(() => {
          setCountdown((s) => {
            if (s <= 1) clearInterval(timerRef.current)
            return s - 1
          })
        }, 1000)
      } else {
        setState('error')
        setMessage(json.message || '验证码发送失败，请稍后再试')
      }
    } catch {
      setState('error')
      setMessage('无法连接通知服务，请稍后再试')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!EMAIL_RE.test(value)) {
      setState('error')
      setMessage('请输入有效的邮箱地址')
      return
    }
    const code = digits.join('')
    if (!/^\d{6}$/.test(code)) {
      setState('error')
      setMessage('请输入 6 位数字验证码')
      return
    }
    setState('submitting')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value, code }),
      })
      const json = await res.json().catch(() => ({ message: '服务暂不可用' }))
      if (res.ok && json.ok) {
        setState('success')
        setMessage(json.message || '订阅成功')
      } else {
        setState('error')
        setMessage(json.message || '订阅失败，请稍后再试')
      }
    } catch {
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
            <form onSubmit={submit} noValidate className={styles.form}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="sub-email">
                  接收通知的邮箱
                </label>
                <div className={styles.inputRow}>
                  <input
                    id="sub-email"
                    className={styles.input}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setDigits(Array(CODE_LENGTH).fill(''))
                      setCountdown(0)
                      clearInterval(timerRef.current)
                    }}
                    disabled={state === 'submitting'}
                    autoComplete="email"
                  />
                  <button
                    type="button"
                    className={styles.sendCodeBtn}
                    disabled={state === 'sending' || countdown > 0}
                    onClick={sendCode}
                  >
                    {countdown > 0 ? `重发 ${countdown}s` : state === 'sending' ? '发送中…' : '发送验证码'}
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel} id="sub-code-label">
                  邮箱验证码
                </label>
                <div className={`${styles.inputRow} ${styles.codeRow}`}>
                  <div
                    className={styles.codeItems}
                    role="group"
                    aria-labelledby="sub-code-label"
                  >
                    {digits.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          cellRefs.current[i] = el
                        }}
                        className={styles.codeCell}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={d}
                        aria-label={`验证码第 ${i + 1} 位`}
                        onChange={(e) => handleCellChange(i, e.target.value)}
                        onKeyDown={(e) => handleCellKeyDown(i, e)}
                        disabled={state === 'submitting'}
                        autoComplete="one-time-code"
                      />
                    ))}
                  </div>
                  <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={state === 'submitting'}
                  >
                    {state === 'submitting' ? '提交中…' : '订阅'}
                  </button>
                </div>
              </div>

              {message && (
                <p
                  className={`${styles.feedback} ${state === 'error' ? styles.errorBox : styles.infoBox}`}
                  role={state === 'error' ? 'alert' : 'status'}
                >
                  {message}
                </p>
              )}
            </form>
          )}
        </div>
      </Modal>
    </>
  )
}
