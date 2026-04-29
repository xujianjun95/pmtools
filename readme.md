```markdown
# Pmtools 个人项目集 — 技术文档

## 1. 项目概述

这是一个个人项目展示聚合页面，用于向面试官或合作者展示自己的独立开发作品。

- **定位**：项目展示为主，个人简介为辅
- **风格**：高级、干净、克制、有质感
- **配色**：暖白底 + 哑铜强调色，支持亮色/暗色模式
- **字体**：DM Serif Display（标题）+ Source Sans 3（正文）+ DM Mono（标签/数字/代码元素）
- **技术栈**：纯 HTML/CSS/JS 单文件方案（当前），后续将迁移至 React + Vite 部署到 Pmtools.com.cn

---

## 2. 页面结构

```
整个站点是一个单页应用（SPA），通过 JS 切换页面显示，不刷新浏览器。

页面层级：
├── Header（顶部导航）
│   ├── Logo：Pmtools（点击回首页）
│   ├── 导航：项目 | 关于
│   └── 主题切换按钮（日/月）
│
├── Home（首页 — 项目展示）
│   ├── Intro 区：标题"作品集" + 一句话描述
│   ├── Projects Grid：2 列并排的项目卡片
│   │   ├── YesSir 卡片
│   │   └── 咔哒 卡片
│   └── Placeholder Grid：2 列占位卡片（预留未来项目）
│
├── Project Detail（项目详情页）
│   ├── YesSir 详情
│   │   ├── Hero：左侧文字 + 右侧产品预览图
│   │   ├── Features：2x2 功能卡片网格
│   │   ├── Tech Stack：技术标签
│   │   └── Links：访问项目 / 源代码按钮
│   └── 咔哒 详情（同上结构）
│
├── Profile（个人简介页）
│   ├── Hero：姓名 + 定位 + 自我介绍
│   ├── Skills：按类别分组的技能标签
│   └── Contact：联系方式列表
│
└── Footer
```

---

## 3. 设计系统

### 3.1 CSS 变量

所有颜色、字体、间距通过 CSS 变量管理，定义在 `:root` 和 `[data-theme]` 选择器中。

**亮色主题 `[data-theme="light"]`：**
```
--bg: #f7f5f2              页面背景
--surface: #ffffff          卡片背景
--border: #ddd8d0           边框
--text-primary: #1a1714     标题文字（最深）
--text-body: #3a3530        正文文字（深）
--text-secondary: #555048   次要文字
--text-muted: #8a8478       最浅文字/标签
--accent: #7a6040           强调色（哑铜）
--accent-hover: #6a5235     强调色 hover
```

**暗色主题 `[data-theme="dark"]`：**
```
--bg: #111010
--surface: #1c1a18
--border: #2e2b26
--text-primary: #ede8e0
--text-body: #c8c2b8
--text-secondary: #a09888
--text-muted: #6a6258
--accent: #c4a070
--accent-hover: #d4b080
```

### 3.2 字体

```
--font-display: 'DM Serif Display'   标题、项目名、数字
--font-body: 'Source Sans 3'          正文、描述
--font-mono: 'DM Mono'               标签、导航、技术元素、代码
```

通过 Google Fonts CDN 加载，`<link>` 标签在 `<head>` 中。

### 3.3 字号层级

```
首页大标题：    clamp(1.5rem, 2.8vw, 2rem)    DM Serif Display
项目名：       1.5rem                          DM Serif Display
详情页标题：    clamp(1.8rem, 3.5vw, 2.6rem)  DM Serif Display
Section 标题：  clamp(1.3rem, 2.2vw, 1.6rem)  DM Serif Display
正文：         0.95rem ~ 1.05rem               Source Sans 3, weight 400
标签：         0.68rem ~ 0.75rem               DM Mono, weight 400
导航：         0.75rem                         DM Mono, weight 400
```

### 3.4 间距

页面边距 `--margin-page: 100px`（平板 48px，手机 20px），最大宽度 1400px 居中。

Section 间距约 56-72px，卡片内边距 24-28px。

### 3.5 圆角与阴影

```
卡片圆角：10px（--radius）
标签圆角：100px（胶囊形）
按钮圆角：6px

