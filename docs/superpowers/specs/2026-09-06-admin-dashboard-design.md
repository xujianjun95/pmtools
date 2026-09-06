# pmtools 后台管理系统设计：数据看板 + 文章管理

- 日期：2026-09-06（v2 修订版）
- 状态：架构与布局已确认；v2 按用户复核意见修正统计口径、迁移方案、下架策略与安全要求
- 路由：`https://www.pmtools.com.cn/background`

## 1. 背景与目标

pmtools 主站是纯静态 SPA（Vite + React 19），目前没有自己的后台。本次新增一个管理员后台，一期只做两块：

1. **文章管理**：新增文章、标签、富文本编辑、本机 .md 文件导入、图片上传、上下架。
2. **数据看板**：全站流量（PV/UV/独立 IP/停留时长）、造物与详情页行为、QDII 订阅快照、鉴往游玩指标、新闻速览与外链跳转。

单管理员（站长本人），不需要账号体系。

## 2. 范围

### 2.1 做

- `/background` 独立路由 + 管理员登录鉴权
- 文章 CRUD、上下架（status 切换）、标签、封面
- Vditor 所见即所得编辑器（存 Markdown）
- .md 文件（含图片）导入，支持语法见 §7.4 清单
- 图片上传 → 阿里云 OSS（bucket `pmtools27`）
- 全站埋点扩展 + 看板聚合展示（口径见 §6）
- 前台文章读取源从 OSS manifest 切到后台 API
- **现有 OSS 文章迁移至 SQLite**（方案见 §10）

### 2.2 明确不做（一期 YAGNI）

多人账号、评论、文章阅读数统计、定时发布、可拖拽 widget、OSS 浏览器直传、找回密码流程、**Word/PDF 导入**（一期仅 .md，后续按需加）、**订阅状态变更日志**（一期退订指标只看快照，见 §6.5）、历史退订趋势、历史每日活跃订阅数。

## 3. 架构总览（双服务分工）

```
浏览器
 ├─ 主站 SPA（/background 懒加载后台 chunk，不套主站布局）
 ├─ 埋点 → POST /api/track → qdii-notify :3100（现有服务，改动见 §3.1）
 └─ 后台请求 → /background-api/ → pmtools-admin :3200（新服务）
                                   ├─ articles.db（文章，读写）
                                   ├─ 只读挂载 subscribers.db + analytics.db（看板聚合）
                                   └─ 图片 → OSS（服务端转传）
```

### 3.1 qdii-notify 改动范围（如实列全）

- `analytics.js`：事件白名单新增 5 个站点事件（§6.0）；meta 键白名单新增 `path`、`project_id`、`news_id`、`url`、`round_id`；新增 `site_events` 表及写入函数（§4.2）。
- `server.js`：`/api/track` 入口把 `req.ip` 传入并按事件类型分流写入（`dca_*` → `dca_events`，站点事件 → `site_events`）。`trust proxy` 已配置（为限流而设），无需新改。
- 对应测试更新。**订阅、退订、邮件通知的函数与逻辑零改动。**

### 3.2 nginx

- 新增**专用前缀 location** `location /background-api/ { proxy_pass http://127.0.0.1:3200; }`（前缀匹配，非 `=` 精确匹配；proxy_pass 不带 URI 部分，`/background-api/` 前缀**原样透传**，admin 服务按该前缀挂路由——上线时验证）。
- 与既有 `/api/` 通配（→ kada:3000）及 qdii 的精确 location 互不干扰。

## 4. 数据模型

### 4.1 articles.db（admin 服务持有）

