import BlurText from '../../../components/common/BlurText'
import styles from '../Home.module.css'

const BADGE_COPY = 'Crafting & Building'
const TITLE_LINE_1 = 'Why suffer poor design'
const TITLE_LINE_2 = 'when you can build the standard?'
const SUBTITLE_COPY = '造点顺手的工具，解决一些小麻烦。'

function HomeIntro() {
  const n1 = TITLE_LINE_1.trim().split(/\s+/).length
  const n2 = TITLE_LINE_2.trim().split(/\s+/).length

  const titleWordDelay = 85
  /** 与大标题首个词同拍：BlurText delayOffset 与此一致 */
  const gapAfterBadge = 120
  const gapBeforeSubtitle = 220
  const letterDelay = 22

  const title1Offset = gapAfterBadge
  const title2Offset = title1Offset + n1 * titleWordDelay
  const subtitleOffset = title2Offset + n2 * titleWordDelay + gapBeforeSubtitle

  return (
    <section className={styles.heroSection}>
      <div
        className={`${styles.heroBadge} fi`}
        style={{ animationDelay: `${gapAfterBadge}ms` }}
      >
        <span>{BADGE_COPY}</span>
      </div>

      <h1 className={styles.heroTitle}>
        <span className={styles.heroTitleMotion}>
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
          <br />
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
        </span>
      </h1>

      <p className={styles.heroSubtitle}>
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
      </p>
    </section>
  )
}

export default HomeIntro