亮色阴影：0 2px 24px rgba(26,23,20,0.06)
暗色阴影：0 2px 24px rgba(0,0,0,0.3)
Hover 阴影加深 + translateY(-3px) 浮起效果
```

---

## 4. 组件说明

### 4.1 Header

```
结构：Logo + Nav Links + Theme Toggle
Logo 字体：DM Mono, 大写, letter-spacing 0.1em
导航项：带 active 状态下划线（accent 色 1.5px 线）
```

### 4.2 Theme Toggle（主题切换）

```
功能：亮色/暗色切换
存储：localStorage['theme']
回退：跟随系统 prefers-color-scheme
UI：48x26px 胶囊形，内有圆形滑块 + 日月图标
切换时所有颜色通过 CSS transition 0.4s 平滑过渡
```

### 4.3 Project Card（首页项目卡片）

```
结构：上半部分产品预览 + 下半部分文字信息

上半部分（card-mockup）：
  - 纯 CSS 绘制的产品界面模拟图
  - YesSir：深色背景，搜索框 + Tab + 列表卡片
  - 咔哒：深色代码编辑器 + 浅色预览面板分屏

下半部分（card-content）：
  - 序号（DM Serif Display 斜体）
  - 项目名
  - 一句话定位（accent 色）
  - 描述（2-3 行）
  - 技术标签（胶囊形，DM Mono）
  - "查看详情 →" 链接

交互：
  - hover：浮起 3px + 阴影加深 + 边框变 accent 色
  - hover 时标签和箭头变 accent 色
  - 点击跳转到对应详情页
```

### 4.4 Placeholder Card（占位卡片）

```
结构：虚线边框 + 序号 + "即将推出" + 简短描述
用途：预留未来项目位置，视觉上与正式卡片对齐
交互：hover 边框变实色，无跳转
```

### 4.5 Detail Page（项目详情页）

```
结构：
  - 返回链接（← 返回项目列表）
  - Hero 区：左文字 + 右产品预览（大尺寸 mockup）
  - Features：2x2 网格卡片，hover 边框变色
  - Tech Stack：胶囊标签
  - Links：实心按钮（primary）+ 描边按钮（secondary）
```

### 4.6 Profile Page（个人简介页）

```
结构：
  - Hero：姓名 + 定位 + 段落介绍
  - Skills：按 Frontend / Extension / Design 分组，每组有胶囊标签
  - Contact：Email / GitHub / Website 列表，链接有下划线 hover 效果
```

### 4.7 Mockup（产品预览图）

```
YesSir Mockup：
  - 模拟 Chrome 插件的新标签页界面
  - 顶部：三个圆点 + URL 栏
  - 中间：品牌名 + 搜索框 + Tab 切换 + 结果列表卡片
  - 配色：深蓝渐变背景，白色半透明元素

咔哒 Mockup：
  - 模拟代码编辑器的分屏界面
  - 顶部：工具栏（结构/布局/文本/导出）
  - 左侧：代码行（用彩色色块模拟语法高亮）
  - 右侧：预览面板（浅色背景 + 占位块）
  - 配色：VS Code 风格深色编辑器 + 浅色预览
```

---

## 5. 交互逻辑

### 5.1 页面切换（SPA 路由）

```javascript
function show(page) {
  // 1. 隐藏所有 .page，移除所有 .nav-link 的 active
  // 2. 显示 #page-{name}，添加 .active 类
  // 3. 重新触发该页面内所有 .fi 元素的入场动画
  // 4. 更新导航栏 active 状态
  // 5. 滚动到顶部
}
```

页面 ID 映射：
- `home` → 首页
- `yessir` → YesSir 详情
- `kada` → 咔哒详情
- `profile` → 个人简介

### 5.2 入场动画

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

- 所有需要动画的元素加 `.fi` 类
- 延迟通过 `.d1` ~ `.d8` 控制，每级差 60ms
- 缓动：`cubic-bezier(0.22, 1, 0.36, 1)`（先快后慢，有弹性）
- 切换页面时通过 JS 重置 animation 属性实现重新播放

### 5.3 主题切换

```javascript
function toggleTheme() {
  // 读取当前 data-theme
  // 切换为另一个值
  // 存入 localStorage
}

