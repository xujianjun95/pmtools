# pmtools 后台管理系统实现计划

- 日期：2026-09-06
- 依据：[design spec v2](../specs/2026-09-06-admin-dashboard-design.md)
- 顺序原则：**先 admin 服务、再 qdii-notify 埋点、最后前端**（与 §11 升级顺序一致）；每阶段可独立测试与回滚
- 代码位置：服务端代码放主仓库 `admin-server/` 子目录（与 `qdii-notify/` 同构：独立 package.json、`node --test`、config/db/server 模块划分）；前端在主站 `src/` 内

## Phase 1 · admin-server 基础与鉴权

| # | 任务 | 产出 |
|---|------|------|
| 1.1 | `admin-server/` 骨架：package.json、config.js（.env 解析：PORT/DB_PATH/ADMIN_PASSWORD/SESSION_SECRET/OSS_*）、server.js 挂载 `/background-api` 前缀 | 服务可启动，`GET /background-api/health` |
| 1.2 | `db.js`：articles 表初始化（spec §4.1），全部参数绑定 | 表结构就绪 |
| 1.3 | `auth.js`：login（限流 10 次/分/IP、HMAC 签名 cookie httpOnly+Secure+SameSite=Lax、7 天）、logout、`requireAuth` 中间件、写操作 Origin/Referer 同源校验 | spec §8 |
| 1.4 | 测试：登录成功/失败/限流、cookie 属性、伪造签名拒绝、Origin 跨域拒绝、未登录 401 | `node --test` 全绿 |

## Phase 2 · admin-server 文章与图片

| # | 任务 | 产出 |
|---|------|------|
| 2.1 | 公开端点：`GET /articles`（仅 published）、`GET /articles/:id`（非 published 404） | spec §5 |
| 2.2 | 管理端点：全量列表 / 新建（slug 唯一且创建后固定）/ 更新 / 上下架 / 删除（软校验+确认在前端） | CRUD 全通 |
| 2.3 | `oss.js`（HTTP/外联收口独立模块）：ali-oss 转传上传；校验（扩展名+magic bytes、≤10MB、单篇 ≤30 张）、服务端随机文件名、目录强制 `articles/images/<article-id>/` | spec §8 图片规则 |
| 2.4 | 上架门禁校验：正文含未就位图片占位符时拒绝 status→published（草稿不受限） | spec §7.3 |
| 2.5 | 测试：CRUD、404 语义、上传校验矩阵（伪图片/超限/超量）、门禁拒绝 | `node --test` 全绿 |

## Phase 3 · admin-server 看板聚合

| # | 任务 | 产出 |
|---|------|------|
| 3.1 | `stats.js`：readonly 打开 subscribers.db + analytics.db（WAL 前提见 spec §4.2），五组聚合查询（SQL 完整固定串） | spec §5 stats 端点 |
| 3.2 | 口径实现：UV/IP distinct（禁日值相加）、停留 MAX 按 visit+path 去重、鉴往 round_id 去重与 complete−start 时长、days=0 标注起始日 | spec §6 |
| 3.3 | 分区级错误：单分区失败返回该分区错误态，不整体 500 | spec §5/§9 |
| 3.4 | 测试：fixture 库（构造 visit 序列、round 重放、跨天边界北京时间）验证口径 | `node --test` 全绿 |

## Phase 4 · qdii-notify 埋点扩展（生产关键服务，最小 diff）

| # | 任务 | 产出 |
|---|------|------|
| 4.1 | `analytics.js`：EVENTS +5 站点事件、META_KEYS +path/project_id/news_id/url/round_id、`site_events` 表（含索引）、`parseTrackPayload` 接受 ip 参数、按事件分流写入 | spec §3.1/§4.2 |
| 4.2 | `server.js` `/api/track`：传入 `req.ip`、每批事件单事务写入；失败停用统计的既有模式保留 | spec §3.1 |
| 4.3 | 测试：新事件解析、ip 补记、dca 事件回归、**订阅/退订 API 回归**（证明零触碰） | `node --test` 全绿 |
| 4.4 | 验证脚本：埋点高负载写入下订阅接口可用（spec §12） | 一条可重复执行的验证命令 |

## Phase 5 · 前端埋点泛化

