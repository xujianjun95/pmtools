import { useCallback, useEffect, useMemo, useState } from 'react'
import { createAdminArticle, deleteAdminArticle, listAdminArticles, updateAdminArticle } from './api'

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/
const FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'published', label: '已上架' },
  { value: 'draft', label: '草稿' },
]

function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parseTags(raw) {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string' && raw) {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

/** 新建文章：先创建草稿拿到固定 slug，再进编辑器传图（spec §7.3） */
function NewArticleDialog({ onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleCreate = async (event) => {
    event.preventDefault()
    const id = slug.trim()
    if (!SLUG_RE.test(id)) {
      setError('slug 只允许小写字母/数字/短横线（1-64 位）')
      return
    }
    if (!title.trim()) {
      setError('标题必填')
      return
    }
    setBusy(true)
    setError('')
    try {
      const article = await createAdminArticle({
        id,
        title: title.trim(),
        summary: '',
        tags: [],
        cover: '',
        content_md: '',
        status: 'draft',
      })
      onCreated(article.id)
    } catch (err) {
      setError(err?.message || '创建失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-dialogMask" onClick={onClose}>
      <form className="bg-dialog" onClick={(e) => e.stopPropagation()} onSubmit={handleCreate}>
        <h2 className="bg-dialogTitle">新建文章</h2>
        <label className="bg-field">
          <span className="bg-fieldLabel">标题</span>
          <input
            className="bg-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="文章标题"
            autoFocus
          />
        </label>
        <label className="bg-field">
          <span className="bg-fieldLabel">slug（创建后固定，不可修改）</span>
          <input
            className="bg-input bg-mono"
            value={slug}
            onChange={(e) => setSlug(e.target.value.trim())}
            placeholder="如 my-first-post"
          />
        </label>
        {error ? <p className="bg-formError">{error}</p> : null}
        <div className="bg-dialogActions">
          <button type="button" className="bg-btnGhost" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="bg-btnPrimary" disabled={busy}>
            {busy ? '创建中…' : '创建草稿并编辑'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Articles({ onEdit }) {
  const [articles, setArticles] = useState([])
  const [status, setStatus] = useState('loading') // loading | error | ready
  const [filter, setFilter] = useState('all')
  const [showNew, setShowNew] = useState(false)
  const [opError, setOpError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setStatus('loading')
    setOpError('')
    try {
      setArticles(await listAdminArticles())
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    listAdminArticles()
      .then((list) => {
        if (!cancelled) {
          setArticles(list)
          setStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const list = filter === 'all' ? articles : articles.filter((a) => a.status === filter)
    return [...list].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  }, [articles, filter])

  const handleToggleStatus = async (article) => {
    const next = article.status === 'published' ? 'draft' : 'published'
    setBusyId(article.id)
    setOpError('')
    try {
      const updated = await updateAdminArticle(article.id, { status: next })
      setArticles((list) => list.map((a) => (a.id === article.id ? updated : a)))
    } catch (err) {
      setOpError(`「${article.title}」${next === 'published' ? '上架' : '下架'}失败：${err?.message || '未知错误'}`)
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (article) => {
    if (confirmDeleteId !== article.id) {
      setConfirmDeleteId(article.id)
      return
    }
    setConfirmDeleteId(null)
    setBusyId(article.id)
    setOpError('')
    try {
      await deleteAdminArticle(article.id)
      setArticles((list) => list.filter((a) => a.id !== article.id))
    } catch (err) {
      setOpError(`「${article.title}」删除失败：${err?.message || '未知错误'}`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <header className="bg-pageHead">
        <h1 className="bg-pageTitle">文章管理</h1>
        <button type="button" className="bg-btnPrimary" onClick={() => setShowNew(true)}>
          新建
        </button>
      </header>

      <div className="bg-days" role="group" aria-label="状态筛选">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`bg-daysBtn${filter === f.value ? ' is-active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {opError ? <p className="bg-formError">{opError}</p> : null}

      {status === 'loading' ? <p className="bg-hint">正在加载…</p> : null}
      {status === 'error' ? (
        <div className="bg-stateBox">
          <p>读取失败</p>
          <button type="button" className="bg-btnGhost" onClick={load}>
            重试
          </button>
        </div>
      ) : null}
      {status === 'ready' && filtered.length === 0 ? (
        <p className="bg-hint">暂无文章</p>
      ) : null}

      {status === 'ready' && filtered.length > 0 ? (
        <div className="bg-tableWrap">
          <table className="bg-table">
            <colgroup>
              <col className="bg-colTitle" />
              <col className="bg-colStatus" />
              <col className="bg-colTags" />
              <col className="bg-colTime" />
              <col className="bg-colOps" />
            </colgroup>
            <thead>
              <tr>
                <th>标题</th>
                <th>状态</th>
                <th>标签</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td className="bg-cellTitle" title={a.id}>
                    {a.title}
                  </td>
                  <td>
                    <span className={`bg-status${a.status === 'published' ? ' is-published' : ''}`}>
                      {a.status === 'published' ? '已上架' : '草稿'}
                    </span>
                  </td>
                  <td className="bg-cellMuted bg-cellTags">{parseTags(a.tags).join(' · ') || '—'}</td>
                  <td className="bg-cellMuted bg-cellTime">{formatTime(a.updated_at)}</td>
                  <td>
                    <div className="bg-rowOps">
                      <button
                        type="button"
                        className="bg-linkBtn"
                        onClick={() => onEdit(a.id)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="bg-linkBtn"
                        disabled={busyId === a.id}
                        onClick={() => handleToggleStatus(a)}
                      >
                        {a.status === 'published' ? '下架' : '上架'}
                      </button>
                      <button
                        type="button"
                        className={`bg-linkBtn${confirmDeleteId === a.id ? ' is-danger' : ''}`}
                        disabled={busyId === a.id}
                        onClick={() => handleDelete(a)}
                        onBlur={() => {
                          if (confirmDeleteId === a.id) setConfirmDeleteId(null)
                        }}
                      >
                        {confirmDeleteId === a.id ? '确认删除？' : '删除'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {showNew ? (
        <NewArticleDialog onClose={() => setShowNew(false)} onCreated={onEdit} />
      ) : null}
    </div>
  )
}

export default Articles
