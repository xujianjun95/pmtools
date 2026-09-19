# QDII Hero 世界地图交互重做设计

## 目标

重做 `/qdii` 首屏右侧世界小地图的交互：去掉压暗遮罩，让地图本体成为交互主体，恢复逐国悬停反馈，并把悬停信息改为不遮挡地图的固定信息条。同时清理 `WorldMap` 中从未生效的参数与样式。

本次只改 Hero 区域，不把地图加回 `/qdii/world`，不改该页的国家 pill 与基金表格。

## 现状问题

| 现象 | 根因 |
| --- | --- |
| 悬停时地图被压暗并模糊，视觉上像"禁用" | `.mapVeil` 用 `--text-primary` 16% 叠加 `backdrop-filter: blur(1.5px)`，而地图正是唯一可点对象 |
| 悬停任何国家都没有反馈 | `HeroWorldMap` 传 `quietHover`，`.noHover .geo:hover` 把填色强制还原为 idle；`--map-hover` 在 `global.css` 有定义但全仓库零引用 |
| 悬停信息被丢弃 | `HeroWorldMap.jsx:35-36` 传 `hoverName=""` 与 `onHover={() => {}}` |
| 反馈与点击结果不一致 | 外层整卡可点（去 `/qdii/world`），国家也可点（去 `/qdii/world?country=<id>`），但悬停只浮出同一句"点击地图查看…" |
| 未覆盖国家点了进空状态页 | `cursor: pointer` 加在整卡与每个国家上，`onSelect` 对所有国家都跳转 |
| 状态切换生硬 | `.mapVeil` 只有 `opacity 0↔1` 与 `translateY(6px)→0`，没有中间态 |

`WorldMap` 全仓库只有 `HeroWorldMap` 一个调用点，其中 `showCaption`（默认 `true`）、`coveredIds`（传空集）从未按设计生效，`@keyframes mapTagPulse` 也无引用。

## 组件改动

改动四个文件：

- `src/pages/QdiiMonitor/components/WorldMap.jsx`
- `src/pages/QdiiMonitor/components/WorldMap.module.css`
- `src/pages/QdiiMonitor/components/HeroWorldMap.jsx`
- `src/pages/QdiiMonitor/components/HeroSection.module.css`

### WorldMap

删除 `quietHover` 参数与 `.noHover` 规则、`showCaption` 参数与 `.mapCaption` 区块。

新增 `labels` 参数（`{ [id]: string }`），用于覆盖 `aria-label`；缺省回落到 topojson 的英文国名。

`onSelect` 保持对全部国家上报，由 `HeroWorldMap` 决定是否跳转。

`.geo` 默认 `cursor: default`；`.geoCovered` 改为 `cursor: pointer`。

### 可点国家与圆点标记

覆盖国家共 9 个，全部由 `WORLD_COUNTRIES` 推导，规则统一、无例外：

- 9 国都可点、可聚焦，均带圆点标记（圆点 = 可点，不含例外）
- 美国因 `selectedId="840"` 另获 `--accent` 深色填充，用于表达"本页主角"；其圆点需以 `--bg` 描边，否则在深色填充上不可见
- 其余 8 国圆点为实心 `--accent`
- 非覆盖国家无圆点、`cursor: default`、`tabIndex=-1`、点击不上报跳转

### 悬停视觉：纯 CSS，不触发 React 重渲染

国家聚焦用 CSS 完成，不引入 hover state 驱动地图：

```css
.mapWrap:has(.geo:hover) .geo:not(:hover) { opacity: .5; }
.mapWrap:has(.geo:focus-visible) .geo:not(:focus-visible) { opacity: .5; }
```

地图含 170 余个国家 path，用 state 驱动会让每次悬停重渲染整张图。`WorldMap` 已用 `memo` 包裹，但 `HeroWorldMap` 目前传的是内联箭头函数，`memo` 实际失效；本次用 `useCallback` 固定 `onSelect` / `onHover`，并把覆盖国家集合提为模块级常量，使 `memo` 真正生效。

已知局限：`--map-hover`（`#8f744c`）与 `--accent`（`#7a6040`）色差很小，美国已是 `--accent` 填充，悬停时自身变色不明显。此处不做额外处理——聚焦效果由"其余国家降到 0.5 透明度"承担，信号足够清晰。

### HeroWorldMap

移除整卡 `role="link"`、`tabIndex`、`onClick`、`onKeyDown` 与整个遮罩层。新结构：

```
[ 地图（仅圆点国家可点、可聚焦） ]
[ 信息条 / 默认提示（固定高度） ] [ 查看全部市场 → ]
```

- 覆盖国家集合按上节规则构建，美国仍以 `selectedId="840"` 表示当前页主角
- 悬停或聚焦覆盖国家 → `hoveredId` 更新，信息条显示该国中文名、英文名、基金数、申购状态摘要与限额区间
- 未覆盖国家点击不上报跳转
- 底部右侧为真正的 `<Link to="/qdii/world">查看全部市场 →</Link>`，始终可见、可 Tab、可 Enter，解决"没有悬停就进不去世界页"
- 底部一行用 `min-height` 固定，悬停切换不产生布局位移

信息条文案示例：`日本 JAPAN · 2 只基金 · 均为「限大额」`。状态混合时以 ` / ` 连接；全部暂停时不显示限额区间。

### HeroSection.module.css

删除 `.mapVeil` / `.mapVeilOn` / `.mapCta` / `.mapTagArrow` / `@keyframes mapTagPulse`。`.worldMini` 去掉 `cursor: pointer`（改由国家自身控制）。新增 `.mapFoot`（flex、`min-height` 固定）、`.mapInfo`、`.mapHint`、`.mapAllLink`。

## 降级与可访问性

- `@media (hover: none)`：不显示信息条，点击国家直接跳转，提示文案改为「点击圆点国家进入对应市场」
- `@media (prefers-reduced-motion: reduce)`：`transition: none`
- 覆盖国家 `aria-label` 为 `日本，2 只基金，进入该国市场`
- 信息条 `aria-live="polite"`，键盘聚焦国家时由读屏播报

## 不做的事

- 不把地图加回 `/qdii/world`
- 不改 `/qdii/world` 的国家 pill 与基金表格
- 不引入 GSAP 或其他动效库，沿用现有 `.fi` 入场动画
- 不做跟随光标的 tooltip

## 验证

用 Playwright 断言，不依赖肉眼判断：

- 悬停时不再出现遮罩或模糊，地图保持清晰
- 悬停与键盘聚焦覆盖国家时，该国填色变为 `--map-hover`，其余国家透明度为 0.5
- 悬停与聚焦同一国家时信息条文本一致
- 点击覆盖国家跳转 `/qdii/world?country=<id>` 且列表选中该国
- 点击未覆盖国家不发生跳转
- 底部行在悬停切换前后高度不变，无布局位移
- `hover: none` 上下文中不渲染信息条，点击国家直接跳转
- 亮色与暗色主题各测一遍
- `WorldMap` 与 `HeroSection.module.css` 中不再残留 `quietHover`、`showCaption`、`.noHover`、`.mapCaption`、`mapTagPulse` 引用
- 执行 `npm run build`、`npm run lint` 通过