```sql
CREATE TABLE articles (
  id           TEXT PRIMARY KEY,      -- slug，如 codex-install-guide；创建后固定，不可编辑（保证链接稳定）
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

- 上下架 = status 在 draft/published 间切换；下架不删内容，可再上架。
- **下架语义 = 站内停止展示**：公开列表与详情端点都只返回 published；直接访问已下架文章的 API 一律 404。浏览器端请求带 no-store，无缓存层，下架即生效。
- 旧 OSS 正文地址在迁移后默认**保留公开**（内容为公开教程，且是回滚保险）；观察期后是否删除由站长另行决定。
- 删除 = 硬删除 + 前端二次确认；OSS 上已传图片不回收（孤儿可接受）。

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
  ip          TEXT NOT NULL DEFAULT '',   -- 服务端补记 req.ip，仅用于独立 IP 去重
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_site_events_event_time ON site_events (event, created_at);
```

- 校验沿用 `parseTrackPayload` 姿势：事件名白名单、visitor_id 强制 UUID、时长 6 小时封顶、meta 键白名单、非法静默丢弃。
- 写入按批次事务执行（沿用既有"写失败即停用统计、订阅服务不受影响"的故障模式）。
- 数据保留：**全量保留，暂不清理**。事件量级极小（预估 <10 万行/年），"累计"统计因此真实有效；未来量级显著增长时再评估按年归档（阈值记入运维手册）。
- **只读挂载前提（如实记录）**：SQLite WAL 模式下只读连接仍需 `-shm`/`-wal` 文件可访问（本机各服务同为 root，满足）；better-sqlite3 查询为 autocommit 短事务，不长期持有读事务，不阻碍 checkpoint。

## 5. API 设计（pmtools-admin）

统一前缀 `/background-api/`，同源反代，无 CORS 需求。

| 分组 | 端点 | 说明 |
|------|------|------|
| 公开 | `GET /background-api/articles` | **仅 published** 列表（无正文） |
| 公开 | `GET /background-api/articles/:id` | 单篇详情（含 content_md）；**非 published 一律 404** |
| 鉴权 | `POST /background-api/admin/login` | 密码换签名 cookie，限流（§8） |
| 鉴权 | `POST /background-api/admin/logout` | 清 cookie |
| 管理 | `GET/POST /background-api/admin/articles`、`PUT/DELETE .../:id` | 全量列表（含草稿）/ 新建 / 更新·上下架 / 删除；写操作校验登录态 + 来源（§8） |
| 图片 | `POST /background-api/admin/upload/image` | multipart 图片 → OSS `articles/images/<article-id>/`，返回 URL |
| 看板 | `GET /background-api/admin/stats/summary?days=7` | PV/UV/独立 IP/人均停留 + 趋势序列；days=7/30，days=0 表示累计（响应标注统计起始日） |
| 看板 | `GET /background-api/admin/stats/projects` | 造物卡片点击 TOP / 详情页访问 / 详情页停留（三个分开的指标） |
| 看板 | `GET /background-api/admin/stats/qdii` | **快照**：当前活跃订阅数、当前退订中人数 |
| 看板 | `GET /background-api/admin/stats/dca` | 游玩人数/游戏总次数/人均游戏次数/人均游戏时长（口径见 §6.6） |
| 看板 | `GET /background-api/admin/stats/content` | 新闻速览点击/外链跳转 |

- 看板聚合对 qdii 的两个库**只读**打开（前提见 §4.2）。单分区查询失败返回该分区的**错误状态**（前端显示"读取失败 + 重试"），不影响其他分区；**区分"数据为零"与"读取失败"两种 UI 状态**。

## 6. 指标口径表（看板唯一口径来源）

所有看板接口统一：时间范围参数（近 7 天默认 / 近 30 天 / 累计），日期边界按**北京时间**；`/background` 路径及其后台操作**不产生任何埋点**；"累计"必须标注统计起始日（埋点上线日），上线前数据无法补出。

### 6.0 新增埋点事件清单

复用 `src/utils/analytics.js` 泛化为全站工具（visitor_id 存 localStorage、visit_id 每次页面进入重生成、可见时长计时、批量 sendBeacon、开发环境不上报、静默失败）：

