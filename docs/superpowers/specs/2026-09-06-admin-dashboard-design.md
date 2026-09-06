# pmtools 后台管理系统设计：数据看板 + 文章管理

- 日期：2026-09-06
- 状态：已经用户逐节确认（架构形态、存储方案、鉴权、编辑器、布局 A）
- 路由：`https://www.pmtools.com.cn/background`

## 1. 背景与目标

pmtools 主站是纯静态 SPA（Vite + React 19），目前没有自己的后台。本次新增一个管理员后台，一期只做两块：

1. **文章管理**：新增文章、标签、富文本编辑、本机 .md 文件导入、图片上传、上下架。
2. **数据看板**：全站流量（PV/UV/独立 IP/停留时长）、造物与详情页行为、QDII 订阅、鉴往游玩、新闻速览与外链跳转。

单管理员（站长本人），不需要账号体系。

## 2. 范围

### 2.1 做

- `/background` 独立路由 + 管理员登录鉴权
- 文章 CRUD、上下架（status 切换）、标签、封面
- Vditor 所见即所得编辑器（存 Markdown）
- .md 文件（含图片）导入，兼容黑曜石语法
- 图片上传 → 阿里云 OSS（bucket `pmtools27`）
- 全站埋点扩展（5 个新事件）+ 看板聚合展示
- 前台文章读取源从 OSS manifest 切到后台 API

### 2.2 明确不做（YAGNI）

多人账号、评论、文章阅读数统计、定时发布、可拖拽 widget、OSS 浏览器直传、找回密码流程。

## 3. 架构总览（双服务分工）

```
浏览器
 ├─ 主站 SPA（/background 懒加载后台 chunk，不套主站布局）
 ├─ 埋点 → POST /api/track → qdii-notify :3100（现有服务，仅扩白名单）
 └─ 后台请求 → /background-api/ → pmtools-admin :3200（新服务）
                                   ├─ articles.db（文章，读写）
                                   ├─ 只读挂载 subscribers.db + analytics.db（看板聚合）
                                   └─ 图片 → OSS（服务端转传）
```

- **qdii-notify（生产关键服务）**：唯一改动是埋点白名单加事件名/meta 键 + 新增 `site_events` 表 + 对应测试。订阅、通知逻辑零触碰。
- **pmtools-admin（新）**：Express + better-sqlite3，风格对齐 qdii-notify。持有 ADMIN_PASSWORD 与 OSS 凭据（.env，600）。
- **nginx**：新增精确 `location /background-api/` → `127.0.0.1:3200`（不进 `/api/` 通配，避免打到 kada:3000）。

## 4. 数据模型

### 4.1 articles.db（admin 服务持有）

```sql
CREATE TABLE articles (
  id           TEXT PRIMARY KEY,      -- slug，如 codex-install-guide
  title        TEXT NOT NULL,
  summary      TEXT DEFAULT '',
  tags         TEXT DEFAULT '[]',     -- JSON 数组
  cover        TEXT DEFAULT '',       -- OSS 图片 URL
  content_md   TEXT NOT NULL,         -- Markdown 正文
  status       TEXT DEFAULT 'draft',  -- draft=草稿/下架，published=上架
  published_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
```

- 上下架 = status 在 draft/published 间切换，下架不删内容。
- 删除 = 硬删除 + 前端二次确认；OSS 上已传图片不回收（孤儿可接受）。
- id（slug）可编辑，新建时按标题/日期自动建议。

### 4.2 analytics.db 变更（qdii-notify 持有，admin 只读）

新增 `site_events` 表（不动现有 `dca_events`，避免 ALTER 活表）：

```sql
CREATE TABLE IF NOT EXISTS site_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event       TEXT NOT NULL,
  visitor_id  TEXT NOT NULL,
  visit_id    TEXT NOT NULL DEFAULT '',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  meta        TEXT NOT NULL DEFAULT '{}',
  ip          TEXT NOT NULL DEFAULT '',   -- 服务端补记，仅用于独立 IP 去重
  created_at  TEXT NOT NULL
);
```

校验沿用现有 `parseTrackPayload` 姿势：事件名白名单、visitor_id 强制 UUID、时长 6 小时封顶、meta 键白名单、非法静默丢弃。

