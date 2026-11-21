import { useEffect, useState } from 'react'
import SplitText from '../../../components/common/SplitText'
import GoldenSpiralBlueprint from './GoldenSpiralBlueprint'
import styles from '../Home.module.css'

const BADGE_COPY = 'Crafting & Building'
const TITLE_LINE_1 = 'Why suffer poor design'
const TITLE_LINE_2 = 'when you can build the standard'
const SUBTITLE_COPY = '造点顺手的工具，解决一些小麻烦'
// 正文和下方区块沿用现有的入场节奏。
const INTRO_ANIMATION_END_MS = 2900

function HomeIntro({ shouldAnimate, onComplete }) {
  const [prefersReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const playAnimation = shouldAnimate && !prefersReducedMotion
  const n1 = TITLE_LINE_1.trim().split(/\s+/).length
  const n2 = TITLE_LINE_2.trim().split(/\s+/).length

  const titleWordDelay = 180
  /** 与大标题首个词同拍：SplitText 起始 delay（注入 to.delay）与此一致 */
  const gapAfterBadge = 120
  const gapBeforeSubtitle = 220
  const title1Offset = gapAfterBadge
  const title2Offset = title1Offset + n1 * titleWordDelay
  const subtitleOffset = title2Offset + n2 * titleWordDelay + gapBeforeSubtitle
  /** 建筑杂志风遮罩揭幕：文字从基线下方升起、被遮罩裁剪，克制优雅 */
  const titleFrom = { yPercent: 120 }
  const titleTo = (startOffsetMs) => ({
    yPercent: 0,
    // SplitText 无行间错峰参数，用 gsap tween 的 delay 实现
    delay: startOffsetMs / 1000,
  })

  useEffect(() => {
    if (!playAnimation) {
      onComplete()
      return undefined
    }

    const timer = window.setTimeout(() => {
      onComplete()
    }, INTRO_ANIMATION_END_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [onComplete, playAnimation])

  return (
    <section className={styles.heroSection}>
      <div className={styles.heroCopy}>
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
              <SplitText
                tag="span"
                text={TITLE_LINE_1}
                splitType="words"
                delay={titleWordDelay}
                duration={0.55}
                ease="power4.out"
                from={titleFrom}
                to={titleTo(title1Offset)}
                threshold={0}
                rootMargin="0px"
                textAlign="left"
                mask="words"
              />
            ) : (
              <span className={styles.heroTitleLine}>{TITLE_LINE_1}</span>
            )}
            <br />
            {playAnimation ? (
              <SplitText
                tag="span"
                text={TITLE_LINE_2}
                splitType="words"
                delay={titleWordDelay}
                duration={0.55}
                ease="power4.out"
                from={titleFrom}
                to={titleTo(title2Offset)}
                threshold={0}
                rootMargin="0px"
                textAlign="left"
                mask="words"
              />
            ) : (
              <span className={styles.heroTitleLine}>{TITLE_LINE_2}</span>
            )}
          </span>
        </h1>

        <p className={styles.heroSubtitle}>
          {playAnimation ? (
              <SplitText
                tag="span"
                text={SUBTITLE_COPY}
                splitType="lines"
                delay={0}
                duration={0.7}
                ease="power4.out"
                from={titleFrom}
                to={titleTo(subtitleOffset)}
                threshold={0}
                rootMargin="0px"
                textAlign="left"
                mask="lines"
              />
          ) : (
            <span className={styles.heroSubtitleBlur}>{SUBTITLE_COPY}</span>
          )}
        </p>
      </div>
      <GoldenSpiralBlueprint autoPlay={shouldAnimate} />
    </section>
  )
}

export default HomeIntro