| # | 任务 | 产出 |
|---|------|------|
| 5.1 | `src/utils/analytics.js` 泛化：站点会话（page_view 挂路由变化 + page_leave）、60s 可见心跳、`/background` 路径与开发环境不上报、sendBeacon 批量复用 | spec §6.0/§6.6 |
| 5.2 | 接入：App 路由监听、ProjectCard 点击、ProjectDetail、NewsItem 速览按钮、外链统一出站拦截 | 5 事件可发出 |
| 5.3 | DCA：dca_start 增加 round_id（每局 UUID） | spec §6.5 |
| 5.4 | 测试：事件 payload 单测（jsdom）、路径排除逻辑 | `node --test` / 既有测试全绿 |

## Phase 6 · 前台文章数据源与渲染器

| # | 任务 | 产出 |
|---|------|------|
| 6.1 | markdown-it + markdown-it-mark 替换手写渲染器：html:false、外链 noopener noreferrer、保留 TOC 锚点/中文标点/裸 URL 行为 | spec §7.5 |
| 6.2 | 渲染回归：现有文章（Codex 教程等）渲染对比，`==高亮==`/锚点/标点逐项核对 | 回归通过 |
| 6.3 | Articles 页数据源切 `/background-api/articles`；失败态"暂时无法加载"+重试；**移除旧文兜底回退**；数据源开关 env（回滚用） | spec §7.6 |

## Phase 7 · 后台前端（/background）

| # | 任务 | 产出 |
|---|------|------|
| 7.1 | 懒加载路由 + 侧边栏壳 + 登录页（401 统一拦截） | spec §7.1/§7.2 |
| 7.2 | 看板页：四分区布局 A、时间选择器（7/30/累计+起始日标注）、ECharts 按需引入（趋势折线）、"数据为零/读取失败"双状态 | spec §6/§7.2 |
| 7.3 | 文章列表页：筛选、状态标识、行内操作 | spec §7.2 |
| 7.4 | 编辑页：Vditor（WYSIWYG）+ 表单（slug 固定）+ 图片上传钩子 + 导入 .md（预览/缺失清单/语法提示）+ 上架门禁 UI | spec §7.3/§7.4 |
| 7.5 | 构建：`/background` chunk 与主站包体积分离（构建产物体积对比验证） | 主站体积零影响 |

## Phase 8 · 迁移、部署与验证

| # | 任务 | 产出 |
|---|------|------|
| 8.1 | `scripts/migrate-articles.mjs`：OSS manifest → SQLite（保留 id/日期/标签/摘要/封面，图片路径转绝对 URL） | spec §10.1 |
| 8.2 | 逐篇核对：本地起 admin 服务 + 前台渲染对比清单 | 核对记录 |
| 8.3 | 部署：/opt/pmtools-admin、systemd、nginx `/background-api/` location（验证前缀透传）、.env（600）、备份+恢复演练 | spec §11 |
| 8.4 | 按升级顺序上线：admin → qdii-notify → 前端；每步 smoke（登录/发文/上下架/前台可见/看板五分区/埋点入库） | 上线验证清单 |
| 8.5 | 回滚预案落纸：env 数据源开关、nginx 摘除步骤、服务下线步骤 | spec §10.4 |

## Phase 9 · 收尾

- 观察期 1-2 周：看板数据与 nginx 日志交叉抽查；无异常后删除发布脚本（单独 commit）
- 运维手册更新（黑曜石 PMTools/QDII 手册）：改密码轮换 SESSION_SECRET 流程、site_events 清理 SQL、看板查询示例
- Mimosa 完整审计通过后再 push（commit 阶段已有两次"扫描不完整"提示）

## 里程碑与验证口径

| 里程碑 | 验证 |
|--------|------|
| M1 = Phase 1-3 | admin 服务在本地起服，curl 全端点 + 测试全绿 |
| M2 = Phase 4-5 | 本地起 qdii-notify + 主站，事件入 site_events，订阅接口回归通过 |
| M3 = Phase 6-7 | 本地完整体验：前台看文/后台发文/看板出数 |
| M4 = Phase 8-9 | 生产上线 + 迁移核对 + 观察期 |

红线检查点：Phase 4 是唯一触碰 qdii-notify 的阶段，diff 限于 analytics.js + server.js track 入口 + 测试；Phase 4 完成前不部署任何东西到生产。
