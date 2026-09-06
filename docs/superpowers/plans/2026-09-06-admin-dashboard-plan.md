# pmtools 后台管理系统实现计划

- 日期：2026-09-06（v2，按复审意见修订）
- 依据：[design spec v2.1](../specs/2026-09-06-admin-dashboard-design.md)
- 顺序原则：**先 admin 服务、再 qdii-notify 埋点、最后前端**（与 spec §11 升级顺序一致）；迁移脚本编写与演练**提前到前台文章联调之前**（Phase 6.0）；每阶段可独立测试与回滚
- 代码位置：服务端代码放主仓库 `admin-server/` 子目录（与 `qdii-notify/` 同构：独立 package.json、`node --test`、config/db/server 模块划分）；前端在主站 `src/` 内

## Phase 1 · admin-server 基础、鉴权与本地联调基建

| # | 任务 | 产出 |
|---|------|------|
| 1.1 | `admin-server/` 骨架：package.json、config.js（.env 解析：PORT/DB_PATH/ADMIN_PASSWORD/SESSION_SECRET/ADMIN_ALLOWED_ORIGINS/OSS_*）、server.js 挂载 `/background-api` 前缀 | 服务可启动，`GET /background-api/health` |
| 1.2 | `db.js`：articles 表初始化（spec §4.1），全部参数绑定 | 表结构就绪 |
| 1.3 | `auth.js`：login（限流 10 次/分/IP、HMAC 签名 cookie httpOnly+Secure+SameSite=Lax、7 天）、logout、`requireAuth` 中间件、写操作 Origin/Referer 校验（白名单来自 ADMIN_ALLOWED_ORIGINS，本地含 localhost:5173） | spec §8 |
| 1.4 | 测试：登录成功/失败/限流、cookie 属性、伪造签名拒绝、Origin 跨域拒绝、未登录 401 | `node --test` 全绿 |
| 1.5 | 本地联调基建：vite.config 增加 `/background-api` 开发代理（与既有 `/api` 代理并存）；`.env.example` 约定本地测试库路径与 OSS 测试前缀（与生产隔离） | 本地前后台可联调 |

## Phase 2 · admin-server 文章与图片

| # | 任务 | 产出 |
|---|------|------|
| 2.1 | 公开端点：`GET /articles`（仅 published）、`GET /articles/:id`（非 published 404） | spec §5 |
| 2.2 | 管理端点：全量列表 / 新建（slug 唯一且创建后固定）/ 更新 / 上下架 / 删除（软校验+确认在前端） | CRUD 全通 |
| 2.3 | 图片链路：`oss.js`（HTTP/外联收口独立模块）ali-oss 转传；校验（扩展名+magic bytes、≤10MB）、服务端随机文件名、目录强制 `articles/images/<article-id>/`；**新建文章先创建草稿取得 slug，前端才能调上传接口**（服务端同样拒绝无 ID 上传）；数量上限 30 张按**正文实际引用的去重图片数**计（孤儿对象不占额度，重试不重复占额度） | spec §7.3/§8 |
| 2.4 | 发布门禁校验：status→published（含草稿首次上架）**以及已上架文章的正文修改**，均校验正文引用图片全部就位，否则拒绝 | spec §7.3 |
| 2.5 | 测试：CRUD、404 语义、上传校验矩阵（伪图片/超限/无 ID 拒绝）、引用数额度、门禁含已上架修改场景 | `node --test` 全绿 |

## Phase 3 · admin-server 看板聚合

