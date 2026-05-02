import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from '../Profile.module.css'

const LINES = [
  { prefix: 'import', mid: '{ Idea }', suffix: "from '@jianjun/brain';" },
  { prefix: 'import', mid: '{ Agent }', suffix: "from '@vibe/coding';" },
  null,
  { comment: '// Initialize product building sequence' },
  { prefix: 'const', mid: 'currentTask', suffix: "= 'Crafting UI';" },
  null,
  { system: true },
]

const QUOTES = [
  'Less is more. - Ludwig Mies van der Rohe',
  'Any sufficiently advanced technology is indistinguishable from magic. - Arthur C. Clarke',
  'I choose a lazy person to do a hard job, because a lazy person will find an easy way to do it. - Bill Gates',
  'Make everything as simple as possible, but not simpler. - Albert Einstein',
  'The best way to complain is to make things. - James Murphy',
  'Good design is as little design as possible. - Dieter Rams',
]

function shuffleArray(arr) {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function VibeCard() {
  const [typed, setTyped] = useState(0)
  const [quoteIndex, setQuoteIndex] = useState(0)
  const queueRef = useRef(shuffleArray(QUOTES))

  const quote = queueRef.current[quoteIndex]
  const systemText = useMemo(() => `> System: ${quote}`, [quote])

  const nextQuote = useCallback(() => {
    setQuoteIndex((prev) => {
      const next = prev + 1
      if (next >= queueRef.current.length) {
        queueRef.current = shuffleArray(QUOTES)
        return 0
      }
      return next
    })
    setTyped(0)
  }, [])

  useEffect(() => {
    if (typed >= systemText.length) {
      const timer = setTimeout(nextQuote, 3000)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(() => setTyped((t) => t + 1), 50 + Math.random() * 40)
    return () => clearTimeout(timer)
  }, [typed, systemText.length, nextQuote])

  return (
    <div className={`${styles.vibeCard} fi d5`}>
      <div className={styles.vibeDots}>
        <span className={styles.vibeDotRed} />
        <span className={styles.vibeDotYellow} />
        <span className={styles.vibeDotGreen} />
        <span className={styles.vibeLabel}>vibe_workspace.sh</span>
      </div>

      <div className={styles.vibeCode}>
        {LINES.map((line, i) => {
          if (!line) {
            return (
              <div key={i} className={styles.vibeLine}>
                <span className={styles.vibeNum}>{i + 1}</span>
                <span className={styles.vibeContent}>&nbsp;</span>
              </div>
            )
          }
          if (line.comment) {
            return (
              <div key={i} className={styles.vibeLine}>
                <span className={styles.vibeNum}>{i + 1}</span>
                <span className={styles.vibeContent}>
                  <span className={styles.vibeComment}>{line.comment}</span>
                </span>
              </div>
            )
          }
          if (line.system) {
            const shown = systemText.slice(0, typed)
            return (
              <div key={i} className={styles.vibeLine}>
                <span className={styles.vibeNum}>{i + 1}</span>
                <span className={styles.vibeContent}>
                  <span className={styles.vibeSystem}>{shown}</span>
                  <span className={styles.vibeCursor} />
                </span>
              </div>
            )
          }
          return (
            <div key={i} className={styles.vibeLine}>
              <span className={styles.vibeNum}>{i + 1}</span>
              <span className={styles.vibeContent}>
                <span className={styles.vibeKeyword}>{line.prefix}</span>
                {' '}
                <span className={styles.vibeVar}>{line.mid}</span>
                {' '}
                <span className={styles.vibeText}>{line.suffix}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default VibeCard
