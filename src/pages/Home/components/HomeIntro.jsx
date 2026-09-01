import { useEffect, useState } from 'react'
import SplitText from '../../../components/common/SplitText'
import styles from '../Home.module.css'

const BADGE_COPY = 'Crafting & Building'
const TITLE_LINE_1 = 'Why suffer poor design'
const TITLE_LINE_2 = 'when you can build the standard'
const SUBTITLE_COPY = '造点顺手的工具，解决一些小麻烦'
/** 黄金分割图：外框/方块浮现（0.2~1.3s）→ 螺旋一笔到底（1~2.84s）→ 圆点落定（2.84s），与文案末字同步。 */
const HERO_ANIMATION_END_MS = 2900

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
    }, HERO_ANIMATION_END_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [onComplete, playAnimation, prefersReducedMotion])

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

      <div
        className={styles.heroArtwork}
        aria-hidden="true"
      >
        <svg viewBox="0 0 520 420" role="presentation">
          <g className={styles.heroArtworkAnnotations}>
            <g
              className={styles.heroArtworkAnnotation}
              style={{ '--annotation-delay': '0.55s' }}
            >
              <text x="48" y="43" className={styles.heroArtworkScript}>
                De divina proportione
              </text>
              <text x="49" y="53" className={styles.heroArtworkScriptSmall}>
                Luca Pacioli · 1497
              </text>
            </g>

            <g
              className={styles.heroArtworkAnnotation}
              style={{ '--annotation-delay': '0.75s' }}
            >
              <text x="30" y="119" className={styles.heroArtworkLabel}>
                RATIO AUREA
              </text>
              <text x="30" y="136" className={styles.heroArtworkFormula}>
                φ = 1.6180339887…
              </text>
              <text x="29" y="160" className={styles.heroArtworkFormula}>
                a/b = b/(a+b) = φ
              </text>
              <path
                className={`${styles.heroArtworkStroke} ${styles.heroArtworkAnnotationLine}`}
                d="M30 174H94 M30 169V179 M68 169V179 M94 169V179"
                pathLength="1"
                style={{ animationDelay: '0.78s', animationDuration: '0.3s' }}
              />
              <text x="45" y="188" className={styles.heroArtworkScriptSmall}>
                a + b
              </text>
            </g>

            <g
              className={styles.heroArtworkAnnotation}
              style={{ '--annotation-delay': '1s' }}
            >
              <text x="412" y="45" className={styles.heroArtworkScriptSmall}>
                La proporzione divina
              </text>
              <text x="412" y="56" className={styles.heroArtworkScriptSmall}>
                regge l’universo.
              </text>
              <rect
                className={`${styles.heroArtworkStroke} ${styles.heroArtworkAnnotationLine}`}
                x="444"
                y="68"
                width="41"
                height="41"
                pathLength="1"
                style={{ animationDelay: '1.05s', animationDuration: '0.25s' }}
              />
              <path
                className={`${styles.heroArtworkStroke} ${styles.heroArtworkAnnotationLine}`}
                d="M444 109A41 41 0 0 1 485 68A25 25 0 0 1 485 93A16 16 0 0 1 469 109A10 10 0 0 1 459 99A6 6 0 0 1 465 93"
                pathLength="1"
                style={{ animationDelay: '1.3s', animationDuration: '0.35s' }}
              />
            </g>

            <g
              className={styles.heroArtworkAnnotation}
              style={{ '--annotation-delay': '3.4s' }}
            >
              <path
                className={`${styles.heroArtworkStroke} ${styles.heroArtworkDimension}`}
                d="M26 54V67 M492 54V67 M26 59H492 M502 66H490 M502 354H490 M498 66V354 M26 365V378 M314 365V378 M382 365V378 M492 365V378 M26 372H314 M314 372H382 M382 372H492"
                pathLength="1"
                style={{ animationDelay: '3.6s', animationDuration: '0.4s' }}
              />
              <text x="164" y="369" className={styles.heroArtworkDimensionText}>
                a + b
              </text>
              <text x="343" y="369" className={styles.heroArtworkDimensionText}>
                b
              </text>
              <text x="434" y="369" className={styles.heroArtworkDimensionText}>
                a
              </text>
            </g>

            <g
              className={styles.heroArtworkAnnotation}
              style={{ '--annotation-delay': '1.75s' }}
            >
              <text x="81" y="391" className={styles.heroArtworkScriptSmall}>
                1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89…
              </text>
              <text x="81" y="403" className={styles.heroArtworkScriptSmall}>
                Fibonacci sequence · the growth of nature
              </text>
              <text x="356" y="391" className={styles.heroArtworkScriptSmall}>
                a : b = 1 : 1.618
              </text>
              <text x="356" y="403" className={styles.heroArtworkScriptSmall}>
                φ · the golden ratio
              </text>
            </g>

            <g
              className={styles.heroArtworkAnnotation}
              style={{ '--annotation-delay': '1.3s' }}
              transform="translate(454 180) scale(0.36)"
            >
              <path
                className={styles.heroArtworkColumnGuide}
                d="M-24 -24V312 M-34 -14H-14 M-34 302H-14 M102 -24V312 M-40 55H112 M-40 102H112 M-40 126H112 M-40 274H112"
              />
              <path
                className={styles.heroArtworkColumn}
                d="M-18 0H105 M-8 13H94 M2 25H84 M5 30C5 48 15 60 30 61C15 65 12 79 17 90C22 99 36 97 37 85C38 77 29 74 25 80C23 85 29 89 33 86 M81 30C81 48 71 60 56 61C71 65 74 79 69 90C64 99 50 97 49 85C48 77 57 74 61 80C63 85 57 89 53 86 M0 99H87 M8 108H79 M12 116H75 M16 127H71 M20 127C22 185 22 230 26 273 M67 127C65 185 65 230 61 273 M29 128L33 273 M40 128L41 273 M50 128L49 273 M59 128L56 273 M25 273H62 M18 281H69 M10 292H77"
              />
            </g>
          </g>

          <g transform="translate(-87.2 25.2) scale(0.4438)">
            <rect
              className={`${styles.heroArtworkFrame} ${styles.heroArtworkReveal}`}
              x="255"
              y="92"
              width="1050"
              height="649"
              style={{ animationDelay: '0.2s' }}
            />

            {[
              // 背景网格浮现：方块不逐笔描边，由外到内依次淡入，让螺旋成为唯一主笔
              { x: 255, y: 92, width: 649, height: 649, delay: '0.35s' },
              { x: 904, y: 92, width: 401, height: 401, delay: '0.43s' },
              { x: 1057, y: 493, width: 248, height: 248, delay: '0.51s' },
              { x: 904, y: 493, width: 153, height: 153, delay: '0.59s' },
              { x: 904, y: 646, width: 95, height: 95, delay: '0.67s' },
              { x: 999, y: 646, width: 58, height: 58, delay: '0.75s' },
              { x: 1021, y: 704, width: 36, height: 37, delay: '0.83s' },
              { x: 999, y: 704, width: 22, height: 22, delay: '0.91s' },
            ].map((rect) => (
              <rect
                key={`${rect.x}-${rect.y}`}
                className={`${styles.heroArtworkConstruction} ${styles.heroArtworkReveal}`}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                style={{ animationDelay: rect.delay }}
              />
            ))}

            <path
              className={`${styles.heroArtworkStroke} ${styles.heroArtworkSpiral}`}
              d="M255 741 C255 382.5 545.5 92 904 92 C1125.5 92 1305 271.5 1305 493 C1305 630 1194 741 1057 741 C972.5 741 904 672.5 904 588 C904 535.5 946.5 493 999 493 C1031 493 1057 519 1057 551 C1057 570.3 1041.3 586 1022 586 C1009.3 586 999 575.7 999 563 C999 555.3 1005.3 549 1013 549 C1018 549 1022 553 1022 558"
              pathLength="1"
            />
            <path
              className={`${styles.heroArtworkStroke} ${styles.heroArtworkSpiralDetail}`}
              d="M258 741 C258 384 547 95 904 95 C1123 95 1302 273 1302 493"
              pathLength="1"
            />
            <path
              className={`${styles.heroArtworkStroke} ${styles.heroArtworkSpiralDetail} ${styles.heroArtworkSpiralTexture}`}
              d="M252 741 C252 380 544 89 904 89 C1128 89 1308 270 1308 493"
              pathLength="1"
            />

            <circle
              className={styles.heroArtworkCenter}
              cx="1022"
              cy="558"
              r="9"
            />
          </g>
        </svg>
      </div>
    </section>
  )
}

export default HomeIntro