| 事件 | meta | 用途 |
|------|------|------|
| `page_view` | `path` | PV/UV/独立 IP/详情页访问；服务端补记 ip |
| `page_leave` | `path`，duration_ms | 页面/首页/详情页停留 |
| `project_click` | `project_id` | 造物卡片点击 |
| `news_quickview` | `news_id` | 新闻速览按钮 |
| `outbound_click` | `url` | 站外跳转（截断存 40 字符内） |


### 6.1 流量

- **PV**：`page_view` 计数。SPA 路由每次变化计 1，首次加载计 1，刷新计新 PV；bfcache 恢复（pageshow）不重复计。
- **UV**：区间内 `visitor_id` 去重数。为浏览器级标识（localStorage），不等于真实人数；**区间 UV 用 distinct 计算，禁止用每日 UV 相加**。
- **独立 IP**：区间内 `ip` 去重数（`page_view` 服务端补记）。仅用于计数，看板不展示 IP 明细。
- **停留时长**：`page_leave` 按 visit+path 取 MAX 去重后求和；**次均停留** = 总时长 ÷ visit 数（每次访问的平均，如实命名，不称"人均"）。**首页停留单独展示**。

### 6.2 造物

- **卡片点击**：`project_click` 计数。
- **详情页访问**：`page_view` 且 `path` 匹配 `/project/:id`（外链直达详情页只计访问、不计卡片点击）。
- **详情页停留**：`page_leave` 按 path 聚合。
- 三者分开统计、分开展示。

### 6.3 内容行为

- 新闻速览点击：`news_quickview` 计数。
- 外链跳转：`outbound_click` 计数（URL 截断 40 字符存 meta）。

### 6.4 QDII 订阅（快照口径）

一期仅展示**当前活跃订阅数**与**当前退订中人数**（subscribers.db 实时状态）。不做订阅/退订趋势：现有库在重新订阅时会清空 `unsubscribed_at`、重复退订会覆盖时间戳，历史次数无法准确还原；准确趋势需新增订阅事件日志（触碰订阅逻辑），一期明确不做。该分区为**实时快照，不受时间范围筛选影响**（卡片注明）。

### 6.5 鉴往

- **游玩人数**：区间内触发过 `dca_start` 的去重 `visitor_id` 数。
- **游戏总次数**：`dca_start` 计数；`dca_start` 与 `dca_complete` 的 meta **均携带同一 `round_id`**（每局 UUID，前端生成），服务端按 round_id 去重防批量重放虚增。
- **人均游戏次数** = 游戏总次数 ÷ 游玩人数。
- **人均游戏时长** = Σ(完成局时长) ÷ **游玩人数**；**每局平均耗时** = Σ(完成局时长) ÷ 完成局数。两指标分开命名、分别计算——人均含中途退出者（其时长记 0），每局只看完成局。
- **完成局时长** = 同一 `round_id` 的 `dca_complete.duration_ms` − `dca_start.duration_ms`（可见时长口径，天然排除开始前浏览与总结页；页面隐藏时间本就不计时）。
- **中途退出（有 start 无 complete）**：计次数、不计时长（无终止意图信号，无法归因）。
- **旧数据兼容**：round_id 上线前的历史事件无此标识，按 visit_id 内"start 与其后首个 complete 顺序配对"计算；看板标注口径生效起始日。

### 6.6 埋点可靠性

- 沿用离开时上报（visibilitychange/pagehide）之外，**新增可见状态低频快照**：每 60 秒 flush 一次累计值，尽力把浏览器崩溃/强杀的丢失窗口压缩到 1 分钟量级（网络失败或浏览器挂起仍可能扩大，不作为保证）。

## 7. 前端设计

### 7.1 路由与代码组织

