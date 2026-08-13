import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(useGSAP, ScrollTrigger)

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useHomeScrollAnimations(
  scopeRef,
  isHeroComplete,
  skipEntranceAnimation
) {
  useGSAP(() => {
    if (prefersReducedMotion()) return

    const select = gsap.utils.selector(scopeRef)
    const buildsSection = select('[data-home-builds-section]')
    const newsSection = select('[data-home-news-section]')
    const buildsHeader = select('[data-home-builds-header]')
    const projectMotionCards = select('[data-project-motion-card]')
    const newsHeader = select('#news-section [data-home-scroll-header]')

    if (skipEntranceAnimation) {
      gsap.set(
        [
          ...buildsSection,
          ...newsSection,
          ...buildsHeader,
          ...newsHeader,
        ],
        { autoAlpha: 1, y: 0, scale: 1 }
      )
    } else if (!isHeroComplete) {
      gsap.set([...buildsSection, ...newsSection], { autoAlpha: 0, y: 24 })
      return
    } else {
      gsap.set([...buildsSection, ...newsSection], { autoAlpha: 0, y: 24 })

      const entranceTimeline = gsap.timeline({
        defaults: { ease: 'power3.out' },
      })

      entranceTimeline
        .to(buildsSection, { autoAlpha: 1, y: 0, duration: 0.42 })
        .fromTo(
          buildsHeader,
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, y: 0, duration: 0.52 },
          '<0.08'
        )
        .to(newsSection, { autoAlpha: 1, y: 0, duration: 0.42 }, '+=0.12')
        .fromTo(
          newsHeader,
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, y: 0, duration: 0.52 },
          '<0.08'
        )
    }

    gsap.to(buildsHeader, {
      y: -18,
      ease: 'none',
      scrollTrigger: {
        trigger: '[data-home-builds-section]',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.7,
      },
    })

    const motionMedia = gsap.matchMedia()

    motionMedia.add('(min-width: 769px)', () => {
      projectMotionCards.forEach((card) => {
        const previewMedia = card.querySelector('[data-project-preview] img')
        const activeTargets = previewMedia ? [card, previewMedia] : [card]

        const cardTimeline = gsap.timeline({
          scrollTrigger: {
            trigger: card,
            start: 'top 94%',
            end: 'bottom 6%',
            scrub: 0.65,
            onToggle: ({ isActive }) => {
              gsap.set(activeTargets, {
                willChange: isActive ? 'transform, opacity' : 'auto',
              })
            },
          },
        })

        cardTimeline
          .fromTo(
            card,
            {
              autoAlpha: 0.7,
              y: 24,
              rotationX: -7,
              transformOrigin: '50% 100%',
            },
            {
              autoAlpha: 1,
              y: 0,
              rotationX: 0,
              duration: 0.38,
              ease: 'none',
            }
          )
          .to(card, {
            autoAlpha: 0.86,
            y: -12,
            rotationX: 6,
            transformOrigin: '50% 0%',
            duration: 0.62,
            ease: 'none',
          })

        if (previewMedia) {
          cardTimeline.fromTo(
            previewMedia,
            { scale: 1.025, yPercent: 2 },
            { scale: 1.065, yPercent: -2.5, duration: 1, ease: 'none' },
            0
          )
        }
      })
    })

    return () => motionMedia.revert()
  }, {
    dependencies: [isHeroComplete, skipEntranceAnimation],
    revertOnUpdate: true,
    scope: scopeRef,
  })
}
