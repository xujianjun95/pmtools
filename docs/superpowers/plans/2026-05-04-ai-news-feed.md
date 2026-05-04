# 首页 AI 资讯模块实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在聚合页首页底部新增一个「资讯」模块，展示 20 条经 AI 筛选和总结的 AI + 泛科技资讯。

**Architecture:** RSSHub 自建实例抓取资讯源 → kada 后端定时拉取并调用 DeepSeek 筛选总结 → 缓存并提供 /api/news 接口 → 聚合页前端调用接口渲染资讯列表。

**Tech Stack:** Node.js (Express), RSSHub (Docker), DeepSeek API, React 19, CSS Modules

---

## 文件结构

### kada 服务器（后端）

| 文件 | 操作 | 职责 |
|------|------|------|
| `server.js` | 修改 | 新增 /api/news 接口和定时任务逻辑 |
| `news/fetcher.js` | 新建 | RSS 抓取逻辑（从 RSSHub 拉取资讯） |
| `news/filter.js` | 新建 | DeepSeek 筛选和总结逻辑 |
| `news/cache.js` | 新建 | 资讯缓存管理 |
| `package.json` | 修改 | 新增 rss-parser 依赖 |

### 聚合页（前端）

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/pages/Home/index.jsx` | 修改 | 引入 NewsFeed 组件 |
| `src/pages/Home/components/NewsFeed.jsx` | 新建 | 资讯模块主体（标题区 + 列表） |
| `src/pages/Home/components/NewsItem.jsx` | 新建 | 单条资讯卡片（标签+标题+总结+日期，可展开） |
| `src/pages/Home/components/NewsFeed.module.css` | 新建 | 资讯模块样式 |
| `src/pages/Home/components/NewsItem.module.css` | 新建 | 资讯卡片样式 |

---

## Task 1: 部署 RSSHub 实例

**前置条件：** kada 服务器上有 Docker 环境

- [ ] **Step 1: 在 kada 项目目录下创建 docker-compose.yml**

```yaml
version: '3'
services:
  rsshub:
    image: diygod/rsshub
    restart: always
    ports:
      - '1200:1200'
    environment:
      NODE_ENV: production
      CACHE_TYPE: memory
      CACHE_EXPIRE: 600
```

- [ ] **Step 2: 启动 RSSHub**

```bash
cd /Users/xujianjun/Desktop/Project/pmtools/kada
docker-compose up -d
```

- [ ] **Step 3: 验证 RSSHub 可用**

```bash
curl http://localhost:1200/jiqizhixin
curl http://localhost:1200/qbitai
curl http://localhost:1200/36kr/motif/452
```

预期：返回 RSS XML 数据

---

## Task 2: 安装 rss-parser 依赖

- [ ] **Step 1: 安装依赖**

```bash
cd /Users/xujianjun/Desktop/Project/pmtools/kada
npm install rss-parser
```

- [ ] **Step 2: 验证安装**

```bash
node -e "const Parser = require('rss-parser'); console.log('ok')"
```

预期：输出 `ok`

---

## Task 3: 创建 RSS 抓取模块

**文件：** `kada/news/fetcher.js`

- [ ] **Step 1: 创建 news 目录**

```bash
mkdir -p /Users/xujianjun/Desktop/Project/pmtools/kada/news
```

- [ ] **Step 2: 编写 fetcher.js**

```javascript
const Parser = require('rss-parser');
const parser = new Parser({ timeout: 10000 });

const RSSHUB_BASE = process.env.RSSHUB_URL || 'http://localhost:1200';

const SOURCES = [
  { name: '机器之心', url: `${RSSHUB_BASE}/jiqizhixin`, category: 'AI' },
  { name: '量子位', url: `${RSSHUB_BASE}/qbitai`, category: 'AI' },
  { name: '36kr', url: `${RSSHUB_BASE}/36kr/motif/452`, category: '科技' },
];