- 主站仓库内新增 `/background` 路由，`React.lazy` 独立 chunk，主站包体积不受影响。
- 后台页面不套主站 `MainLayout`，自带侧边栏壳。
- 页面：看板（默认）、文章列表、新建、编辑、登录。
- 未登录访问 → 跳登录页；API 401 → 统一拦截跳登录。

### 7.2 布局（已选方案 A）

左侧边栏（数据看板 / 文章管理 / 退出登录）+ 看板单页滚动，四个分区自上而下：**全站流量 → 内容行为（造物/新闻/外链）→ QDII 订阅（快照两卡）→ 鉴往**。顶部时间范围选择器全局生效（近 7 天默认 / 近 30 天 / 累计，累计标注起始日）。

文章列表页：状态筛选（全部/已上架/草稿）+「新建」「导入 .md」按钮 + 表格（标题/标签/状态/更新时间/编辑·上下架·删除）。

### 7.3 文章编辑器

- **Vditor** 所见即所得模式，存储为标准 Markdown；工具栏按需裁剪。
- 图片：粘贴/选择 → 上传钩子 → `/admin/upload/image` → 插入 OSS URL。**新建文章先创建草稿取得固定 slug，再开放图片上传**（无文章 ID 不允许传图）；并发上传与失败重试不占数量额度。
- 图片数量口径：上限 30 张按**正文实际引用的去重图片数**计（已上传未引用的孤儿对象不占额度）。
- 表单字段：标题、slug（创建后固定）、标签、摘要、封面、正文。
- **发布门禁**：status 变为 published（含草稿首次上架）**以及已上架文章的正文修改**，都校验正文引用图片全部就位，否则拒绝——防止绕过门禁发布未完成图片；保存草稿不校验。

### 7.4 .md 导入（一期仅 .md；兼容范围=本清单）

支持以下语法，超出清单的内容**原样保留并在预览中标注"可能渲染异常"**：

- YAML frontmatter（title/date/tags/summary）剥离并自动填表单
- 图片写法 `![[图片.png]]` 与 `![](图片.png)`（同名图片按导入报错提示而非猜测；子目录路径按相对路径解析；`![[img|300]]` 尺寸写法取文件名忽略尺寸参数并提示）
- 标题（#~###）、段落、无序/有序列表、**加粗**、`==高亮==`、链接、裸 URL

不支持且明确提示：内部双链 `[[笔记]]`、Callout/嵌入、脚注、表格（导入时提示用编辑器补写）。

流程：多选文件（.md + 图片）→ **导入预览**（解析结果 + 缺失图片清单）→ 确认后图片上传 OSS、链接改写为稳定 URL。黑曜石写作 → 后台导入 → 预览 → 上架；`npm run articles:publish` 脚本在迁移验证通过后退役（§10）。

### 7.5 前台渲染器升级

- `src/utils/markdown.jsx`（手写，仅 7 种语法）升级为 **markdown-it + markdown-it-mark**（保留 `==高亮==`）。
- 安全规则：`html: false`（原始 HTML 一律转义）、外链统一 `rel="noopener noreferrer"` + 新窗口打开、不启用任何 HTML 嵌入。
- 保留现有增强：h2/h3 标题锚点目录（TOC）、中文标点不吃进链接、裸 URL 自动链接。
- 回归标准：现有文章渲染结果不变。

### 7.6 前台文章数据源切换（含下架策略）

- 文章页从 OSS manifest 改为 `GET /background-api/articles`（列表）+ `/:id`（正文）。
- **API 失败时展示"暂时无法加载"+ 重试按钮，不再回退本地旧文章**——本地数据不知道后台最新上下架状态，回退会让已下架文章"复活"。`src/data/articles.js` 兜底数据仅保留开发用途（无服务时的本地调试）。
- `VITE_ARTICLES_MANIFEST_URL` 机制随迁移完成退役。

## 8. 鉴权与安全

