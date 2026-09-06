# QDII 通知服务部署文档

给 PMTOOLS 的 QDII 监控页面（/qdii）添加"邮件订阅通知"功能：
页面出现申购额度变动时，自动通过阿里云邮件推送（Direct Mail）给所有订阅者发送邮件。

## 架构

```
nginx (80/443) ── / ──> pmtools 静态前端（/var/www/pmtools/main）
             └── /api/* ──> qdii-notify (127.0.0.1:3100)
                              ├── POST /api/subscribe      订阅
                              ├── GET  /api/unsubscribe    退订（邮件内链接）
                              ├── GET  /api/status         订阅状态查询
                              ├── POST /api/track          「鉴往」使用统计上报
                              └── 定时任务（8:00 / 12:10 / 18:10）检测 data.json 变动 → 邮件群发
scanner.py（cron 1:00 / 12:00 / 18:00）──> /var/www/pmtools/main/qdii/data.json（本服务只读它）
```

## 文件说明

| 文件 | 作用 |
|---|---|
| `server.js` | Express API（订阅/退订/状态/健康检查/埋点）+ 启动定时任务 |
| `notify.js` | 变动检测 + 发信，支持 `--once` / `--check` 手动跑 |
| `detect.js` | 读 data.json，与 snapshot.json 快照对比，仅通知有效 limit_amount 变动；状态变化和新增/移出监控不发信 |
| `mailer.js` | 邮件发送（阿里云 DM API 默认；SMTP 备用通道，分批、个性化退订链接） |
| `db.js` | SQLite 订阅者表（better-sqlite3） |
| `analytics.js` | 「鉴往」使用统计：/api/track 载荷校验 + 独立统计库 dca_events 表写入 |
| `query-dca-analytics.mjs` | 使用统计查询脚本（用户数/停留时长/人均次数） |
| `config.js` | 配置读取（.env） |
| `nginx-pmtools.conf.example` | nginx 反代片段 |

## 「鉴往」使用统计

/qdii/dca 页面上报 4 类事件（`analytics.js` 白名单校验后写入独立 SQLite 统计库的 `dca_events` 表）：
`dca_view` 进入页面、`dca_start` 开始旅程（附年份/标的/金额）、`dca_complete` 通关到总结页、
`dca_leave` 切后台或离开时的时长快照（`duration_ms` 为本次访问页面可见累计停留毫秒数；同一次访问取最大值，不累加快照）。

- **访客识别**：`visitor_id` 存 localStorage（按浏览器去重），`visit_id` 每次进入页面重新生成（刷新、离开后重新进入均算新访问）
- **隐私**：不采集任何个人信息与邮箱，只存随机 UUID 与聚合参数
- **统计口径**：使用用户数 = 有 `dca_start` 的去重浏览器数；平均停留 = 所有页面访问的可见累计时长平均值（含未开始旅程的访问）；人均游玩 = `dca_start` 次数 / 使用用户数。开始一次即算一次游玩，无需通关。
- **可靠性**：sendBeacon 优先、keepalive fetch 兜底；切后台立即补报，切回继续计时；本地开发（localhost）不上报。浏览器拦截、断网或强制结束进程仍可能漏报，统计为尽力上报。
- **限流**：埋点与邮件订阅独立计数，埋点请求不占用订阅额度。
- **订阅隔离**：统计库路径固定为 `DB_PATH + .analytics.db`（例如 `subscribers.db.analytics.db`），不读写订阅库，不改动订阅表和原邮件配置。统计模块缺失、初始化失败或写入失败均不阻止订阅 API 和定时邮件运行；写入失败后停用统计直到下次服务重启，日志只记录错误类型。统计库锁冲突立即失败，不等待 SQLite 默认的同步超时。
- **兼容性**：沿用 `better-sqlite3` 11；前端和通知服务需一起发布。旧版错误时长无法从已有数据还原；不会读取或迁移旧版存于订阅库内的埋点表。

隔离回归（临时数据库、模拟邮件和定时器，不读取 `.env`，不启动端口，不发送真实邮件）：

```bash
# 仓库根目录执行
node --test qdii-notify/subscription-isolation.test.mjs
```

