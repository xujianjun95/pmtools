import { useEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import NewsItem from './NewsItem'
import styles from './NewsFeed.module.css'

const NEWS_API_URL = import.meta.env.VITE_NEWS_API_URL || 'https://api.pmtools.com.cn/api/news'

gsap.registerPlugin(useGSAP, ScrollTrigger)

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function NewsFeed({ isHeroComplete }) {
  const sectionRef = useRef(null)
  const [news, setNews] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(NEWS_API_URL)
      .then((res) => {
        if (!res.ok) throw new Error('请求失败')
        return res.json()
      })
      .then((data) => {
        setNews(data)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  useGSAP(() => {
    if (
      loading ||
      error ||
      !news?.items?.length ||
      !isHeroComplete ||
      prefersReducedMotion()
    ) return

    gsap.fromTo(
      '[data-home-news-item]',
      { autoAlpha: 0, y: 20 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.58,
        ease: 'power3.out',
        stagger: 0.055,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 76%',
          toggleActions: 'play none none reverse',
        },
      }
    )

    ScrollTrigger.refresh()
  }, {
    dependencies: [loading, error, isHeroComplete, news?.items?.length],
    revertOnUpdate: true,
    scope: sectionRef,
  })

  return (
    <section
      id="news-section"
      ref={sectionRef}
      className={styles.section}
      data-home-news-section
    >
      <div className={styles.header} data-home-scroll-header>
        <h2 className={styles.title}>
          资讯
          <span className={styles.count}> / NEWS</span>
        </h2>
        <p className={styles.desc}>AI 前沿，每日精选</p>
      </div>

      <div className={styles.list}>
        {loading &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.skeleton} />
          ))}

        {error && (
          <p className={styles.error}>资讯加载失败，请稍后再试</p>
        )}

        {news?.items?.map((item, index) => (
          <NewsItem key={item.id || index} item={item} index={index} />
        ))}
      </div>
    </section>
  )
}

export default NewsFeed