| # | 任务 | 产出 |
|---|------|------|
| 3.1 | `stats.js`：readonly 打开 subscribers.db + analytics.db（WAL 前提见 spec §4.2），五组聚合查询（SQL 完整固定串） | spec §5 stats 端点 |
| 3.2 | 口径实现（spec §6）：UV/IP distinct（禁日值相加）、停留 MAX 按 visit+path 去重且命名"次均停留"、QDII 快照标注不受筛选影响、**鉴往双指标**——人均游戏时长 = Σ完成局时长 ÷ 游玩人数，每局平均耗时 = Σ完成局时长 ÷ 完成局数；完成局时长按同一 round_id 的 complete−start 配对；中途退出计次不计时长；round_id 上线前的旧事件按 visit_id 内顺序配对（兼容规则） | spec §6 |
| 3.3 | 分区级错误：单分区失败返回该分区错误态（"读取失败"），数据为零返回零值态，两者 UI 可区分，不整体 500 | spec §5/§9 |
| 3.4 | 测试（fixture 库）：同一次访问多局、重开、未完成局、跨天（北京时间边界）、**旧事件无 round_id 的顺序配对**、人均 vs 每局口径区分、round_id 重放去重 | `node --test` 全绿 |

## Phase 4 · qdii-notify 埋点扩展（生产关键服务，最小 diff）

| # | 任务 | 产出 |
|---|------|------|
| 4.1 | `analytics.js`：EVENTS +5 站点事件、META_KEYS +path/project_id/news_id/url/round_id、`site_events` 表（含索引）、`parseTrackPayload` 接受 ip 参数、按事件分流写入（dca_* → dca_events，站点事件 → site_events） | spec §3.1/§4.2 |
| 4.2 | `server.js` `/api/track`：传入 `req.ip`、每批事件单事务写入；失败停用统计的既有模式保留 | spec §3.1 |
| 4.3 | 测试：新事件解析、ip 补记、dca 事件回归、**订阅/退订 API 回归**（证明零触碰） | `node --test` 全绿 |
| 4.4 | 验证脚本：埋点高负载写入下订阅接口可用；**邮件走 mock 通道，不发真实邮件** | 一条可重复执行的验证命令 |

## Phase 5 · 前端埋点泛化

| # | 任务 | 产出 |
|---|------|------|
| 5.1 | `src/utils/analytics.js` 泛化：站点会话（page_view 挂路由变化 + page_leave）、可见状态 60s 心跳 flush（**尽力压缩丢失窗口，不作为保证**）、`/background` 路径不上报；开发环境默认不上报，`VITE_ANALYTICS_DEBUG=1` 显式开启供本地联调（M2 用此开关验证入库） | spec §6.0/§6.6 |
| 5.2 | 接入：App 路由监听、ProjectCard 点击、ProjectDetail、NewsItem 速览按钮、**外链 capture 监听并记录**（保持中键/Cmd+点击/新窗口等原生行为，不拦截不阻止默认） | 5 事件可发出 |
| 5.3 | DCA：`dca_start` **与 `dca_complete` 均携带同一 round_id**（每局 UUID） | spec §6.5 |
| 5.4 | 测试：事件 payload 单测（jsdom）、路径排除逻辑、调试开关行为 | `node --test` / 既有测试全绿 |

## Phase 6 · 文章迁移演练 + 前台数据源与渲染器

| # | 任务 | 产出 |
|---|------|------|
| 6.0 | **迁移脚本编写与本地演练（提前到前台联调前）**：`scripts/migrate-articles.mjs` 读 OSS manifest → 逐篇拉正文 → 写 SQLite；**默认迁移为已上架**（保持线上现状）；支持 `--dry-run` 预览清单；重跑遇同 ID **默认跳过**（`--overwrite` 显式才覆盖，且不覆盖后台已修改记录）；逐篇事务 + 断点日志（半途失败可续跑）；迁移期间**冻结旧发布脚本**（约定不再发文）；产出核对记录 | spec §10.1 |
| 6.1 | markdown-it + markdown-it-mark 替换手写渲染器：html:false、外链 noopener noreferrer、保留 TOC 锚点/中文标点/裸 URL 行为 | spec §7.5 |
| 6.2 | 渲染回归：现有文章（Codex 教程等）渲染对比，`==高亮==`/锚点/标点逐项核对 | 回归通过 |
| 6.3a | 列表数据源切 `/background-api/articles`（不含正文）；**详情按需加载**：打开文章时请求 `/:id` 详情接口 | spec §7.6 |
| 6.3b | 详情三态：loading / 失败重试 / 下架 404（提示"文章不存在或已下架"） | spec §7.6 |
| 6.3c | 快速切换文章：取消旧请求或丢弃过期响应（按请求序号守卫） | 不串文 |
| 6.3d | **移除首次渲染时的本地旧文章初始化**（不只删失败回退）：目录/上一篇下一篇改基于详情数据 | 无本地复活路径 |

