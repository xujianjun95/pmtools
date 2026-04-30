import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'

const defaultEase = [0.22, 1, 0.36, 1]

/** 对齐 React Bits Blur Text：from + N 段 to 合成多轨关键帧 */
function buildKeyframes(from, steps) {
  const keys = new Set([
    ...Object.keys(from),
    ...steps.flatMap((s) => Object.keys(s)),
  ])
  const keyframes = {}
  keys.forEach((k) => {
    keyframes[k] = [from[k], ...steps.map((s) => s[k])]
  })
  return keyframes
}

/**
 * 与 https://reactbits.dev/text-animations/blur-text 同类：blur + opacity + y 分阶段。
 * 项目需 vite `resolve.dedupe: ['react','react-dom']`，否则两套 React 会白屏。
 */
function BlurText({
  text = '',
  delay = 200,
  className = '',
  animateBy = 'words',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '0px',
  animationFrom,
  animationTo,
  easing = defaultEase,
  onAnimationComplete,
  stepDuration = 0.35,
  component: Wrapper = 'span',
  delayOffset = 0,
}) {
  const elements = useMemo(() => {
    if (!text) return []
    if (animateBy === 'letters')
      return [...text].filter((c) => c !== '' && c !== '\u00A0')
    return text.trim().split(/\s+/).filter(Boolean)
  }, [animateBy, text])

  const [inView, setInView] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || elements.length === 0) return undefined

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.unobserve(el)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [elements.length, rootMargin, threshold])

  const fromSnapshot = useMemo(() => {
    if (animationFrom) return animationFrom
    const yOff = direction === 'top' ? -28 : 28
    return {
      filter: 'blur(10px)',
      opacity: 0,
      y: yOff,
    }
  }, [animationFrom, direction])

  const stepsSnapshot = useMemo(() => {
    if (animationTo && Array.isArray(animationTo)) return animationTo
    if (animationTo && typeof animationTo === 'object') return [animationTo]
    const yMid = direction === 'top' ? 5 : -5
    return [
      {
        filter: 'blur(5px)',
        opacity: 0.52,
        y: yMid,
      },
      {
        filter: 'blur(0px)',
        opacity: 1,
        y: 0,
      },
    ]
  }, [direction, animationTo])

  const keyframeAnimate = useMemo(
    () => buildKeyframes(fromSnapshot, stepsSnapshot),
    [fromSnapshot, stepsSnapshot]
  )

  const stepCount = stepsSnapshot.length + 1
  const totalDuration = stepDuration * Math.max(stepCount - 1, 1)
  const times = useMemo(
    () =>
      Array.from({ length: stepCount }, (_, i) =>
        stepCount === 1 ? 0 : i / (stepCount - 1)
      ),
    [stepCount]
  )

  if (elements.length === 0) {
    return <Wrapper ref={ref} className={className} />
  }

  return (
    <Wrapper
      ref={ref}
      className={className}
      style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'baseline' }}
    >
      {elements.map((segment, index) => {
        const staggerDelay = (delayOffset + index * delay) / 1000

        const showNbspAfterWord =
          animateBy === 'words' && index < elements.length - 1

        return (
          <motion.span
            key={`${animateBy}-${index}`}
            className="inline-block"
            style={{ willChange: 'opacity, transform, filter' }}
            initial={fromSnapshot}
            animate={inView ? keyframeAnimate : fromSnapshot}
            transition={{
              duration: Math.max(totalDuration, 0.25),
              times,
              delay: staggerDelay,
              ease: easing,
            }}
            onAnimationComplete={
              index === elements.length - 1 ? onAnimationComplete : undefined
            }
          >
            {segment}
            {showNbspAfterWord ? '\u00A0' : null}
          </motion.span>
        )
      })}
    </Wrapper>
  )
}

export default BlurText