async function fetchAllSources() {
  const results = await Promise.allSettled(
    SOURCES.map(async (source) => {
      try {
        const feed = await parser.parseURL(source.url);
        return feed.items.slice(0, 15).map((item) => ({
          title: item.title || '',
          description: (item.contentSnippet || item.content || '').slice(0, 300),
          source: source.name,
          category: source.category,
          publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
          url: item.link || '',
        }));
      } catch (err) {
        console.error(`[fetcher] ${source.name} 抓取失败:`, err.message);
        return [];
      }
    })
  );

  return results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value);
}

module.exports = { fetchAllSources };
```

- [ ] **Step 3: 验证抓取逻辑**

```bash
cd /Users/xujianjun/Desktop/Project/pmtools/kada
node -e "const { fetchAllSources } = require('./news/fetcher'); fetchAllSources().then(items => console.log('抓取到', items.length, '条')).catch(console.error)"
```

预期：输出抓取到的资讯条数

---

## Task 4: 创建 DeepSeek 筛选模块

**文件：** `kada/news/filter.js`

- [ ] **Step 1: 编写 filter.js**

```javascript
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

async function filterAndSummarize(items) {
  if (!items.length) return [];

  const itemList = items
    .map((item, i) => `${i + 1}. [${item.source}] ${item.title}\n   ${item.description}`)
    .join('\n');

  const prompt = `你是一个 AI 资讯编辑。以下是 ${items.length} 条最新资讯，请从中筛选出最有价值的 20 条。

筛选标准：
- 优先选择影响力大的内容（大公司发布、重大技术突破、行业趋势）
- 去掉水文、广告、重复内容
- 保持 AI 和泛科技的平衡

对每条筛选出的资讯，请生成：
1. 一个分类标签（从以下选择：AI、硬件、应用、研究、行业、开源）
2. 50 字以内的中文总结

资讯列表：
${itemList}

请严格按以下 JSON 格式返回，不要输出其他内容：
{
  "selected": [
    {
      "index": 1,
      "category": "AI",
      "summary": "50字以内的总结"
    }
  ]
}`;

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[filter] DeepSeek API error:', response.status, errorText);
      return items.slice(0, 20).map((item) => ({
        ...item,
        category: item.category || 'AI',
        summary: item.description.slice(0, 50),
      }));
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[filter] 无法解析 AI 返回的 JSON');
      return items.slice(0, 20).map((item) => ({
        ...item,
        category: item.category || 'AI',
        summary: item.description.slice(0, 50),
      }));
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return (parsed.selected || [])
      .filter((s) => s.index >= 1 && s.index <= items.length)
      .map((s) => ({
        ...items[s.index - 1],
        category: s.category || 'AI',
        summary: (s.summary || '').slice(0, 50),
      }));
  } catch (err) {
    console.error('[filter] 筛选失败:', err.message);
    return items.slice(0, 20).map((item) => ({
      ...item,
      category: item.category || 'AI',
      summary: item.description.slice(0, 50),
    }));
  }
}

module.exports = { filterAndSummarize };
```

- [ ] **Step 2: 验证筛选逻辑（需要先启动 RSSHub）**

```bash
cd /Users/xujianjun/Desktop/Project/pmtools/kada
node -e "
const { fetchAllSources } = require('./news/fetcher');
const { filterAndSummarize } = require('./news/filter');
fetchAllSources()
  .then(filterAndSummarize)
  .then(items => {
    console.log('筛选后:', items.length, '条');
    items.forEach((item, i) => console.log(i + 1, item.category, item.title, '-', item.summary));
  })
  .catch(console.error);
"
```

预期：输出筛选后的 20 条资讯，每条有分类和总结

---

## Task 5: 创建缓存模块和 /api/news 接口

**文件：** `kada/news/cache.js`

- [ ] **Step 1: 编写 cache.js**

```javascript
const { fetchAllSources } = require('./fetcher');
const { filterAndSummarize } = require('./filter');