## 5. API 设计（pmtools-admin）

统一前缀 `/background-api/`，同源反代，无 CORS 需求。

| 分组 | 端点 | 说明 |
|------|------|------|
| 公开 | `GET /background-api/articles` | 已上架列表（无正文），前台文章区数据源 |
| 公开 | `GET /background-api/articles/:id` | 单篇详情（含 content_md） |
| 鉴权 | `POST /background-api/admin/login` | 密码换签名 cookie，限流 |
| 鉴权 | `POST /background-api/admin/logout` | 清 cookie |
| 管理 | `GET /background-api/admin/articles` | 全量（含草稿/下架） |
| 管理 | `POST /background-api/admin/articles` | 新建 |
| 管理 | `PUT /background-api/admin/articles/:id` | 更新 / 上下架 |
| 管理 | `DELETE /background-api/admin/articles/:id` | 删除 |
| 图片 | `POST /background-api/admin/upload/image` | multipart 图片 → OSS `articles/images/<article-id>/`，返回 URL |
| 看板 | `GET /background-api/admin/stats/summary?days=7` | PV/UV/独立 IP/人均停留 + 趋势序列；days=7/30，days=0 表示累计 |
| 看板 | `GET /background-api/admin/stats/projects` | 造物点击 TOP + 详情页停留 |
| 看板 | `GET /background-api/admin/stats/qdii` | 活跃订阅/退订/趋势 |
| 看板 | `GET /background-api/admin/stats/dca` | 游玩人数/人均时长/人均次数 |
| 看板 | `GET /background-api/admin/stats/content` | 新闻速览点击/外链跳转 |

看板聚合对 qdii 的两个库**只读**打开（better-sqlite3 `readonly: true`，WAL 支持多进程并发读，不碰写锁）。单分区查询失败返回该分区空数据，不影响其他分区。

## 6. 埋点事件规格

复用 `src/utils/analytics.js`（泛化为全站工具）：visitor_id 存 localStorage、visit_id 每次页面进入重生成、可见时长计时、批量 sendBeacon、开发环境不上报、静默失败。

| 事件 | meta | 用途 |
|------|------|------|
| `page_view` | `path` | PV/UV/独立 IP；服务端补记 ip |
| `page_leave` | `path`，duration_ms | 页面/首页停留（服务端按 visit+path 取 MAX 去重） |
| `project_click` | `project_id` | 造物卡片点击 |
| `news_quickview` | `news_id` | 新闻速览按钮 |
| `outbound_click` | `url` | 站外跳转（截断存 40 字符内） |

meta 白名单新增键：`path`、`project_id`、`news_id`、`url`。

## 7. 前端设计

### 7.1 路由与代码组织

- 主站仓库内新增 `/background` 路由，`React.lazy` 独立 chunk，主站包体积不受影响。
- 后台页面不套主站 `MainLayout`，自带侧边栏壳。
- 页面：看板（默认）、文章列表、新建、编辑、登录。

### 7.2 布局（已选方案 A）

左侧边栏（数据看板 / 文章管理 / 退出登录）+ 看板单页滚动，四个分区自上而下：**全站流量 → 内容行为（造物/新闻/外链）→ QDII 订阅 → 鉴往**。顶部时间范围选择器：近 7 天（默认）/ 近 30 天 / 累计。

文章列表页：状态筛选（全部/已上架/草稿）+「新建」「导入 .md」按钮 + 表格（标题/标签/状态/更新时间/编辑·上下架·删除）。

### 7.3 文章编辑器

- **Vditor** 所见即所得模式，存储为标准 Markdown；工具栏按需裁剪。
- 图片：粘贴/选择 → 上传钩子 → `/admin/upload/image` → 插入 OSS URL。
- 表单字段：标题、slug、标签、摘要、封面、正文。

### 7.4 .md 导入（兼容黑曜石）

- 支持多选文件：选 .md + 若干图片。
- 解析 YAML frontmatter（title/date/tags/summary）自动填表单；YAML 头剥离。
- `![[图片.png]]` 与 `![](图片.png)` 链接自动改写：图片文件上传 OSS 后替换为稳定 URL；找不到对应文件的图片列入警示清单。
- 黑曜石写作 → 后台导入 → 预览 → 上架；`npm run articles:publish` 脚本退役（保留一个版本周期后删除）。

