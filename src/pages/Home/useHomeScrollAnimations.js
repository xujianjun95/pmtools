import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(useGSAP, ScrollTrigger)

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useHomeScrollAnimations(scopeRef, isHeroComplete) {
  useGSAP(() => {
    if (prefersReducedMotion()) return

    const select = gsap.utils.selector(scopeRef)
    const buildsSection = select('[data-home-builds-section]')
    const newsSection = select('[data-home-news-section]')

    if (!isHeroComplete) {
      gsap.set([...buildsSection, ...newsSection], { autoAlpha: 0, y: 24 })
      return
    }

    gsap.set([...buildsSection, ...newsSection], { autoAlpha: 0, y: 24 })

    const entranceTimeline = gsap.timeline({
      defaults: { ease: 'power3.out' },
    })

    entranceTimeline
      .to(buildsSection, { autoAlpha: 1, y: 0, duration: 0.42 })
      .fromTo(
        select('[data-home-builds-header]'),
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.52 },
        '<0.08'
      )
      .fromTo(
        select('[data-home-build-card]'),
        { autoAlpha: 0, y: 28, scale: 0.985 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.58,
          stagger: 0.08,
        },
        '<0.1'
      )
      .to(newsSection, { autoAlpha: 1, y: 0, duration: 0.42 }, '+=0.12')
      .fromTo(
        select('#news-section [data-home-scroll-header]'),
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.52 },
        '<0.08'
      )

    gsap.to('[data-home-builds-header]', {
      y: -18,
      ease: 'none',
      scrollTrigger: {
        trigger: '[data-home-builds-section]',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.7,
      },
    })
  }, {
    dependencies: [isHeroComplete],
    revertOnUpdate: true,
    scope: scopeRef,
  })
}