let cachedNews = null;
let lastUpdated = null;

const UPDATE_INTERVAL = 20 * 60 * 1000; // 20 分钟

async function refreshNews() {
  console.log('[news] 开始刷新资讯...');
  try {
    const rawItems = await fetchAllSources();
    console.log(`[news] 抓取到 ${rawItems.length} 条原始资讯`);

    const filtered = await filterAndSummarize(rawItems);
    console.log(`[news] AI 筛选后 ${filtered.length} 条`);

    cachedNews = filtered;
    lastUpdated = new Date().toISOString();
    console.log('[news] 资讯刷新完成');
  } catch (err) {
    console.error('[news] 刷新失败:', err.message);
  }
}

function getCachedNews() {
  return {
    updatedAt: lastUpdated,
    items: cachedNews || [],
  };
}

function startAutoRefresh() {
  refreshNews();
  setInterval(refreshNews, UPDATE_INTERVAL);
}

module.exports = { getCachedNews, startAutoRefresh, refreshNews };
```

- [ ] **Step 2: 在 server.js 中注册 /api/news 接口和启动定时任务**

在 `server.js` 末尾（`app.listen` 之前）添加：

```javascript
// --- AI 资讯模块 ---
const { getCachedNews, startAutoRefresh } = require('./news/cache');

app.get('/api/news', (req, res) => {
  res.json(getCachedNews());
});

startAutoRefresh();
```

- [ ] **Step 3: 启动服务器验证接口**

```bash
cd /Users/xujianjun/Desktop/Project/pmtools/kada
node server.js &
sleep 3
curl http://localhost:3000/api/news | head -c 500
```

预期：返回 JSON 格式的资讯数据

---

## Task 6: 创建 NewsItem 组件

**文件：** `pmtools 聚合页/src/pages/Home/components/NewsItem.jsx`

- [ ] **Step 1: 编写 NewsItem.jsx**

```jsx
import { useState } from 'react'
import styles from './NewsItem.module.css'

function NewsItem({ item }) {
  const [expanded, setExpanded] = useState(false)

  return (
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
      <span className={styles.category}>{item.category}</span>
      <div className={styles.body}>
        <h4 className={styles.title}>{item.title}</h4>
        <p className={styles.summary}>{item.summary}</p>
        {expanded && (
          <div className={styles.expanded}>
            <p className={styles.description}>{item.description}</p>
            <a
              className={styles.link}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              阅读原文 →
            </a>
          </div>
        )}
      </div>
      <time className={styles.date}>
        {new Date(item.publishedAt).toLocaleDateString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
        })}
      </time>
    </article>
  )
}

export default NewsItem
```

---

## Task 7: 创建 NewsItem 样式

**文件：** `pmtools 聚合页/src/pages/Home/components/NewsItem.module.css`

- [ ] **Step 1: 编写样式**

```css
.item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 18px;
  background: var(--surface);
  border-radius: 10px;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.15s ease;
}

.item:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-1px);
}

.category {
  flex-shrink: 0;
  background: var(--accent-subtle);
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  padding: 2px 8px;
  border-radius: 4px;
  margin-top: 2px;
}

.body {
  flex: 1;
  min-width: 0;
}

.title {
  margin: 0 0 4px;
  font-family: var(--font-body);
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-primary);
}

.summary {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--text-muted);
}

.expanded {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
}

.description {
  margin: 0 0 8px;
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--text-secondary);
}

.link {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--accent);
  letter-spacing: 0.02em;
}

.link:hover {
  color: var(--accent-hover);
}

.date {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 2px;
}

