import { useState, useCallback } from 'react'
import Modal from '../../../components/common/Modal'
import styles from './NewsItem.module.css'

const API_BASE = import.meta.env.VITE_NEWS_API_URL?.replace(/\/api\/news$/, '') || 'https://api.pmtools.com.cn'

function NewsItem({ item, index }) {
  const [expanded, setExpanded] = useState(false)
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const num = String(index + 1).padStart(2, '0')

  const handleSummarize = useCallback(async (e) => {
    e.stopPropagation()
    if (summary) {
      setModalOpen(true)
      return
    }
    setSummaryLoading(true)
    setSummaryError(false)
    setModalOpen(true)
    try {
      const res = await fetch(`${API_BASE}/api/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.url, title: item.title }),
      })
      if (!res.ok) throw new Error('请求失败')
      const data = await res.json()
      setSummary(data.summary)
    } catch {
      setSummaryError(true)
    } finally {
      setSummaryLoading(false)
    }
  }, [item.url, item.title, summary])

  const handleCloseModal = useCallback(() => {
    setModalOpen(false)
  }, [])

  return (
    <>
      <article
        className={styles.item}
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
      >
        <span className={styles.num}>{num}</span>
        <div className={styles.body}>
          <h4 className={styles.title}>{item.title}</h4>
          <div className={styles.summaryRow}>
            <p className={styles.summary}>「{item.summary}」</p>
            <div className={styles.meta}>
              <span className={styles.source}>{item.source}</span>
              <span className={styles.sep} />
              <time className={styles.date}>
                {new Date(item.publishedAt).toLocaleDateString('zh-CN', {
                  month: '2-digit',
                  day: '2-digit',
                })}
              </time>
            </div>
          </div>
          <div className={`${styles.expanded} ${expanded ? styles.expandedOpen : ''}`}>
            <a
              className={styles.link}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              阅读原文 →
            </a>
            <button
              className={styles.aiBtn}
              onClick={handleSummarize}
            >
              AI 总结
            </button>
          </div>
        </div>
      </article>

      <Modal open={modalOpen} onClose={handleCloseModal} title="AI 总结">
        {summaryLoading && <p className={styles.modalLoading}>正在生成总结…</p>}
        {summaryError && <p className={styles.modalError}>总结生成失败，请稍后再试</p>}
        {summary && <p className={styles.modalText}>{summary}</p>}
      </Modal>
    </>
  )
}

export default NewsItem
