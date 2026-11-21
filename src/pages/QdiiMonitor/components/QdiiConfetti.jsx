import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { confettiAim, createConfettiCanvas } from './confettiCanvas'
import { useConfettiCount } from './useConfettiCount'
import styles from './QdiiConfetti.module.css'

const COOLDOWN_MS = 200
const GREETING_DURATION_MS = 2600
const BLESSINGS = [
  '愿你一路长红', '限额常开 申购畅通', '定投不止 好运不停', '耐心是最好的复利', '今日宜申购',
  '行情顺遂 心想事成', '额度充足 一键申购', '愿你抢到心仪额度', '日日有额度 天天有好运', '红红火火 万事顺遂',
  '慢慢来 比较快', '时间是好朋友', '复利路上 不急不躁', '愿你的曲线向右上方', '好运申购成功',
  '今天也是定投的一天', '钱放得住 心也放得住', '稳住心态 静待花开', '种下今天 收获时间', '愿你睡得安稳 醒来有惊喜',
  '红包满满 额度满满', '额度如潮 源源不断', '开市大吉', '万事胜意', '如愿以偿',
  '好事成双 申购双开', '不慌不忙 时间会回答', '小步快跑 稳稳向前', '每一份坚持 都算数', '今日份好运已送达',
  '愿你申购秒成功', '长线从容 短线淡定', '愿所有期待 都有回响', '愿你笑看涨跌', '每日一红 好运连连',
  '福星高照 额度常在', '愿你的坚持被时间看见', '好运加仓', '额度不缺席', '财运亨通 平安顺意',
  '新的一天 新的额度', '愿你眼里有光 账户有喜', '愿你被世界温柔以待', '来都来了 放个礼花', '好运已就位',
  '心中有数 手里有粮', '岁岁平安 年年有余', '祝你申购顺利 生活顺意', '愿你今天比昨天更好', '好运常伴 红运当头',
]

function PartyPopper({ sparklesRef }) {
  return (
    <svg className={styles.icon} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4.5 28.5 11.2 10.6 21.4 20.8Z" fill="#c9a36b" stroke="#c9a36b" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M6.6 22.6 10.4 26.4M8.6 17.2 15.6 24.2" stroke="#7a5c3a" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11.2 10.6Q17.6 11 21.4 20.8Q14.6 17.4 11.2 10.6Z" fill="#7a5c3a" stroke="#7a5c3a" strokeWidth="1.2" strokeLinejoin="round" />
      <g ref={sparklesRef} className={`sp ${styles.sparkles}`}>
        <path d="M14.6 8C13.4 4.6 17.6 5.4 16.6 1.6" fill="none" stroke="#c0392b" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M20 14.2C24.4 12.6 22.2 8.6 27.4 8.4" fill="none" stroke="#c9a36b" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="24.6" cy="19" r="1.3" fill="#c0392b" />
        <circle cx="11.4" cy="3.6" r="1.1" fill="#c9a36b" />
        <circle cx="22" cy="4.8" r="1" fill="#c9a36b" />
        <rect x="26" y="13.2" width="3" height="1.8" rx=".4" fill="#c9a36b" transform="rotate(35 27.5 14.1)" />
        <rect x="17.4" y="1.2" width="2.6" height="1.6" rx=".4" fill="#c0392b" transform="rotate(-30 18.7 2)" />
      </g>
    </svg>
  )
}

function QdiiConfetti({ reducedMotion }) {
  const anchorRef = useRef(null)
  const buttonRef = useRef(null)
  const sparklesRef = useRef(null)
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const animationsRef = useRef([])
  const previousClickRef = useRef(-Infinity)
  const previousBlessingRef = useRef(-1)
  const greetingTimerRef = useRef(null)
  const [greeting, setGreeting] = useState(null)
  const [total, recordClick] = useConfettiCount()

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    function aimIcon() {
      const bounds = anchor.getBoundingClientRect()
      const { angle } = confettiAim(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
      anchor.style.setProperty('--confetti-angle', `${angle * 180 / Math.PI + 47}deg`)
    }

    aimIcon()
    window.addEventListener('resize', aimIcon)
    return () => window.removeEventListener('resize', aimIcon)
  }, [])

  useEffect(() => {
    if (reducedMotion) return undefined

    const engine = createConfettiCanvas(canvasRef.current)
    engineRef.current = engine
    return () => {
      engineRef.current = null
      engine.dispose()
      animationsRef.current.forEach((animation) => animation.cancel())
    }
  }, [reducedMotion])

  useEffect(() => () => window.clearTimeout(greetingTimerRef.current), [])

  function celebrate() {
    const now = performance.now()
    if (now - previousClickRef.current < COOLDOWN_MS) return
    previousClickRef.current = now

    const previous = previousBlessingRef.current
    const draw = Math.floor(Math.random() * (BLESSINGS.length - (previous >= 0 ? 1 : 0)))
    const index = previous >= 0 && draw >= previous ? draw + 1 : draw
    previousBlessingRef.current = index
    setGreeting({ id: now, text: BLESSINGS[index] })
    window.clearTimeout(greetingTimerRef.current)
    greetingTimerRef.current = window.setTimeout(() => setGreeting(null), GREETING_DURATION_MS)
    recordClick()

    if (reducedMotion) return

    const bounds = buttonRef.current.getBoundingClientRect()
    engineRef.current?.fire(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
    animationsRef.current.forEach((animation) => animation.cancel())
    animationsRef.current = [
      buttonRef.current.animate([
        { rotate: '0deg' },
        { rotate: '-7deg', offset: 0.24 },
        { rotate: '6deg', offset: 0.5 },
        { rotate: '-3deg', offset: 0.72 },
        { rotate: '0deg' },
      ], { duration: 420, easing: 'ease-out' }),
      sparklesRef.current.animate([
        { scale: 1 },
        { scale: 1.6, offset: 0.33 },
        { scale: 1 },
      ], { duration: 550, easing: 'cubic-bezier(.2,.8,.3,1)' }),
    ]
  }

  return (
    <div ref={anchorRef} className={styles.anchor}>
      <button
        ref={buttonRef}
        className={styles.button}
        type="button"
        aria-label="放礼花"
        onClick={celebrate}
      >
        <PartyPopper sparklesRef={sparklesRef} />
      </button>

      <div className={styles.announcement} role="status" aria-atomic="true">
        {greeting && (
          <div key={greeting.id} className={styles.bubble}>
            <p className={styles.blessing}>{greeting.text}</p>
            {!reducedMotion && total !== null && (
              <p className={styles.total}>全站已放出 {total.toLocaleString()} 次礼花</p>
            )}
          </div>
        )}
      </div>

      {!reducedMotion && createPortal(
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" width="0" height="0" />,
        document.body
      )}
    </div>
  )
}

export default QdiiConfetti
