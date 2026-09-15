# pmtools 聚合页

个人项目聚合站点，兼各项目的对外展示页（`/project/:id`）。`main` 是生产分支，push 即触发部署。

## 分支与部署

- `dev`：日常开发；`main`：生产
- push `main` → GitHub Actions（`npm install && npm run build` → 部署到服务器）
- 看部署结果：`gh run list --repo xujianjun95/pmtools --limit 3`
- 正式站：`https://pmtools.com.cn/`；同域名下另有 `/dang-analysis/`、`/kada/`

### ⚠️ 合并 dev → main 前必须先看清单

```bash
git log --oneline main..dev      # dev 上有哪些提交会一并发布
```

**dev 上常有与本次发布无关的提交。** 踩过一次：只想发一条更新日志，直接 merge dev，
结果把整个 QDII 世界页改版一起带上了生产，被迫强推回退。

**只发单个改动时，不要 merge 整个 dev**——直接基于 `origin/main` 构造提交，只替换目标文件。
判断某次 merge 会不会夹带无关内容，用：

```bash
BASE=$(git merge-base main dev)
git log --oneline $BASE..main -- <file>   # 该文件在 main 侧的独有提交
git log --oneline $BASE..dev  -- <file>   # 该文件在 dev  侧的独有提交
```

## 各项目详情页的内容

- 项目基本信息：`src/data/projects.js`（`projectData` + `PROJECT_DISPLAY_ORDER`）
- **更新日志：`src/data/changelogs.js`** 的 `changelogByProjectId[<projectId>]`
  - 每条结构：`{ date, title, intro, segments: [{ label, bullets: [{ lead, text }] }] }`
  - **新条目插在数组最前**
  - **版本号写在 `title` 里**，例：`'📊 V1.0.2 新增历史行情与财务指标'`
  - 项目 id：`dang-analysis` / `kada` / `yessir`
- 详情页路由：`/project/:id`

## 对外文案规范（更新日志 / 项目介绍 —— 所有 C 端可见文案）

**只写用户应该知道的。** 写"你能做什么、你会看到什么变化"，不写"我们怎么实现的"。
实现细节、内部架构、错误处理一律不写。

**绝不写暴露历史问题的表述。** 反面例子（已被产品负责人明确否掉）：

> 所有价格都标明数据时间，取不到数据时会直说，不再用旧数字顶上

这一句同时暴露了"以前没标时间""以前会瞎编"，对 C 端是负分。同理不要用
"不再 XX""修复了 XX""此前 XX"这类句式，改成正面描述新行为
（例：气泡**不再**中途闪烁 → 选中文字后气泡**才**出现）。

**粒度**：每条 25–40 字，一句话说完，不解释机制；一个版本 2–3 段、5–10 条为宜。

**落库前自检**：把待发布正文抽出来扫一遍敏感词——
`不再 / 修复 / 此前 / 取不到 / 直说 / 旧数字 / 异常 / 以前 / 现在能`，命中即改写。

**流程**：C 端可见的文案改动**先出草稿给产品负责人确认，确认后才提交/发布**，
不要写完直接推。

> 更完整的项目背景与工具链说明见 dang-analysis 仓库的 `CLAUDE.md`。