- `ADMIN_PASSWORD` 与 `SESSION_SECRET`（独立强随机密钥）均存服务器 `.env`（600）。
- 登录限流（按 IP，10 次/分钟）；成功后发 HMAC 签名 cookie：httpOnly + Secure + SameSite=Lax，有效期 7 天。
- 会话失效约定：退出登录清除 cookie；**更换 ADMIN_PASSWORD 后需同步轮换 SESSION_SECRET 并重启服务，旧会话全部失效**（写入运维手册）。
- CSRF：所有写操作校验 Origin/Referer 同源（配合 SameSite=Lax）。
- 图片上传校验：扩展名 + magic bytes 双重校验真实类型；单张 ≤ 10MB；单篇 ≤ 30 张；**服务端生成随机文件名**（不使用用户文件名）；OSS 写入目录强制限定 `articles/images/<article-id>/` 前缀。
- 渲染安全见 §7.5（HTML 转义、外链 noopener）。
- 无用户表、无找回流程；忘记密码 = 改 .env 重启。

## 9. 错误处理

- 埋点全部静默失败，不影响页面体验。
- 看板分区级降级：任一数据源异常只影响本分区，UI **区分"暂无数据（真 0）"与"读取失败（可重试）"**。
- 图片上传失败明确报错可重试；**保存草稿**不依赖图片上传，**上架依赖图片全部就位**（§7.3 门禁）。
- admin 服务 systemd 自动重启；SQLite WAL 模式。
- qdii-notify 埋点写入故障时沿用既有模式：停用统计、订阅与邮件服务继续运行。

## 10. 现有文章迁移方案（新增）

1. **迁移脚本**（一次性，本地运行）：读 OSS `articles.json` manifest → 逐篇拉取正文 → 写入 SQLite，**保留原 id、发布日期、标签、摘要、封面**；正文内相对图片路径统一转为 OSS 绝对 URL（图片文件不动）。
2. **逐篇核对**：迁移前后渲染对比（标题/正文/图片数/目录锚点），人工抽查全文。
3. **切换**：admin 服务部署并加载迁移数据 → 前台切 API 数据源 → 线上验证文章区。
4. **回滚（拆成两级，不可混用）**：
   - **程序回滚**：重新发布上一版前端构建产物（每版产物按日期归档保留），必要时同时摘除 nginx `/background-api/` location。注意 Vite 环境变量是**构建期**注入——改服务器 .env 不会改变已发布的前端产物，不存在"改 env 即切换"。
   - **数据源回滚（兜底）**：用迁移脚本的**反向导出**从 SQLite 重新生成 OSS manifest（含上线后在后台新增/修改/下架的全部最新状态）并上传，再发布指向 OSS 的前端版本。**禁止直接切回旧 manifest**——会丢失后台改动、复活下架文章。
   - SQLite 与 OSS 双数据源并存直至观察期结束。
5. **退役**：发布脚本在迁移验证通过 + 一个观察周期后删除；OSS 上旧 manifest 与正文**默认保留公开**（回滚保险），是否清理另行决定。

## 11. 部署

- 新目录 `/opt/pmtools-admin`，systemd unit `pmtools-admin`，端口 3200。
- `.env`：ADMIN_PASSWORD、SESSION_SECRET、OSS_ACCESS_KEY_ID/SECRET、OSS_BUCKET、端口、DB 路径。
- **升级顺序**：① 部署 admin 服务 + nginx location → ② 升级 qdii-notify（埋点分流，前后端兼容：旧前端事件仍在白名单内）→ ③ 发布前端。每步可独立回滚。
- 数据库备份恢复演练：articles.db 纳入现有备份节奏，**上线前做一次恢复演练**；qdii 两库备份策略不变。
- 前端照旧 scp assets + index.html；`/background` 走 SPA fallback（上线时验证）。

## 12. 红线与风险