## Phase 7 · 后台前端（/background）

| # | 任务 | 产出 |
|---|------|------|
| 7.1 | 懒加载路由 + 侧边栏壳 + 登录页（401 统一拦截）；新建文章即创建草稿拿到 slug 后再进入编辑器 | spec §7.1/§7.3 |
| 7.2 | 看板页：四分区布局 A、时间选择器（7/30/累计+起始日标注，QDII 卡注明实时快照）、ECharts 按需引入（趋势折线）、"数据为零/读取失败"双状态 | spec §6/§7.2 |
| 7.3 | 文章列表页：筛选、状态标识、行内操作 | spec §7.2 |
| 7.4 | 编辑页：Vditor（WYSIWYG）+ 表单（slug 固定）+ 图片上传钩子 + 导入 .md（预览/缺失清单/语法提示）+ 上架门禁 UI（图片未就位禁止点上架） | spec §7.3/§7.4 |
| 7.5 | 构建：后台编辑器与图表库**不进入主站首屏依赖**（埋点与渲染器为主站必要增量；构建产物体积对比记录留档） | 懒加载边界成立 |

## Phase 8 · 生产迁移、部署与验证

| # | 任务 | 产出 |
|---|------|------|
| 8.1 | 生产执行迁移（脚本与演练已在 6.0 完成）：服务器侧运行 → 逐篇核对 → admin 服务加载 | spec §10 |
| 8.2 | 部署：/opt/pmtools-admin、systemd、nginx `/background-api/` location（验证前缀透传）、.env（600）、备份+恢复演练 | spec §11 |
| 8.3 | 按升级顺序上线：admin → qdii-notify → 前端；每步 smoke（登录/发文/上下架/前台可见/看板五分区/埋点入库） | 上线验证清单 |
| 8.4 | **回滚预案落纸（两级，spec §10.4）**：程序回滚 = 重新发布按日期归档的上一版前端产物（Vite env 是构建期注入，无"改 env 即切换"）；数据源回滚 = 迁移脚本**反向导出** SQLite → 重新生成 OSS manifest（含上线后全部后台改动）→ 上传 → 发布指向 OSS 的前端；**禁止直接切回旧 manifest** | 可执行回滚手册 |

## Phase 9 · 收尾

- 观察期 1-2 周：看板数据与 nginx 日志交叉抽查；无异常后删除发布脚本（单独 commit）
- 运维手册更新（黑曜石 PMTools/QDII 手册）：改密码轮换 SESSION_SECRET 流程、site_events **暂不清理**（记录量级评估阈值与归档预案）、看板查询示例
- Mimosa 完整审计通过后再 push（commit 阶段已有多次"扫描不完整"提示）

## 里程碑与验证口径

| 里程碑 | 验证 |
|--------|------|
| M1 = Phase 1-2 | admin 服务本地起服，curl 全端点 + 测试全绿；本地前后台联调（经 vite 代理）可通 |
| M2 = Phase 3-5 | 看板聚合口径测试全绿；qdii-notify 本地起服，`VITE_ANALYTICS_DEBUG=1` 下主站事件入库 site_events，订阅接口回归通过（mock 邮件压测） |
| M3 = Phase 6-7 | 本地完整体验：迁移演练数据下前台看文（详情按需加载）、后台发文/传图/上下架、看板出数 |
| M4 = Phase 8-9 | 生产上线 + 迁移核对 + 观察期 |

红线检查点：Phase 4 是唯一触碰 qdii-notify 的阶段，diff 限于 analytics.js + server.js track 入口 + 测试；Phase 4 完成前不部署任何东西到生产。迁移演练（6.0）只跑本地，不触生产。
