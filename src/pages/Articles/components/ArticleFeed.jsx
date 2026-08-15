import { useEffect, useRef, useState } from 'react'
import { getArticles, getArticleWithNeighbors } from '../../../data/articles'
import Markdown, { extractHeadings } from '../../../utils/markdown'
import styles from './ArticleFeed.module.css'

export const ARTICLES_SECTION_ID = 'articles-section'

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function pad(n) {
  return String(n).padStart(2, '0')
}

/**
 * 文章区：列表视图 ↔ 详情视图在同一 section 内切换，不走路由。
 * 参考 oiloil.org/#articles 的"一个页面来回循环"交互：
 *   点开文章 → 同页切到详情；返回 → 切回列表；
 *   多篇时上一篇/下一篇循环切换。
 */
function ArticleFeed() {
  const sectionRef = useRef(null)
  const firstRunRef = useRef(true)
  const [activeId, setActiveId] = useState(null)

  const articles = getArticles()
  const detail = activeId ? getArticleWithNeighbors(activeId) : null
  const hasNeighbors = articles.length > 1
  const headings = detail ? extractHeadings(detail.current.content) : []

  // 切换文章 / 视图时，把 section 顶部对齐到视口顶（避让固定顶栏用 scroll-margin-top）
  // 首次挂载跳过，避免进入首页就被拉到文章区
  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false
      return
    }
    const section = sectionRef.current
    if (!section) return
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth'
    section.scrollIntoView({ behavior, block: 'start' })
  }, [activeId])

  const handleOpen = (id) => setActiveId(id)
  const handleBack = () => setActiveId(null)
  const handleJump = (id) => setActiveId(id)

  return (
    <section
      id={ARTICLES_SECTION_ID}
      ref={sectionRef}
      className={styles.section}
    >
      <div className={styles.header}>
        <h2 className={styles.title}>
          文章
          <span className={styles.count}> / ARTICLES</span>
        </h2>
        {detail ? (
          <button
            className={styles.headerBack}
            onClick={handleBack}
            aria-label="返回文章列表"
          >
            <span className={styles.backArrow} aria-hidden="true">←</span>
            返回文章列表
          </button>
        ) : null}
      </div>

      {detail ? (
        <article key={detail.current.id} className={styles.detail}>
          <div className={styles.detailBody}>
            <header className={styles.detailHead}>
              <h1 className={styles.detailTitle}>{detail.current.title}</h1>
              <div className={styles.detailMeta}>
                <time className={styles.detailDate} dateTime={detail.current.date}>
                  {formatDate(detail.current.date)}
                </time>
                {detail.current.tags?.length ? (
                  <span className={styles.detailTags}>
                    {detail.current.tags.map((t) => (
                      <span key={t} className={styles.tag}>
                        {t}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
            </header>

            <Markdown content={detail.current.content} className={styles.body} />

            {hasNeighbors ? (
              <nav className={styles.neighbors} aria-label="文章导航">
                <button
                  className={styles.navBtn}
                  onClick={() => handleJump(detail.prev.id)}
                >
                  <span className={styles.navLabel}>上一篇</span>
                  <span className={styles.navTitle}>{detail.prev.title}</span>
                </button>
                <button
                  className={`${styles.navBtn} ${styles.navNext}`}
                  onClick={() => handleJump(detail.next.id)}
                >
                  <span className={styles.navLabel}>下一篇</span>
                  <span className={styles.navTitle}>{detail.next.title}</span>
                </button>
              </nav>
            ) : null}
          </div>
          {headings.length > 0 ? (
            <aside className={styles.toc} aria-label="文章目录">
              <p className={styles.tocLabel}>目录</p>
              <ol className={styles.tocList}>
                {headings.map((h) => (
                  <li
                    key={h.id}
                    title={h.text}
                    className={h.level === 3 ? styles.tocItemSub : styles.tocItem}
                  >
                    <a href={`#${h.id}`}>{h.text}</a>
                  </li>
                ))}
              </ol>
            </aside>
          ) : null}
        </article>
      ) : (
        <div key="list" className={styles.list}>
          {articles.map((a, idx) => (
            <article
              key={a.id}
              className={styles.card}
              role="button"
              tabIndex={0}
              onClick={() => handleOpen(a.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleOpen(a.id)
                }
              }}
            >
              <span className={styles.num}>{pad(idx + 1)}</span>
              <div className={styles.cardBody}>
                <h4 className={styles.cardTitle}>{a.title}</h4>
                <p className={styles.cardSummary}>{a.summary}</p>
                <div className={styles.cardMeta}>
                  <time dateTime={a.date}>{formatDate(a.date)}</time>
                  {a.tags?.length ? (
                    <span className={styles.cardTags}>
                      {a.tags.join(' · ')}
                    </span>
                  ) : null}
                </div>
              </div>
              <span className={styles.cardArrow} aria-hidden="true">→</span>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default ArticleFeed