本次后端隔离验证环境：Node 22.23.2 + 锁文件中的 better-sqlite3 11.10.0；20 项后端测试通过。
附带的 Node 24.19.0 运行时在多场景测试中曾触发原生模块异常，该组合尚未确认兼容。
发布前核对服务器现有运行时，保留原 Node、邮件配置及依赖版本，不随埋点变更升级运行环境。

上线后查看数据（在服务器 `/opt/qdii-notify` 执行）：

```bash
node query-dca-analytics.mjs            # 全部时间：使用用户数 / 平均停留时长 / 人均游玩次数
node query-dca-analytics.mjs --days 7   # 只看最近 7 天
```

## 部署步骤（在阿里云服务器执行）

### 1. 上传代码并安装依赖

```bash
mkdir -p /opt/qdii-notify
# 将本目录所有文件上传到 /opt/qdii-notify（不含 node_modules）
cd /opt/qdii-notify
npm install
```

### 2. 配置 .env

```bash
cp .env.example .env
vim .env
```

必填项：
- `MAIL_PROVIDER`：默认 `aliyun`（阿里云邮件推送 API）；如需回退 `smtp` 备用通道
- `ALIYUN_DM_ACCESS_KEY_ID` / `ALIYUN_DM_ACCESS_KEY_SECRET`：阿里云 AccessKey（与 Dang Analysis 共用同一套）
- `ALIYUN_DM_FROM_ADDRESS`：DM 控制台已创建的发信地址，如 `noreply@mail.pmtools.com.cn`
- `PUBLIC_BASE_URL`：pmtools 公网域名，如 `https://pmtools.yourdomain.com`（退订链接用）
- `DATA_JSON_PATH`：保持 `/var/www/pmtools/main/qdii/data.json`（scanner 输出路径）
- 其余可保持默认

### 3. 启动服务（建议用 systemd 托管）

新建 `/etc/systemd/system/qdii-notify.service`：

```ini
[Unit]
Description=QDII Notify Service
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/qdii-notify
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now qdii-notify
systemctl status qdii-notify
```

### 4. 配置 nginx 反代

把 `nginx-pmtools.conf.example` 中的 `location /api/ { ... }` 块追加到
`/etc/nginx/sites-enabled/pmtools.conf` 的 server 块内，然后：

```bash
nginx -t && systemctl reload nginx
```

### 5. 验证

```bash
# 服务健康检查
curl http://127.0.0.1:3100/api/health

# 从外网通过域名访问 API（应返回 ok）
curl https://你的域名/api/health

# 订阅测试
curl -X POST https://你的域名/api/subscribe -H 'Content-Type: application/json' -d '{"email":"test@example.com"}'

# 手动触发一次检测（--check 只打印不发信，--once 检测并发送）
cd /opt/qdii-notify && node notify.js --check
```

## 使用说明

- **订阅**：QDII 页面点击"订阅通知"→ 输入邮箱 → 写入 SQLite → 每次检测到变动时全量推送
- **退订**：每封邮件底部有唯一退订链接，点击即退订
- **幂等**：检测基于"已通知状态"快照（snapshot.json），无变动不打扰、同日不重复发
- **发送可靠性**：快照仅在发送成功后才推进——若 SMTP 整体故障（未配置 / auth 拒绝 / 风控全拒），全部邮件失败时快照不推进，下轮定时任务自动重试，不会丢通知；部分成功则正常消费
- **日志**：`journalctl -u qdii-notify -f`

## 注意事项

1. **发信配额**：阿里云 DM 有单日发信配额（订阅量小完全够用），`BATCH_SIZE`（默认50）控制单批并发；出错邮件可在 DM 控制台→数据统计查看，业务分类可用邮件标签（QDII 邮件 TagName=`qdii-notify`）与 Dang Analysis 区分。
2. **授权码安全**：`.env` 含授权码，勿提交到 git、勿泄露。
3. **前端**：`/qdii` 页面的订阅按钮调用同域 `/api/subscribe`，开发模式通过 vite proxy 转发到 3100（见根目录 `vite.config.js`）。
4. **首跑快照**：服务首次部署后，第一次定时检测会把当前状态记为快照，因此**只有当之后真的发生变动才会通知**，不会一上线就发全量。
