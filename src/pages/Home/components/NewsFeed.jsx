import { useEffect, useState } from 'react'
import NewsItem from './NewsItem'
import styles from './NewsFeed.module.css'

const NEWS_API_URL = import.meta.env.VITE_NEWS_API_URL || 'https://api.pmtools.com.cn/api/news'

function NewsFeed() {
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

  return (
    <section id="news-section" className={styles.section}>
      <div className={styles.header}>
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
