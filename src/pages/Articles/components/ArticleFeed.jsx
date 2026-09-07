import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchArticleDetail, fetchArticleList } from '../../../data/articlesApi'
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
 * 数据源：后台 API（/background-api/articles，spec §7.6）。
 * 列表一次加载；详情按需加载，API 失败不回退本地数据（防止已下架文章复活）。
 * 快速切换文章用请求序号守卫，丢弃过期响应，避免串文。
 */
function ArticleFeed() {
  const sectionRef = useRef(null)
  const firstRunRef = useRef(true)
  const detailSeqRef = useRef(0)

  const [articles, setArticles] = useState([])
  const [listStatus, setListStatus] = useState('loading') // loading | error | ready
  const [listReloadKey, setListReloadKey] = useState(0)
  const [activeId, setActiveId] = useState(null)
  const [detail, setDetail] = useState({ status: 'idle' }) // idle | loading | ready | error | notfound
  const [detailRetryKey, setDetailRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchArticleList()
      .then((list) => {
        if (!cancelled) {
          setArticles(list)
          setListStatus('ready')
        }
      })
      .catch((error) => {
        console.warn('[articles] 后台文章列表加载失败。', error)
        if (!cancelled) setListStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [listReloadKey])

  // 详情按需加载：请求序号守卫，快速切换时旧响应作废。
  // loading/idle 状态统一在事件处理器里设置，effect 只负责订阅请求结果。
  useEffect(() => {
    if (!activeId) return undefined
    detailSeqRef.current += 1
    const seq = detailSeqRef.current
    fetchArticleDetail(activeId)
      .then((article) => {
        if (detailSeqRef.current === seq) setDetail({ status: 'ready', article })
      })
      .catch((error) => {
        if (detailSeqRef.current !== seq) return
        console.warn('[articles] 文章详情加载失败。', error)
        setDetail({ status: error?.notFound ? 'notfound' : 'error' })
      })
    return undefined
  }, [activeId, detailRetryKey])

  const sorted = useMemo(
    () => [...articles].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [articles]
  )

  const entryIndex = activeId ? sorted.findIndex((a) => a.id === activeId) : -1
  const entry = entryIndex >= 0 ? sorted[entryIndex] : null
  const len = sorted.length
  const prev = entryIndex >= 0 && len > 1 ? sorted[(entryIndex - 1 + len) % len] : null
  const next = entryIndex >= 0 && len > 1 ? sorted[(entryIndex + 1) % len] : null
  const headings =
    detail.status === 'ready' ? extractHeadings(detail.article.content) : []

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

  const handleOpen = (id) => {
    setDetail({ status: 'loading' })
    setActiveId(id)
  }
  const handleBack = () => {
    setActiveId(null)
    setDetail({ status: 'idle' })
  }
  const handleJump = (id) => {
    if (id === activeId) return
    setDetail({ status: 'loading' })
    setActiveId(id)
  }
  const handleRetryDetail = () => {
    setDetail({ status: 'loading' })
    setDetailRetryKey((k) => k + 1)
  }
  const handleRetryList = () => {
    setListStatus('loading')
    setListReloadKey((k) => k + 1)
  }

  const renderDetailBody = () => {
    if (detail.status === 'ready') {
      return <Markdown content={detail.article.content} className={styles.body} />
    }
    if (detail.status === 'notfound') {
      return (
        <div className={styles.stateBox}>
          <p>文章不存在或已下架</p>
        </div>
      )
    }
    if (detail.status === 'error') {
      return (
        <div className={styles.stateBox}>
          <p>暂时无法加载，请稍后重试</p>
          <button type="button" className={styles.retryBtn} onClick={handleRetryDetail}>
            重试
          </button>
        </div>
      )
    }
    return <p className={styles.loadHint}>正在加载正文…</p>
  }

  return (
    <section
      id={ARTICLES_SECTION_ID}
      ref={sectionRef}
      className={styles.section}
    >
      {!entry ? (
        <div className={styles.header}>
          <h2 className={styles.title}>
            文章
            <span className={styles.count}> / ARTICLES</span>
          </h2>
        </div>
      ) : null}

      {entry ? (
        <article key={entry.id} className={styles.detail}>
          <div className={styles.detailBody}>
            <button
              className={styles.backLink}
              onClick={handleBack}
              aria-label="返回文章列表"
            >
              <span className={styles.backArrow} aria-hidden="true">←</span>
              返回文章列表
            </button>
            <header className={styles.detailHead}>
              <h1 className={styles.detailTitle}>{entry.title}</h1>
              <div className={styles.detailMeta}>
                <time className={styles.detailDate} dateTime={entry.date}>
                  {formatDate(entry.date)}
                </time>
                {entry.tags?.length ? (
                  <span className={styles.detailTags}>
                    {entry.tags.map((t) => (
                      <span key={t} className={styles.tag}>
                        {t}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
            </header>

            {renderDetailBody()}

            {detail.status === 'ready' && (prev || next) ? (
              <nav className={styles.neighbors} aria-label="文章导航">
                {prev ? (
                  <button
                    className={styles.navBtn}
                    onClick={() => handleJump(prev.id)}
                  >
                    <span className={styles.navLabel}>上一篇</span>
                    <span className={styles.navTitle}>{prev.title}</span>
                  </button>
                ) : null}
                {next ? (
                  <button
                    className={`${styles.navBtn} ${styles.navNext}`}
                    onClick={() => handleJump(next.id)}
                  >
                    <span className={styles.navLabel}>下一篇</span>
                    <span className={styles.navTitle}>{next.title}</span>
                  </button>
                ) : null}
              </nav>
            ) : null}
          </div>
          {detail.status === 'ready' && headings.length > 0 ? (
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
          {listStatus === 'loading' ? (
            <p className={styles.loadHint}>正在加载文章…</p>
          ) : null}
          {listStatus === 'error' ? (
            <div className={styles.stateBox}>
              <p>暂时无法加载，请稍后重试</p>
              <button type="button" className={styles.retryBtn} onClick={handleRetryList}>
                重试
              </button>
            </div>
          ) : null}
          {listStatus === 'ready' && sorted.length === 0 ? (
            <p className={styles.loadHint}>暂无文章</p>
          ) : null}
          {listStatus === 'ready'
            ? sorted.map((a, idx) => (
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
              ))
            : null}
        </div>
      )}
    </section>
  )
}

export default ArticleFeed
