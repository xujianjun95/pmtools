/**
 * 文章后台 API 客户端（spec §7.6）。
 * 列表不含正文，详情按需加载；API 失败时由调用方展示"暂时无法加载"，
 * 不回退本地旧文章（防止已下架文章复活）。
 */
const API_BASE = '/background-api'
const REQUEST_TIMEOUT_MS = 8000

async function requestJson(path) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
    if (response.status === 404) {
      const notFoundError = new Error('文章不存在或已下架')
      notFoundError.notFound = true
      throw notFoundError
    }
    if (!response.ok) {
      throw new Error(`文章接口请求失败：${response.status}`)
    }
    const payload = await response.json()
    if (!payload || payload.ok !== true || !Array.isArray(payload.articles) && !payload.article) {
      throw new Error('文章接口返回格式异常')
    }
    return payload
  } finally {
    clearTimeout(timer)
  }
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

function toArticle(raw) {
  return {
    id: raw.id,
    title: raw.title || '',
    summary: raw.summary || '',
    tags: parseTags(raw.tags),
    cover: raw.cover || '',
    date: raw.published_at || raw.date || '',
    content: raw.content_md ?? raw.content ?? '',
  }
}

/** 已上架文章列表（不含正文），按发布日期倒序。 */
export async function fetchArticleList() {
  const payload = await requestJson('/articles')
  return payload.articles
    .filter((raw) => raw && raw.id && raw.title)
    .map(toArticle)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
}

/**
 * 单篇详情（含正文）。
 * 404 时抛出带 notFound=true 的错误，供 UI 区分"不存在/已下架"与"加载失败"。
 */
export async function fetchArticleDetail(id) {
  const payload = await requestJson(`/articles/${encodeURIComponent(id)}`)
  if (!payload.article || !payload.article.id) {
    throw new Error('文章详情返回格式异常')
  }
  return toArticle(payload.article)
}
