# Pmtools 个人门户（React + Vite SPA）

这是一个用于个人作品集/门户的单页应用（SPA）。当前实现采用：
- **React Router** 做客户端路由：`/`、`/project/:id`、`/profile`、`/resume`
- **数据驱动**：项目卡片与详情页从 `src/data/projects.js` 渲染
- **主题体系**：`useTheme` Hook + `src/styles/global.css` 统一管理 CSS 变量
- **入场动画**：全局 `.fi` + `.d1~.d8`，由 `MainLayout` 在路由切换时重播

---

## 0) 协作规则（长期有效）

- 严格按提出的需求执行，不自行臆想或扩展未提出的需求。
- 遇到不确定、信息不足或存在歧义的地方，先与需求提出方确认，再继续执行。

---

## 1) 本地验证（你可以照这个做）

1. 安装依赖：

   ```bash
   npm ci
   ```

2. 启动开发服务：

   ```bash
   npm run dev
   ```

3. 浏览器逐个检查：
- `http://localhost:<port>/`：首页项目网格（从 `src/data/projects.js` map 渲染）
- `/project/yessir`、`/project/kada`：详情页（`useParams + getProjectById`）
- `/profile`：个人简介（Hero / Skills / Contact 组件化）
- `/resume`：简历占位页

额外重点看两点：
- 主题切换是否生效并持久化（`localStorage.theme`）
- `.fi` 动画在路由切换时是否能再次播放（`MainLayout` 已做重播处理）

---

## 2) 路由规则（`src/App.jsx`）

- `/` → `src/pages/Home/index.jsx`
- `/project/:id` → `src/pages/ProjectDetail/index.jsx`
- `/profile` → `src/pages/Profile/index.jsx`
- `/resume` → `src/pages/Resume/index.jsx`（预留）

---

## 3) 目录结构与约定（按当前仓库更新）

> 下面是当前仓库的关键结构，按此约定继续扩展页面与模块。

```text
src/
├── data/
│   └── projects.js               # 项目数据中心（卡片/详情都从这里来）
├── components/
│   ├── layout/
│   │   ├── Header.jsx
│   │   ├── Footer.jsx
│   │   └── MainLayout.jsx        # 共享布局 + 路由切换时重播动画
│   ├── common/
│   │   ├── BlurText.jsx
│   │   ├── PlaceholderProjectCard.jsx
│   │   ├── ThemeToggle.jsx
│   │   ├── TechTag.jsx
│   │   └── ProjectCard.jsx
│   └── mockups/
│       ├── ProjectMockup.jsx    # 根据 mockupType 选择预览组件
│       ├── MockupYesSir.jsx
│       └── MockupKada.jsx
├── pages/
│   ├── Home/
│   │   ├── index.jsx             # 页面组合：HomeIntro / ProjectsGrid
│   │   └── components/
│   │       ├── HomeIntro.jsx
│   │       └── ProjectsGrid.jsx
│   ├── ProjectDetail/
│   │   ├── index.jsx             # useParams -> getProjectById -> 传给各子组件
│   │   └── components/
│   │       ├── DetailHero.jsx
│   │       ├── OriginSection.jsx
│   │       ├── FeaturesSection.jsx
│   │       ├── TechStackSection.jsx
│   │       ├── YesSirPrivacySection.jsx
│   │       ├── ChangelogSection.jsx
│   │       └── DetailLinks.jsx
│   ├── Profile/
│   │   ├── index.jsx             # Hero / Skills / Contact 组件化
│   │   └── components/
│   │       ├── ProfileHero.jsx
│   │       ├── SkillsSection.jsx
│   │       └── ContactSection.jsx
│   └── Resume/
│       └── index.jsx             # 占位页
├── hooks/
│   └── useTheme.js               # 主题切换逻辑：localStorage + 系统偏好监听
├── utils/
│   └── scrollBuildsGallery.js    # 详情页滚动辅助逻辑
├── assets/
│   └── mockups/
│       └── yessir-cover@2x.jpg
└── styles/
    └── global.css                # CSS 变量 + .fi / .d1~.d8 动画基类
```

---

## 4) 数据驱动：如何新增一个项目（最重要）

编辑 `src/data/projects.js`，新增一个对象，例如：

- `id`：用于路由参数 `/project/:id`
- `mockupType`：用于 `ProjectMockup` 选择预览组件（当前：`yessir` / `kada`）
- `title` / `tagline` / `description` / `detailDescription`
- `tags`（首页卡片标签）
- `techStack`（详情页“技术栈”）
- `stats`：`[{ value, label }, ...]`（详情页“统计行”）
- `features`：`[{ title, description }, ...]`（详情页功能卡片）
- `links.project`、`links.source`

新增完成后：
- 首页会自动渲染新的 `ProjectCard`
- 详情页会自动通过 `useParams + getProjectById` 找到并展示

---

## 5) 主题与动画机制

### 5.1 主题
- 主题变量定义在 `src/styles/global.css`（`[data-theme='light']` / `[data-theme='dark']`）
- 切换逻辑在 `src/hooks/useTheme.js`：
  - 读取/写入 `localStorage.theme`
  - 没手动选择时监听 `prefers-color-scheme` 变化

### 5.2 入场动画（`.fi`）
- 动画类在 `src/styles/global.css`：`.fi` + `.d1~.d8`
- 路由切换重播在 `src/components/layout/MainLayout.jsx`：
  - 监听 `useLocation()`
  - 通过重置 `animation` + 强制 reflow 来触发重新播放

---

## 6) 生产部署（GitHub Actions）

部署工作流：`.github/workflows/deploy.yml`

当前流程：
1. `npm install`
2. `npm run build`
3. 将 `dist/` 同步到服务器：`TARGET: /var/www/pmtools/main`

因为这是 React Router 的 SPA，服务器（Nginx）需要支持 **SPA fallback**，典型是：

- `try_files $uri $uri/ /index.html;`

否则用户刷新 `/project/:id` 这类路径会得到 404。