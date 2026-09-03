import { useEffect, useRef, useState } from 'react'
import Modal from '../../../components/common/Modal'
import styles from './SubscribeButton.module.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const CODE_RESEND_SECONDS = 60
const CODE_LENGTH = 6
const STORAGE_KEY = 'qdii-sub-email'

export default function SubscribeButton() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''))
  const [state, setState] = useState('idle') // idle | sending | submitting | success | error
  const [message, setMessage] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [subscribedEmail, setSubscribedEmail] = useState(null)
  const timerRef = useRef(null)
  const cellRefs = useRef([])

  useEffect(() => {
    return () => clearInterval(timerRef.current)
  }, [])

  // 打开弹窗时：若有本地订阅记录，查询后端确认订阅状态并提示
  useEffect(() => {
    if (!open) return
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    fetch(`/api/status?email=${encodeURIComponent(saved)}`, { cache: 'no-store' })
      .then((response) => response.json())
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
    setDigits(Array(CODE_LENGTH).fill(''))
    setState('idle')
    setMessage('')
    setCountdown(0)
    setSubscribedEmail(null)
    clearInterval(timerRef.current)
  }

  const close = () => {
    setOpen(false)
    // 关闭后短暂延迟重置，避免下次打开闪现旧状态
    setTimeout(reset, 300)
  }

  const handleCellChange = (index, rawValue) => {
    const cleanValue = String(rawValue).replace(/\D/g, '')
    const nextDigits = [...digits]
    if (!cleanValue) {
      if (digits[index]) {
        nextDigits[index] = ''
        setDigits(nextDigits)
      }
      return
    }
    if (cleanValue.length === 1) {
      nextDigits[index] = cleanValue
      setDigits(nextDigits)
      if (index < CODE_LENGTH - 1) cellRefs.current[index + 1]?.focus()
      return
    }

    // 粘贴多字符：从当前格开始逐个分配
    let nextIndex = index
    for (const character of cleanValue) {
      if (nextIndex < CODE_LENGTH) {
        nextDigits[nextIndex] = character
        nextIndex += 1
      }
    }
    setDigits(nextDigits)
    cellRefs.current[Math.min(nextIndex, CODE_LENGTH - 1)]?.focus()
  }

  const handleCellKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault()
      cellRefs.current[index - 1]?.focus()
    }
  }

  const sendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(normalizedEmail)) {
      setState('error')
      setMessage('请输入有效的邮箱地址')
      return
    }

    setState('sending')
    setMessage('')
    setDigits(Array(CODE_LENGTH).fill(''))
    clearInterval(timerRef.current)

    try {
      const response = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      })
      const json = await response.json().catch(() => ({ message: '服务暂不可用' }))
      if (response.ok && json.ok) {
        setState('idle')
        setMessage(json.message || '验证码已发送，请查收邮件')
        setCountdown(CODE_RESEND_SECONDS)
        timerRef.current = setInterval(() => {
          setCountdown((seconds) => {
            if (seconds <= 1) clearInterval(timerRef.current)
            return seconds - 1
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

  const submit = async (event) => {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(normalizedEmail)) {
      setState('error')
      setMessage('请输入有效的邮箱地址')
      return
    }

    const verificationCode = digits.join('')
    if (!/^\d{6}$/.test(verificationCode)) {
      setState('error')
      setMessage('请输入 6 位数字验证码')
      return
    }

    setState('submitting')
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, code: verificationCode }),
      })
      const json = await response.json().catch(() => ({ message: '服务暂不可用' }))
      if (response.ok && json.ok) {
        localStorage.setItem(STORAGE_KEY, normalizedEmail)
        setSubscribedEmail(normalizedEmail)
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

  const handleEmailChange = (event) => {
    // 仅允许 ASCII 可打印字符，过滤中文、全角、空格和 emoji。
    setEmail(event.target.value.replace(/[^\x21-\x7E]/g, ''))
    setDigits(Array(CODE_LENGTH).fill(''))
    setCountdown(0)
    setMessage('')
    setState('idle')
    clearInterval(timerRef.current)
  }

  return (
    <>
      <button type="button" className={styles.subscribeBtn} onClick={() => setOpen(true)}>
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
                当监控基金出现<strong>申购状态 / 日累计限额</strong>变动时，
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
                        onChange={handleEmailChange}
                        disabled={state === 'submitting'}
                        autoComplete="email"
                      />
                      <button
                        type="button"
                        className={styles.sendCodeBtn}
                        disabled={state === 'sending' || countdown > 0}
                        onClick={sendCode}
                      >
                        {countdown > 0
                          ? `重发 ${countdown}s`
                          : state === 'sending'
                            ? '发送中…'
                            : '发送验证码'}
                      </button>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.fieldLabel} id="sub-code-label">
                      邮箱验证码
                    </label>
                    <div className={`${styles.inputRow} ${styles.codeRow}`}>
                      <div className={styles.codeItems} role="group" aria-labelledby="sub-code-label">
                        {digits.map((digit, index) => (
                          <input
                            key={index}
                            ref={(element) => {
                              cellRefs.current[index] = element
                            }}
                            className={styles.codeCell}
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={digit}
                            aria-label={`验证码第 ${index + 1} 位`}
                            onChange={(event) => handleCellChange(index, event.target.value)}
                            onKeyDown={(event) => handleCellKeyDown(index, event)}
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
            </>
          )}
        </div>
      </Modal>
    </>
  )
}