// 初始化时：
// 1. 优先读 localStorage
// 2. 没有则读系统 prefers-color-scheme
// 3. 监听系统主题变化（仅在用户未手动选择时生效）
```

---

## 6. 如何扩展

### 6.1 添加新项目

**Step 1：在首页添加卡片**

在 `.projects-grid` 内新增一个 `.project-card`，结构参考现有卡片：
- `card-mockup` 区域放产品预览（可以是 mockup 或真实截图）
- `card-content` 区域放项目信息
- `onclick="show('new-project')"` 指向新页面 ID

**Step 2：添加详情页**

在 `<main>` 内新增一个 `<div id="page-new-project" class="page">`，结构参考 YesSir 或咔哒详情页。

**Step 3：更新占位卡片**

如果有占位卡片，从 `.placeholder-grid` 中移除对应的占位。

**Step 4：添加导航（可选）**

如果项目很多，可以在 Header 的 nav 中加项目下拉或独立导航。

### 6.2 添加新的 Mockup

Mockup 是纯 CSS 绘制的，不依赖图片。创建新 mockup 的步骤：

1. 在 `<style>` 中定义新的 mock 类（如 `.mock-newproject`）
2. 用 div + CSS 模拟产品界面的关键元素
3. 保持深色/浅色层次感，用 `rgba` 控制透明度
4. 在卡片和详情页中引用

### 6.3 修改配色

只需修改 `[data-theme="light"]` 和 `[data-theme="dark"]` 中的 CSS 变量值，所有颜色会自动更新。

### 6.4 修改字体

1. 替换 Google Fonts `<link>` 中的字体名
2. 更新 `:root` 中的 `--font-display` / `--font-body` / `--font-mono`

---

## 7. 迁移到 React 的计划

当前是单 HTML 文件原型，后续迁移到 React 时：

```
pmtools-portfolio/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx                    入口
    ├── App.jsx                     路由配置（react-router-dom）
    ├── data/
    │   └── projects.js             项目数据（名称、描述、功能、技术栈、链接）
    ├── hooks/
    │   └── useTheme.js             主题切换逻辑
    ├── components/
    │   ├── Header.jsx              顶部导航
    │   ├── Footer.jsx              底部
    │   ├── ThemeToggle.jsx         主题切换按钮
    │   ├── ProjectCard.jsx         项目卡片（首页）
    │   ├── PlaceholderCard.jsx     占位卡片
    │   ├── MockupYesSir.jsx        YesSir 产品预览组件
    │   ├── MockupKada.jsx          咔哒产品预览组件
    │   └── FadeIn.jsx              入场动画包装组件
    ├── pages/
    │   ├── Home.jsx                首页
    │   ├── ProjectDetail.jsx       项目详情（根据 slug 动态渲染）
    │   └── Profile.jsx             个人简介
    └── styles/
        ├── global.css              全局样式、CSS 变量、字体
        ├── header.css
        ├── home.css
        ├── project-detail.css
        ├── profile.css
        └── mockups.css             所有产品预览样式
```

关键迁移点：
- 项目数据抽到 `projects.js`，新增项目只需加数据，页面自动渲染
- `ProjectDetail.jsx` 根据 URL slug 动态查找项目数据
- Mockup 组件化，每个项目可以有独立的预览组件
- 主题逻辑抽成 `useTheme` 自定义 Hook
- 服务器需配置 SPA fallback（所有路由指向 index.html）

---

## 8. 部署

### 当前（单 HTML）
直接放到任意静态服务器即可。

### React 版本（目标）
```
1. npm run build → 生成 dist/
2. 将 dist/ 部署到 Pmtools.com.cn 服务器
3. Nginx 配置：
   location / {
     try_files $uri $uri/ /index.html;
   }
```

---

## 9. 待办 / 后续优化

- [ ] 替换所有占位文字（姓名、介绍、联系方式、项目链接）
- [ ] 为 YesSir 和咔哒添加真实的产品截图（替换 CSS Mockup）
- [ ] 迁移到 React + Vite
- [ ] 添加页面切换的路由动画（如 fade 或 slide）
- [ ] 考虑添加项目的时间线或版本信息
- [ ] 移动端适配细节优化
- [ ] SEO 优化（meta 标签、Open Graph）
- [ ] 考虑是否需要深色模式下 Mockup 的配色微调
```

---

这份文档覆盖了设计系统、组件结构、交互逻辑、扩展方式和迁移计划。你直接把这个 md 文件丢给 Cursor，它就能基于现有代码继续开发了。需要调整什么随时说。