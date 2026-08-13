import { useEffect, useState } from 'react'
import BlurText from '../../../components/common/BlurText'
import styles from '../Home.module.css'

const BADGE_COPY = 'Crafting & Building'
const TITLE_LINE_1 = 'Why suffer poor design'
const TITLE_LINE_2 = 'when you can build the standard?'
const SUBTITLE_COPY = '造点顺手的工具，解决一些小麻烦。'
/** 黄金分割图中心圆点落定：4.36s delay + 0.4s duration。 */
const HERO_ANIMATION_END_MS = 4760
const SUBTITLE_STEP_DURATION_MS = 560

function HomeIntro({ shouldAnimate, onComplete }) {
  const [prefersReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const playAnimation = shouldAnimate && !prefersReducedMotion
  const n1 = TITLE_LINE_1.trim().split(/\s+/).length
  const n2 = TITLE_LINE_2.trim().split(/\s+/).length

  const titleWordDelay = 260
  /** 与大标题首个词同拍：BlurText delayOffset 与此一致 */
  const gapAfterBadge = 120
  const gapBeforeSubtitle = 220
  const title1Offset = gapAfterBadge
  const title2Offset = title1Offset + n1 * titleWordDelay
  const subtitleOffset = title2Offset + n2 * titleWordDelay + gapBeforeSubtitle
  const subtitleStaggerCount = Math.max(SUBTITLE_COPY.length - 1, 1)
  const letterDelay = Math.max(
    0,
    (HERO_ANIMATION_END_MS - subtitleOffset - SUBTITLE_STEP_DURATION_MS) /
      subtitleStaggerCount
  )

  useEffect(() => {
    if (!playAnimation) {
      onComplete()
      return undefined
    }

    const timer = window.setTimeout(onComplete, HERO_ANIMATION_END_MS)

    return () => window.clearTimeout(timer)
  }, [onComplete, playAnimation])

  return (
    <section
      className={styles.heroSection}
      data-hero-animation={playAnimation ? 'playing' : 'static'}
    >
      <div
        className={`${styles.heroBadge}${playAnimation ? ' fi' : ''}`}
        style={
          playAnimation ? { animationDelay: `${gapAfterBadge}ms` } : undefined
        }
      >
        <span>{BADGE_COPY}</span>
      </div>

      <h1 className={styles.heroTitle}>
        <span className={styles.heroTitleMotion}>
          {playAnimation ? (
            <BlurText
              component="span"
              className={styles.heroTitleLine}
              text={TITLE_LINE_1}
              animateBy="words"
              direction="top"
              delay={titleWordDelay}
              delayOffset={title1Offset}
              stepDuration={0.4}
            />
          ) : (
            <span className={styles.heroTitleLine}>{TITLE_LINE_1}</span>
          )}
          <br />
          {playAnimation ? (
            <BlurText
              component="span"
              className={styles.heroTitleLine}
              text={TITLE_LINE_2}
              animateBy="words"
              direction="top"
              delay={titleWordDelay}
              delayOffset={title2Offset}
              stepDuration={0.4}
            />
          ) : (
            <span className={styles.heroTitleLine}>{TITLE_LINE_2}</span>
          )}
        </span>
      </h1>

      <p className={styles.heroSubtitle}>
        {playAnimation ? (
          <BlurText
            component="span"
            className={styles.heroSubtitleBlur}
            text={SUBTITLE_COPY}
            animateBy="letters"
            direction="top"
            delay={letterDelay}
            delayOffset={subtitleOffset}
            stepDuration={0.28}
            threshold={0.08}
          />
        ) : (
          <span className={styles.heroSubtitleBlur}>{SUBTITLE_COPY}</span>
        )}
      </p>

      <div className={styles.heroArtwork} aria-hidden="true">
        <svg viewBox="0 0 520 420" role="presentation">
          <rect
            className={`${styles.heroArtworkStroke} ${styles.heroArtworkFrame}`}
            x="26"
            y="66"
            width="466"
            height="288"
            pathLength="1"
          />

          <path
            className={`${styles.heroArtworkStroke} ${styles.heroArtworkConstruction}`}
            d="M314 66V354"
            pathLength="1"
            style={{ animationDelay: '0.7s' }}
          />
          <path
            className={`${styles.heroArtworkStroke} ${styles.heroArtworkConstruction}`}
            d="M314 244H492"
            pathLength="1"
            style={{ animationDelay: '1s' }}
          />
          <path
            className={`${styles.heroArtworkStroke} ${styles.heroArtworkConstruction}`}
            d="M382 244V354"
            pathLength="1"
            style={{ animationDelay: '1.25s' }}
          />
          <path
            className={`${styles.heroArtworkStroke} ${styles.heroArtworkConstruction}`}
            d="M314 286H382"
            pathLength="1"
            style={{ animationDelay: '1.5s' }}
          />
          <path
            className={`${styles.heroArtworkStroke} ${styles.heroArtworkConstruction}`}
            d="M356 244V286"
            pathLength="1"
            style={{ animationDelay: '1.72s' }}
          />
          <path
            className={`${styles.heroArtworkStroke} ${styles.heroArtworkConstruction}`}
            d="M356 270H382"
            pathLength="1"
            style={{ animationDelay: '1.91s' }}
          />
          <path
            className={`${styles.heroArtworkStroke} ${styles.heroArtworkConstruction}`}
            d="M366 270V286"
            pathLength="1"
            style={{ animationDelay: '2.08s' }}
          />
          <path
            className={`${styles.heroArtworkStroke} ${styles.heroArtworkConstruction}`}
            d="M356 276H366M362 270V276M362 274H366"
            pathLength="1"
            style={{ animationDelay: '2.23s' }}
          />

          <path
            className={`${styles.heroArtworkStroke} ${styles.heroArtworkSpiral}`}
            d="M26 354 A288 288 0 0 1 314 66 A178 178 0 0 1 492 244 A110 110 0 0 1 382 354 A68 68 0 0 1 314 286 A42 42 0 0 1 356 244 A26 26 0 0 1 382 270 A16 16 0 0 1 366 286 A10 10 0 0 1 356 276 A6 6 0 0 1 362 270 A4 4 0 0 1 366 274"
            pathLength="1"
          />

          <circle
            className={styles.heroArtworkCenter}
            cx="364"
            cy="274"
            r="4"
          />
        </svg>
      </div>
    </section>
  )
}

export default HomeIntro
