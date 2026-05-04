# CHANGELOG

## 2026-05-04

### 资讯模块 AI 总结功能

**新增功能：**
- 资讯卡片新增「AI 总结」按钮，点击后调用 DeepSeek API 生成 200-300 字文章摘要
- 新增通用 Modal 弹窗组件，支持 ESC 关闭、点击遮罩关闭、暗色主题适配
- 后端 news-service 新增 `POST /api/summarize` 接口，集成 DeepSeek API，带内存缓存

**样式优化：**
- 资讯卡片标题改用衬线字体（DM Serif Display），与网站整体风格统一
- 「AI 总结」按钮与序号、日期右边缘对齐
- 加载态「正在生成总结…」添加呼吸脉冲动画

**涉及文件：**
- 前端：`src/components/common/Modal.jsx`、`Modal.module.css`、`src/pages/Home/components/NewsItem.jsx`、`NewsItem.module.css`
- 后端：`news-service/news/summarizer.js`、`news-service/server.js`、`news-service/.env`