- **红线**：不影响线上用户。qdii-notify 改动限于 §3.1 列出的三处（analytics.js、track 入口、测试），**不触碰订阅/退订/邮件函数**；埋点与订阅共用进程与机器资源，通过批量事务写入、既有 trackRateLimit、site_events 独立表与索引控制影响，**上线前验证"埋点高负载下订阅接口正常"**（用 mock 邮件通道，不发真实邮件）。
- 升级顺序与回滚方案保证任何一步出问题可独立退回（§10、§11）。
- 新代码过 Mimosa 推送门禁（SQL 用完整固定串 + 参数绑定、HTTP 收口独立模块）。
- 只读挂载 qdii 库属于跨服务文件级耦合：目录结构变更需同步两处，已在此文档标注。

## 13. 决策记录

| 决策 | 结论 | 关键理由 |
|------|------|----------|
| 文章读取路径 | 后台 API 出内容（A2） | 数据面统一、实时生效、后续扩展容易；API 失败不回退旧文（避免下架复活） |
| 文章正文存储 | 服务器 SQLite | 结构化数据的行业常规；与订阅/埋点库同栈 |
| 图片存储 | OSS（bucket pmtools27） | 不吃 ECS 小水管带宽；服务端转传免 CORS、免浏览器凭据 |
| 服务形态 | 双服务（admin 独立于 qdii-notify） | 爆炸半径隔离，守护"不影响线上用户"红线（统计仍共享进程资源，用 §12 措施补偿） |
| 编辑器 | Vditor（所见即所得 → Markdown） | 兼顾富文本体验与 Markdown 存储链路（黑曜石/渲染器） |
| 渲染器 | markdown-it 替换手写渲染器（html:false） | 编辑器产出的表格/代码块需要完整语法支持 |
| 后台布局 | 侧边栏 + 看板单页滚动（方案 A） | 指标就四组，一屏滚完比切 Tab 快 |
| 埋点通道 | 复用 /api/track（qdii-notify） | 限流/校验/前端上报管线现成，前端单一上报地址 |
| 文件导入格式 | 一期仅 .md | 匹配黑曜石工作流，范围最小；Word/PDF 后续按需 |
| 退订指标口径 | 一期只看快照 | 现有库无法还原历史退订次数；加事件日志需触碰订阅逻辑，不做 |
| 下架语义 | 站内停止展示；公开端点 404 | 本地兜底会让下架文章复活，故废除无条件下架回退 |
| 旧 OSS 文章 | 默认保留公开 | 公开教程无敏感性，且是迁移回滚保险 |
| slug | 创建后固定 | 主键可编辑会导致旧链接失效 |
| 游戏时长口径 | complete − start（可见时长） | 现有数据即可计算，天然排除浏览与总结页时间 |

## 14. 修订记录

- v2.1（2026-09-06）：按实现计划复审意见修订——游戏时长拆分"人均/每局"双指标且 start/complete 均带 round_id、补中途退出与旧数据配对规则（§6.5）；事件改为全量保留以支撑真实累计（§4.2/§12）；"人均停留"更名"次均停留"（§6.1）；QDII 快照标注不受筛选影响（§6.4）；心跳措辞去保证化（§6.6）；图片上传改为"先存草稿得 slug 再传图"、数量按正文引用计、门禁覆盖已上架正文修改（§7.3）；回滚拆分程序/数据源两级并明确 Vite env 构建期语义（§10.4）。
- v2（2026-09-06）：按用户逐条复核意见修订——下架与兜底冲突（§4.1/§7.6）、新增迁移方案（§10）、QDII 指标改快照口径（§6.4）、鉴往游戏时长口径重定义（§6.5）、新增指标口径表（§6）、qdii-notify 改动范围如实列全并补安全措施（§3.1/§12）、安全补齐（§8）、导入范围与语法清单（§7.4）、slug 固定、nginx 术语与透传说明（§3.2）、部署升级顺序与回滚（§11）、"数据为零/读取失败"区分（§5/§9）。
- v1（2026-09-06）：初版，经四节逐节确认。
