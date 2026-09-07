import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { checkSession, logout, setAuthLostHandler } from './api'
import Login from './Login'
import './background.css'

const Dashboard = lazy(() => import('./Dashboard'))
const Articles = lazy(() => import('./Articles'))
const Editor = lazy(() => import('./Editor'))

const NAV = [
  { key: 'dashboard', label: '数据看板' },
  { key: 'articles', label: '文章管理' },
]

function LoadingFallback() {
  return <p className="bg-hint">正在加载…</p>
}

/**
 * /background 壳：鉴权状态 + 侧边栏 + 视图切换。
 * 整个目录被 App.jsx React.lazy 包裹，不进入主站首屏依赖（spec §7.5）。
 */
function Background() {
  const [authed, setAuthed] = useState(null) // null=检查中
  const [view, setView] = useState('dashboard')
  const [editingId, setEditingId] = useState(null)
  const [logoutError, setLogoutError] = useState('')

  useEffect(() => {
    setAuthLostHandler(() => {
      setAuthed(false)
      setView('dashboard')
      setEditingId(null)
    })
    let cancelled = false
    checkSession()
      .then(() => {
        if (!cancelled) setAuthed(true)
      })
      .catch(() => {
        if (!cancelled) setAuthed(false)
      })
    return () => {
      cancelled = true
      setAuthLostHandler(null)
    }
  }, [])

  const handleLogout = useCallback(async () => {
    setLogoutError('')
    try {
      await logout()
      setAuthed(false)
      setView('dashboard')
      setEditingId(null)
    } catch (err) {
      // 清 cookie 失败时保留当前管理状态，避免出现“假退出”。
      setLogoutError(err?.message || '退出登录失败，请重试')
    }
  }, [])

  const handleEdit = useCallback((id) => {
    setEditingId(id)
    setView('editor')
  }, [])

  const handleBackToArticles = useCallback(() => {
    setEditingId(null)
    setView('articles')
  }, [])

  if (authed === null) {
    return (
      <div className="bg-root">
        <p className="bg-hint">正在检查登录状态…</p>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="bg-root">
        <Login onSuccess={() => setAuthed(true)} />
      </div>
    )
  }

  return (
    <div className="bg-root">
      <aside className="bg-sidebar">
        <p className="bg-brand">
          后台<span className="bg-brandSub"> / BACKGROUND</span>
        </p>
        <nav className="bg-nav">
          {NAV.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`bg-navBtn${view === item.key || (item.key === 'articles' && view === 'editor') ? ' is-active' : ''}`}
              onClick={() => {
                setEditingId(null)
                setView(item.key)
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="bg-logoutArea">
          <button type="button" className="bg-logout" onClick={handleLogout}>
            退出登录
          </button>
          {logoutError ? <p className="bg-logoutError" role="alert">{logoutError}</p> : null}
        </div>
      </aside>
      <main className="bg-main">
        <Suspense fallback={<LoadingFallback />}>
          {view === 'dashboard' ? <Dashboard /> : null}
          {view === 'articles' ? <Articles onEdit={handleEdit} /> : null}
          {view === 'editor' && editingId ? (
            <Editor articleId={editingId} onBack={handleBackToArticles} />
          ) : null}
        </Suspense>
      </main>
    </div>
  )
}

export default Background
