/**
 * 后台 API 客户端（/background-api，spec §3.2/§5）。
 * - 会话 cookie 由浏览器自动携带（同源）；401 统一抛 UnauthorizedError，
 *   由 Background 壳捕获后踢回登录页。
 * - 看板分区接口失败返回 {ok:false}（分区错误态），不抛错，由各分区展示"读取失败"。
 */
const API_BASE = '/background-api'
const REQUEST_TIMEOUT_MS = 15000

export class UnauthorizedError extends Error {
  constructor() {
    super('登录已失效，请重新登录')
    this.unauthorized = true
  }
}

let authLostHandler = null
export function setAuthLostHandler(fn) {
  authLostHandler = fn
}

function notifyAuthLost() {
  if (typeof authLostHandler === 'function') authLostHandler()
}

async function request(path, { method = 'GET', body, query } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const url = query ? `${API_BASE}${path}?${new URLSearchParams(query)}` : `${API_BASE}${path}`
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      cache: 'no-store',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (response.status === 401) {
      notifyAuthLost()
      throw new UnauthorizedError()
    }
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload) {
      throw new Error(payload?.message || `请求失败：${response.status}`)
    }
    if (payload.ok !== true) {
      const detail = Array.isArray(payload.errors) ? payload.errors.join('；') : payload.message
      throw new Error(detail || '请求失败')
    }
    return payload
  } finally {
    clearTimeout(timer)
  }
}

// ---------- 鉴权 ----------
export async function login(password) {
  await request('/admin/login', { method: 'POST', body: { password } })
}

export async function logout() {
  await request('/admin/logout', { method: 'POST' })
}

export async function checkSession() {
  await request('/admin/session')
}

// ---------- 看板 ----------
export async function fetchStats(section, days) {
  return request(`/admin/stats/${section}`, { query: { days: String(days) } })
}

// ---------- 文章 ----------
export async function listAdminArticles() {
  const payload = await request('/admin/articles')
  return payload.articles || []
}

export async function getAdminArticle(id) {
  const payload = await request(`/admin/articles/${encodeURIComponent(id)}`)
  return payload.article
}

export async function createAdminArticle(input) {
  const payload = await request('/admin/articles', { method: 'POST', body: input })
  return payload.article
}

export async function updateAdminArticle(id, input) {
  const payload = await request(`/admin/articles/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: input,
  })
  return payload.article
}

export async function deleteAdminArticle(id) {
  await request(`/admin/articles/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ---------- 图片上传：二进制 body，文件名放 X-File-Name（spec §7.3） ----------
export async function uploadImage(articleId, file) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60000)
  try {
    const response = await fetch(
      `${API_BASE}/admin/upload/image?articleId=${encodeURIComponent(articleId)}`,
      {
        method: 'POST',
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name || 'image'),
        },
        body: file,
      }
    )
    if (response.status === 401) {
      notifyAuthLost()
      throw new UnauthorizedError()
    }
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload || payload.ok !== true) {
      throw new Error(payload?.message || `图片上传失败：${response.status}`)
    }
    return payload.url
  } finally {
    clearTimeout(timer)
  }
}