@media (max-width: 768px) {
  .item {
    flex-wrap: wrap;
    gap: 8px;
    padding: 14px 16px;
  }

  .date {
    order: -1;
    width: 100%;
    margin-bottom: 2px;
  }
}
```

---

## Task 8: 创建 NewsFeed 组件

**文件：** `pmtools 聚合页/src/pages/Home/components/NewsFeed.jsx`

- [ ] **Step 1: 编写 NewsFeed.jsx**

```jsx
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
    <section className={styles.section}>
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
          <NewsItem key={item.id || index} item={item} />
        ))}
      </div>
    </section>
  )
}

export default NewsFeed
```

---

## Task 9: 创建 NewsFeed 样式

**文件：** `pmtools 聚合页/src/pages/Home/components/NewsFeed.module.css`

- [ ] **Step 1: 编写样式**

```css
.section {
  scroll-margin-top: var(--layout-top-offset);
  display: flex;
  align-items: flex-start;
  gap: clamp(24px, 4vw, 40px);
  width: 100%;
  margin-top: 48px;
  margin-bottom: 28px;
}

.header {
  flex: 0 0 clamp(128px, 14vw, 160px);
  position: sticky;
  top: calc(var(--layout-top-offset) + 16px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 1;
}

.title {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: clamp(1.15rem, 2.2vw, 1.5rem);
  font-weight: 400;
  letter-spacing: 0.08em;
  color: var(--text-primary);
  line-height: 1.2;
}

.count {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 400;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.desc {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--text-muted);
}

.list {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton {
  height: 64px;
  background: var(--bg-alt);
  border-radius: 10px;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.error {
  padding: 24px;
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .section {
    flex-direction: column;
    gap: 20px;
    margin-top: 28px;
  }

  .header {
    position: static;
    flex: none;
    width: 100%;
    top: auto;
  }
}
```

---

## Task 10: 将资讯模块集成到首页

**文件：** `pmtools 聚合页/src/pages/Home/index.jsx`

- [ ] **Step 1: 修改 HomePage 组件**

```jsx
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BUILDS_SECTION_HASH,
  scrollToBuildsGallery,
} from '../../utils/scrollBuildsGallery'
import HomeIntro from './components/HomeIntro'
import ProjectsGrid from './components/ProjectsGrid'
import NewsFeed from './components/NewsFeed'

function HomePage() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.pathname !== '/') return undefined

    const fromHash = location.hash === BUILDS_SECTION_HASH
    const fromState = Boolean(location.state?.scrollToBuilds)
    if (!fromHash && !fromState) return undefined

    const id = window.setTimeout(() => {
      scrollToBuildsGallery()
      navigate(
        { pathname: '/', search: location.search },
        { replace: true, state: {} }
      )
    }, 0)

    return () => window.clearTimeout(id)
  }, [
    location.pathname,
    location.hash,
    location.search,
    location.state?.scrollToBuilds,
    navigate,
  ])

  return (
    <>
      <HomeIntro />
      <ProjectsGrid />
      <NewsFeed />
    </>
  )
}

export default HomePage
```

- [ ] **Step 2: 启动聚合页开发服务器验证**

```bash
cd "/Users/xujianjun/Desktop/Project/pmtools/pmtools 聚合页"
npm run dev
```

预期：首页底部出现资讯模块，骨架屏加载后显示资讯列表

- [ ] **Step 3: 验证交互**

- 点击资讯卡片能展开/收起
- 展开后显示原文链接
- 暗色/亮色主题切换正常
- 移动端布局正常

---

## Task 11: 提交代码

- [ ] **Step 1: 提交 kada 后端代码**

```bash
cd /Users/xujianjun/Desktop/Project/pmtools/kada
git add news/ server.js package.json package-lock.json docker-compose.yml
git commit -m "feat: 新增 AI 资讯接口，RSSHub 抓取 + DeepSeek 筛选总结"
```

- [ ] **Step 2: 提交聚合页前端代码**

```bash
cd "/Users/xujianjun/Desktop/Project/pmtools/pmtools 聚合页"
git add src/pages/Home/
git commit -m "feat: 首页底部新增 AI 资讯模块"
```
