import { useState } from 'react'
import { login } from './api'

function Login({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError('')
    try {
      await login(password)
      onSuccess()
    } catch (err) {
      setError(err?.message || '登录失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-loginWrap">
      <form className="bg-loginCard" onSubmit={handleSubmit}>
        <h1 className="bg-loginTitle">后台管理</h1>
        <p className="bg-loginSub">PMTOOLS · BACKGROUND</p>
        <input
          className="bg-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="管理员密码"
          autoComplete="current-password"
          autoFocus
        />
        {error ? <p className="bg-formError">{error}</p> : null}
        <button className="bg-btnPrimary" type="submit" disabled={busy || !password}>
          {busy ? '登录中…' : '登录'}
        </button>
      </form>
    </div>
  )
}

export default Login
