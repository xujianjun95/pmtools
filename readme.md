# PMTOOLS

PMTOOLS 是一个个人作品与工具站。这里展示 YesSir、Kada 和 Dang Analysis 等项目，也提供文章、QDII 基金申购额度监控、全球市场看板和投资测算工具。

首页的黄金螺旋蓝图使用 React 和 SVG 绘制。桌面端可以移动鼠标查看三层视差和测量坐标。手机端在标题下方显示图纸，开启系统的「减少动态效果」时直接显示成图。

[访问 PMTOOLS](https://pmtools.com.cn/)

## 主要页面

| 路径 | 内容 |
| --- | --- |
| `/` | 作品、项目入口与资讯 |
| `/project/:id` | 项目介绍、功能和更新日志，例如 `/project/yessir` |
| `/about` | 个人介绍 |
| `/articles` | 已发布的文章 |
| `/qdii`、`/qdii/world` | QDII 申购额度和全球基金视图 |
| `/qdii/dashboard` | 全球指数、外汇和商品行情看板 |
| `/qdii/dca`、`/qdii/future` | 定投模拟和复利测算 |
| `/background` | 登录后管理文章、基金名册和数据看板 |

## 本地运行

前端使用 React、Vite 和 React Router。建议使用 Node.js 22.12 或更新版本。

```bash
npm ci
npm run dev
```

打开 [http://localhost:5173](http://localhost:5173)。首页和项目详情可以直接预览。文章、后台和邮件订阅需要对应服务，行情看板需要本地行情文件。

| 联调内容 | 步骤 |
| --- | --- |
| 文章和后台 | 在 [`admin-server/`](admin-server/) 安装依赖（`npm ci`），参照 [配置模板](admin-server/.env.example) 填写该目录的 `.env`，再执行 `npm start`。Vite 将 `/background-api` 转发到本地 `3200` 端口。 |
| QDII 邮件订阅 | 在 [`qdii-notify/`](qdii-notify/) 安装依赖并按[服务文档](qdii-notify/README.md)配置后执行 `npm start`。Vite 将 `/api` 转发到本地 `3100` 端口。 |
| 全球市场看板 | 安装 Python 3.9 或以上版本，在仓库根目录执行 `npm run market:refresh` 拉取一次行情，或在另一个终端执行 `npm run market:watch` 持续更新。详见[市场看板文档](docs/market-dashboard.md)。 |

本地联调使用测试数据库和凭据，密钥保存在各自服务的 `.env` 中。

### 检查与构建

```bash
npm run test:dca
npm run lint
npm run build
npm run preview
```

以上命令依次运行定投逻辑测试、全仓 ESLint、生产构建和构建产物预览。前端产物位于 `dist/`。

## 维护入口

| 要改什么 | 从哪里开始 |
| --- | --- |
| 首页和黄金螺旋 | [首页代码](src/pages/Home/) · [蓝图组件](src/pages/Home/components/GoldenSpiralBlueprint.jsx) |
| 项目卡片和详情 | [项目数据](src/data/projects.js)。新增项目时，在 `projectData` 中填写唯一 `id` 和展示内容，并在 `PROJECT_DISPLAY_ORDER` 中安排首页顺序。 |
| 项目更新日志 | [更新日志数据](src/data/changelogs.js)，按项目 `id` 维护。 |
| 文章发布 | 在 `/background` 管理文章。[文章前端](src/data/articlesApi.js) 通过 `/background-api` 读取已上架内容。 |
| 全站主题 | [主题 Hook](src/hooks/useTheme.js) 和 [CSS 变量](src/styles/global.css)。 |
| 基金扫描和行情抓取 | [`qdii-watcher/`](qdii-watcher/) · [申购额度数据口径](docs/qdii-scan-logic.md) |

## 生产发布

日常开发使用 `dev`，生产分支为 `main`。

1. 将本次改动提交到 `dev` 并推送。
2. 执行 `git fetch origin` 和 `git log --oneline origin/main..origin/dev`，确认待发布提交。如果夹带其他改动，从 `origin/main` 只挑选本次提交。
3. 将核对过的改动合入 `main` 并推送。[部署工作流](.github/workflows/deploy.yml)会构建前端，并通过 SSH 同步 `dist/` 到服务器。
4. 在 [GitHub Actions](https://github.com/xujianjun95/pmtools/actions/workflows/deploy.yml) 检查对应提交的部署结果，再打开[正式站](https://pmtools.com.cn/)验证本次改动。

后台 API、邮件服务和行情抓取各自独立运行。Nginx 需为前端路由保留 `index.html` 回退，并将 `/background-api` 和 `/api` 转发到各自服务。

第三方资产许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 和 [蓝图字体许可](public/fonts/blueprint/)。