### 7.5 前台渲染器升级

- `src/utils/markdown.jsx`（手写，仅 7 种语法）升级为 **markdown-it + markdown-it-mark**（保留 `==高亮==`）。
- 保留现有增强：h2/h3 标题锚点目录（TOC）、中文标点不吃进链接、裸 URL 自动链接。
- 回归标准：现有文章渲染结果不变。

### 7.6 前台文章数据源切换

文章页从 OSS manifest 改为 `GET /background-api/articles`（列表）+ `/:id`（正文）；失败时回退 `src/data/articles.js` 本地兜底，文章区永不白屏。`VITE_ARTICLES_MANIFEST_URL` 机制随之退役。

## 8. 鉴权设计

- `ADMIN_PASSWORD` 存服务器 `.env`（600）。
- 登录限流（按 IP，10 次/分钟）；成功后发 HMAC 签名 cookie：httpOnly + Secure + SameSite=Lax，有效期 7 天。
- 所有 `/admin/*` 端点经中间件验签；401 时前端统一跳登录页。
- 无用户表、无找回流程；忘记密码 = 改 .env 重启。

## 9. 错误处理

- 埋点全部静默失败，不影响页面体验。
- 看板分区级降级：任一数据源异常只影响本分区（显示"暂无数据"）。
- 图片上传失败明确报错可重试；正文保存不依赖图片上传。
- admin 服务 systemd 自动重启；SQLite WAL 模式。

## 10. 测试

- admin 服务：`node --test` 单测（对齐 qdii-notify 风格）——鉴权中间件、登录限流、文章 CRUD、上传参数校验、stats 聚合（fixture 库）。
- qdii-notify：`parseTrackPayload` 测试扩展（新事件 + 新 meta 键 + ip 补记）。
- 前端：markdown-it 渲染回归（高亮/锚点/标点）、埋点工具单测、路由守卫。
- 上线前手动 smoke 清单（登录、发文、上下架、前台可见性、看板五个分区）。

## 11. 部署

- 新目录 `/opt/pmtools-admin`，systemd unit `pmtools-admin`，端口 3200。
- nginx 新增精确 `location /background-api/` → `127.0.0.1:3200`。
- `.env`：ADMIN_PASSWORD、OSS_ACCESS_KEY_ID/SECRET、OSS_BUCKET、端口、DB 路径。
- 前端照旧 scp assets + index.html；`/background` 走 SPA fallback（上线时验证）。
- `articles.db` 纳入服务器现有备份节奏。

## 12. 红线与风险

- **红线**：不影响线上用户。qdii-notify 改动仅限 analytics.js（白名单 + site_events 表）与测试；发布错峰，先部署 admin 服务再发前端。
- IP 仅用于去重计数，看板不展示 IP 明细。
- 新代码过 Mimosa 推送门禁（SQL 用完整固定串、HTTP 收口独立模块）。
- 只读挂载 qdii 库属于跨服务文件级耦合：目录结构变更需同步两处，文档中已标注。

## 13. 决策记录

| 决策 | 结论 | 关键理由 |
|------|------|----------|
| 文章读取路径 | 后台 API 出内容（A2） | 数据面统一、实时生效、后续扩展容易；前台保留兜底 |
| 文章正文存储 | 服务器 SQLite | 结构化数据的行业常规；与订阅/埋点库同栈 |
| 图片存储 | OSS（bucket pmtools27） | 不吃 ECS 小水管带宽；服务端转传免 CORS、免浏览器凭据 |
| 服务形态 | 双服务（admin 独立于 qdii-notify） | 爆炸半径隔离，守护"不影响线上用户"红线 |
| 编辑器 | Vditor（所见即所得 → Markdown） | 兼顾富文本体验与 Markdown 存储链路（黑曜石/渲染器） |
| 渲染器 | markdown-it 替换手写渲染器 | 编辑器产出的表格/代码块需要完整语法支持 |
| 后台布局 | 侧边栏 + 看板单页滚动（方案 A） | 指标就四组，一屏滚完比切 Tab 快 |
| 埋点通道 | 复用 /api/track（qdii-notify） | 限流/校验/前端上报管线现成，前端单一上报地址 |
