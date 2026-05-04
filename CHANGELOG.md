# CHANGELOG

## 2026-05-04

### 资讯模块 AI 总结功能

**新增功能：**
- 资讯卡片新增「AI 总结」按钮，点击后调用 DeepSeek API 生成 200-300 字文章摘要
- 新增通用 Modal 弹窗组件，支持 ESC 关闭、点击遮罩关闭、暗色主题适配
- 后端 news-service 新增 `POST /api/summarize` 接口，集成 DeepSeek API，带内存缓存
- 「AI 总结」改名为「速览」，添加 ✦ 图标，按钮改为 pill 样式带边框和 hover 效果
- 速览内容分段显示（按换行符拆分为多段落）
- 速览弹窗从加载态到完成态添加 fadeUp 过渡动画
- Modal 弹窗添加 dot-grid 底纹，与首页风格统一

**样式优化：**
- 资讯卡片标题改用衬线字体（DM Serif Display），与网站整体风格统一
- 「AI 总结」按钮与序号、日期右边缘对齐
- 加载态「正在生成总结…」添加呼吸脉冲动画

**涉及文件：**
- 前端：`src/components/common/Modal.jsx`、`Modal.module.css`、`src/pages/Home/components/NewsItem.jsx`、`NewsItem.module.css`
- 后端：`news-service/news/summarizer.js`、`news-service/server.js`、`news-service/.env`

### 导航与字体优化

**导航栏：**
- 新增「资讯」导航按钮，点击后页面滚动到资讯区域，带下划线指示器
- 「构建」改名为「造物」

**字体全局更新：**
- 中文衬线体统一为思源宋体（Noto Serif SC），通过 Google Fonts 加载
- 英文衬线体：macOS 用 New York，Windows 用 Georgia（通过 `--font-display` 变量）
- 导航栏、栏目标题、速览弹窗正文均使用衬线体
- 首页英雄区副标题保持 DM Serif Display 不变

**涉及文件：**
- `src/components/layout/Header.jsx`、`Header.module.css`
- `src/styles/global.css`、`src/pages/Home/Home.module.css`
- `src/pages/Home/components/NewsFeed.jsx`、`NewsFeed.module.css`
- `src/pages/Home/index.jsx`、`index.html`

### 资讯数据源扩展

**新增数据源：**
- AIBase：AI 行业资讯
- Hacker News：AI 相关帖子（通过关键词过滤 + DeepSeek 翻译标题）
- 少数派：科技生活资讯

**数据处理：**
- 多源数据去重（按标题）
- 按发布时间倒序排列，限制 10 条
- 更新间隔调整为 2 小时，0:00-8:00 静默时段不更新
- Hacker News 等无法抓取正文的链接，降级为从标题生成摘要
- DeepSeek API 超时时间调整为 60 秒

**涉及文件：**
- `news-service/news/fetcher.js`、`news-service/news/cache.js`、`news-service/news/summarizer.js`

### 生产环境部署

**news-service 部署：**
- 配置 GitHub Actions CI/CD（push to main 自动部署）
- 服务器安装 Docker 并部署 RSSHub 容器
- 配置 Docker Hub 镜像加速（`docker.1ms.run`）
- pm2 管理 news-service 进程
- 端口从 3001 切换到 3002（避免与其他服务冲突）

**nginx 配置：**
- 在 `api.pmtools.com.cn` 添加 `/api/` location，代理到 127.0.0.1:3002
- 覆盖 `/api/news` 和 `/api/summarize` 两个接口

**涉及文件：**
- `news-service/.github/workflows/deploy.yml`
- 服务器：`/etc/nginx/conf.d/yessir-proxy.conf`、`/var/www/news-service/.env`
