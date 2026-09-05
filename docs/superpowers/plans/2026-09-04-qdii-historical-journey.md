# QDII「鉴往」历史定投旅程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 `/qdii/dca` 专业回测面板改造成从指定年份自动播放、在历史事件处两幕式暂停、允许调整后续月投并最终返回 QDII 监控的历史穿越体验。

**Architecture:** 保留现有路由与月度行情文件，将纯计算、事件筛选、播放状态机和展示组件拆开。页面先一次性计算完整月度账户轨迹，播放层只控制当前可见游标；金额调整后从既有调整记录重新计算轨迹，事件结果始终由轨迹实时派生。

**Tech Stack:** React 19、React Router 7、Vite 8、CSS Modules、原生 SVG、Node.js `node:test`、Playwright。

**Spec:** `docs/superpowers/specs/2026-09-04-qdii-historical-journey-design.md`

## Global Constraints

- 在现有 `dev` 分支和 `/qdii/dca` 路由内做最小必要修改，不引入新的 UI、图表或状态管理依赖。
- V1 只支持纳斯达克 100 与标普 500，不支持混合组合、再平衡或未来收益预测。
- 开始年份从 2001 起；当最新数据月份不是 12 月时，上限为最新数据年份的上一年，数据覆盖 12 月时允许该年份。
- 账户金额使用人民币；保留汇率影响，不扣除基金费率、跟踪误差或实际交易成本。
- 每段旅程最多暂停展示 5 个事件；事件采用人工优先级和不重叠的独立影响窗口。
- 主图只显示累计投入与账户资产；默认删除对照线、滚动窗口、逐年明细和复杂收益指标。
- 不修改 QDII 监控数据接口字段；只允许通过可选查询参数初始化现有指数筛选。
- 所有计时器在状态切换、页面隐藏、组件卸载和重新开始时清理。
- 不执行 `git commit` 或 `git push`，除非用户在实施阶段明确授权。

## Planned File Structure

| Path | Responsibility |
| --- | --- |
| `src/pages/QdiiMonitor/utils/dca.js` | 月度人民币收益、旅程轨迹、事件结果和最终总结的纯函数 |
| `src/pages/QdiiMonitor/utils/journeyState.js` | 播放状态、事件两幕和金额调整的 reducer |
| `src/pages/QdiiMonitor/components/DcaSimulator/index.jsx` | 数据加载、参数状态、轨迹重算和页面级编排 |
| `src/pages/QdiiMonitor/components/DcaSimulator/JourneySetup.jsx` | 出发年份、指数和初始金额表单 |
| `src/pages/QdiiMonitor/components/DcaSimulator/JourneyPlayer.jsx` | 播放计时器、可见月份和控制按钮 |
| `src/pages/QdiiMonitor/components/DcaSimulator/DcaChart.jsx` | 只绘制已播放区间的投入线与账户线 |
| `src/pages/QdiiMonitor/components/DcaSimulator/EventDialog.jsx` | 事件第一幕与第二幕 |
| `src/pages/QdiiMonitor/components/DcaSimulator/AmountAdjustDialog.jsx` | 后续月投金额调整 |
| `src/pages/QdiiMonitor/components/DcaSimulator/JourneySummary.jsx` | 终点历史答卷和 QDII 返回入口 |
| `src/pages/QdiiMonitor/components/DcaSimulator/DcaSimulator.module.css` | 开始页、播放器、弹层、总结和响应式样式 |
| `public/qdii/simulation-events.json` | 人工核对的事件窗口、优先级、固定文案和来源 |
| `src/pages/QdiiMonitor/index.jsx` | 读取 `index` 查询参数初始化现有筛选 |
| `package.json` | 增加不引入依赖的 DCA 单测命令 |
| `scripts/dca-engine.test.mjs` | 纯计算测试 |
| `scripts/dca-state.test.mjs` | 播放状态机测试 |
| `scripts/dca-smoke.mjs` | 页面核心流程 Playwright 冒烟测试 |

---

### Task 1: 建立历史旅程纯计算引擎

**Files:**
- Modify: `src/pages/QdiiMonitor/utils/dca.js`
- Create: `scripts/dca-engine.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `simulation-data.json.monthly` 中的 `ym`、`ndx`、`spx`、`fx` 和 `dividend_assumption.spx_annual`。
- Produces: `getAvailableStartYears(monthly)`、`buildJourneyCurve(monthly, config)`、`summarizeJourney(curve)`、`calculateEventOutcome(curve, event)`。
- `config` shape: `{ assetKey: 'ndx' | 'spx', startYear: number, initialAmount: number, amountChanges: Array<{ effectiveYm: string, amount: number }> }`。
- curve point shape: `{ ym, invested, value, amount, profit, profitRate, drawdown }`。

- [ ] **Step 1: 为年份上限、金额调整、汇率收益和统计口径写失败测试**

```js
// scripts/dca-engine.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildJourneyCurve,
  calculateEventOutcome,
  getAvailableStartYears,
  summarizeJourney,
} from '../src/pages/QdiiMonitor/utils/dca.js'

const monthly = [
  { ym: '2020-12', ndx: 100, spx: 100, fx: 7 },
  { ym: '2021-01', ndx: 110, spx: 105, fx: 7 },
  { ym: '2021-02', ndx: 88, spx: 94.5, fx: 7 },
  { ym: '2021-03', ndx: 96.8, spx: 99.225, fx: 7 },
]

test('start years exclude an incomplete latest year', () => {
  assert.deepEqual(getAvailableStartYears([{ ym: '2001-01' }, { ym: '2026-08' }]), [2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025])
})

test('amount change affects only its effective month and later', () => {
  const curve = buildJourneyCurve(monthly, {
    assetKey: 'ndx', startYear: 2021, initialAmount: 1000,
    amountChanges: [{ effectiveYm: '2021-03', amount: 2000 }],
  })
  assert.deepEqual(curve.map((point) => point.amount), [1000, 1000, 2000])
  assert.deepEqual(curve.map((point) => point.invested), [1000, 2000, 4000])
})

test('summary counts consecutive months below invested principal', () => {
  const curve = buildJourneyCurve(monthly, {
    assetKey: 'ndx', startYear: 2021, initialAmount: 1000, amountChanges: [],
  })
  const summary = summarizeJourney(curve)
  assert.equal(summary.longestBelowPrincipalMonths, 2)
  assert.equal(summary.startAmount, 1000)
  assert.equal(summary.finalAmount, 1000)
})

test('event outcome separates loss against principal from peak drawdown', () => {
  const curve = buildJourneyCurve(monthly, {
    assetKey: 'ndx', startYear: 2021, initialAmount: 1000, amountChanges: [],
  })
  const outcome = calculateEventOutcome(curve, { startYm: '2021-01', impactEndYm: '2021-03' })
  assert.equal(outcome.worstYm, '2021-02')
  assert.ok(Number.isFinite(outcome.profitRate))
  assert.ok(Number.isFinite(outcome.peakDrawdown))
})
```

- [ ] **Step 2: 增加单测命令并确认测试先失败**

```json
{
  "scripts": {
    "test:dca": "node --test scripts/dca-engine.test.mjs scripts/dca-state.test.mjs"
  }
}
```

Run: `node --test scripts/dca-engine.test.mjs`  
Expected: FAIL，提示新导出函数不存在。

- [ ] **Step 3: 用纯函数实现最小旅程计算**

```js
export function getAvailableStartYears(monthly) {
  if (!Array.isArray(monthly) || monthly.length === 0) return []
  const lastYm = monthly.at(-1)?.ym
  const [lastYear, lastMonth] = String(lastYm).split('-').map(Number)
  if (!Number.isInteger(lastYear) || !Number.isInteger(lastMonth)) return []
  const maxYear = lastMonth === 12 ? lastYear : lastYear - 1
  return Array.from({ length: Math.max(0, maxYear - 2001 + 1) }, (_, index) => 2001 + index)
}

function monthlyAmountFor(ym, initialAmount, amountChanges) {
  let amount = initialAmount
  for (const change of [...amountChanges].sort((a, b) => a.effectiveYm.localeCompare(b.effectiveYm))) {
    if (change.effectiveYm <= ym) amount = change.amount
  }
  return amount
}

export function buildJourneyCurve(monthly, config, spxDivAnnual = 0.0135) {
  const { assetKey, startYear, initialAmount, amountChanges } = config
  if (!['ndx', 'spx'].includes(assetKey)) throw new Error('不支持的定投标的')
  if (!Number.isFinite(initialAmount) || initialAmount <= 0) throw new Error('月投金额必须大于 0')
  const startIndex = monthly.findIndex((row) => row.ym === `${startYear}-01`)
  if (startIndex < 0) throw new Error('所选年份缺少 1 月行情')
  const rows = monthly.slice(startIndex)
  let value = 0
  let invested = 0
  let peak = 0
  return rows.map((row, index) => {
    const amount = monthlyAmountFor(row.ym, initialAmount, amountChanges)
    invested += amount
    let monthlyReturn = 0
    if (index > 0) {
      const previous = rows[index - 1]
      if (previous[assetKey] == null || row[assetKey] == null || previous.fx == null || row.fx == null) {
        throw new Error(`${row.ym} 缺少连续行情`)
      }
      const usdReturn = row[assetKey] / previous[assetKey] - 1 + (assetKey === 'spx' ? spxDivAnnual / 12 : 0)
      monthlyReturn = (1 + usdReturn) * (row.fx / previous.fx) - 1
    }
    value = (value + amount) * (1 + monthlyReturn)
    peak = Math.max(peak, value)
    const profit = value - invested
    return {
      ym: row.ym, invested, value, amount, profit,
      profitRate: invested > 0 ? profit / invested : 0,
      drawdown: peak > 0 ? value / peak - 1 : 0,
    }
  })
}
```

实现 `summarizeJourney` 时扫描整条曲线并返回 `invested`、`finalValue`、`worstProfit`、`worstProfitRate`、`longestBelowPrincipalMonths`、`startAmount`、`finalAmount` 和 `amountChangeCount`。`calculateEventOutcome` 只截取 `[startYm, impactEndYm]`，分别找最小 `profitRate` 与最小 `drawdown`，不得混用分母。

- [ ] **Step 4: 运行单测并修正测试夹具的精确期望值**

Run: `node --test scripts/dca-engine.test.mjs`  
Expected: PASS，所有金额使用小样本手工计算值断言，不使用截图值。

- [ ] **Step 5: 运行静态检查**

Run: `npm run lint -- --quiet`  
Expected: exit 0。

---

### Task 2: 规范事件数据并实现筛选

**Files:**
- Modify: `public/qdii/simulation-events.json`
- Modify: `src/pages/QdiiMonitor/utils/dca.js`
- Modify: `scripts/dca-engine.test.mjs`

**Interfaces:**
- Consumes: event shape `{ id, title, startYm, impactEndYm, priority, what, why, outcomeLead, sources }`。
- Produces: `selectJourneyEvents(events, { startYm, endYm, limit: 5 })`，按优先级选取、再按时间排序的非重叠事件数组。

- [ ] **Step 1: 写事件范围、上限、排序和重叠处理的失败测试**

```js
test('event selection keeps at most five non-overlapping high-priority events in time order', () => {
  const events = [
    { id: 'a', startYm: '2008-09', impactEndYm: '2009-03', priority: 100 },
    { id: 'b', startYm: '2008-12', impactEndYm: '2009-05', priority: 20 },
    { id: 'c', startYm: '2020-02', impactEndYm: '2020-03', priority: 95 },
    { id: 'd', startYm: '2001-09', impactEndYm: '2001-12', priority: 90 },
    { id: 'e', startYm: '2022-03', impactEndYm: '2022-10', priority: 85 },
    { id: 'f', startYm: '2015-08', impactEndYm: '2016-02', priority: 65 },
    { id: 'g', startYm: '2018-10', impactEndYm: '2018-12', priority: 55 },
  ]
  const selected = selectJourneyEvents(events, { startYm: '2001-01', endYm: '2026-08', limit: 5 })
  assert.deepEqual(selected.map((event) => event.id), ['d', 'a', 'f', 'c', 'e'])
  assert.equal(selected.some((event) => event.id === 'b'), false)
})
```

- [ ] **Step 2: 实现确定性的事件筛选**

```js
export function selectJourneyEvents(events, { startYm, endYm, limit = 5 }) {
  const candidates = events
    .filter((event) => event.startYm >= startYm && event.impactEndYm <= endYm)
    .sort((a, b) => b.priority - a.priority || a.startYm.localeCompare(b.startYm))
  const selected = []
  for (const event of candidates) {
    const overlaps = selected.some((chosen) =>
      event.startYm <= chosen.impactEndYm && chosen.startYm <= event.impactEndYm)
    if (!overlaps) selected.push(event)
    if (selected.length === limit) break
  }
  return selected.sort((a, b) => a.startYm.localeCompare(b.startYm))
}
```

- [ ] **Step 3: 将事件 JSON 改成可验证结构**

事件目录使用以下 7 个非重叠候选窗口：

| id | startYm | impactEndYm | priority |
| --- | --- | --- | --- |
| `september-11` | `2001-09` | `2001-12` | 90 |
| `global-financial-crisis` | `2008-09` | `2009-03` | 100 |
| `euro-debt-crisis` | `2011-07` | `2011-10` | 60 |
| `rmb-fixing-reform` | `2015-08` | `2016-02` | 65 |
| `trade-and-rate-shock` | `2018-10` | `2018-12` | 55 |
| `covid-shock` | `2020-02` | `2020-03` | 95 |
| `inflation-rate-hikes` | `2022-03` | `2022-10` | 85 |

每条记录使用同一字段集合：

```json
{
  "id": "september-11",
  "title": "911 事件",
  "startYm": "2001-09",
  "impactEndYm": "2001-12",
  "priority": 90,
  "what": "2001 年 9 月 11 日发生恐怖袭击，美国金融市场与支付系统受到严重扰动。",
  "why": "市场短期关闭并在恢复交易后重新评估经济与安全风险。",
  "outcomeLead": "接下来的这段市场冲击，对你的账户意味着：",
  "sources": [
    {
      "label": "Federal Reserve History",
      "url": "https://www.federalreservehistory.org/essays/september-11"
    }
  ]
}
```

其余事件在写入前分别用美联储、人民银行、世界卫生组织、欧洲央行等一手资料核对日期和事实。删除现有依赖混合组合的 `tip` 文案；市场涨跌数字不写死在事件说明中，由轨迹计算产生。

- [ ] **Step 4: 验证 JSON 和事件测试**

Run: `node -e "JSON.parse(require('node:fs').readFileSync('public/qdii/simulation-events.json','utf8')); console.log('events ok')"`  
Expected: `events ok`。

Run: `node --test scripts/dca-engine.test.mjs`  
Expected: PASS。

---

### Task 3: 建立可测试的播放状态机

**Files:**
- Create: `src/pages/QdiiMonitor/utils/journeyState.js`
- Create: `scripts/dca-state.test.mjs`

**Interfaces:**
- Consumes: curve length、当前 cursor、按时间排序的 selected events。
- Produces: `createJourneyState()` 与 `journeyReducer(state, action)`。
- phase union: `setup | playing | paused | eventIntro | eventImpact | eventOutcome | adjustingAmount | completed | error`。

- [ ] **Step 1: 写普通推进、事件两幕、金额面板返回和重置测试**

```js
// scripts/dca-state.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { createJourneyState, journeyReducer } from '../src/pages/QdiiMonitor/utils/journeyState.js'

test('tick pauses at an event intro exactly once', () => {
  let state = createJourneyState()
  state = journeyReducer(state, { type: 'START', endIndex: 10 })
  state = journeyReducer(state, { type: 'TICK', nextIndex: 3, eventId: 'covid' })
  assert.equal(state.phase, 'eventIntro')
  assert.equal(state.activeEventId, 'covid')
  assert.equal(state.cursor, 3)
})

test('event intro continues through impact and ends at outcome', () => {
  const intro = { ...createJourneyState(), phase: 'eventIntro', cursor: 3, activeEventId: 'covid', endIndex: 10 }
  const impact = journeyReducer(intro, { type: 'ACK_EVENT_INTRO', impactEndIndex: 5 })
  assert.equal(impact.phase, 'eventImpact')
  const outcome = journeyReducer(impact, { type: 'REACH_EVENT_END' })
  assert.equal(outcome.phase, 'eventOutcome')
})

test('amount dialog closes back to the phase that opened it', () => {
  const playing = { ...createJourneyState(), phase: 'playing', cursor: 4, endIndex: 10 }
  const adjusting = journeyReducer(playing, { type: 'OPEN_AMOUNT' })
  assert.equal(adjusting.returnPhase, 'playing')
  assert.equal(journeyReducer(adjusting, { type: 'CLOSE_AMOUNT' }).phase, 'playing')
})

test('pausing an event impact resumes the same phase', () => {
  const impact = { ...createJourneyState(), phase: 'eventImpact', cursor: 4, impactEndIndex: 6 }
  const paused = journeyReducer(impact, { type: 'PAUSE' })
  assert.equal(paused.returnPhase, 'eventImpact')
  assert.equal(journeyReducer(paused, { type: 'RESUME' }).phase, 'eventImpact')
})
```

- [ ] **Step 2: 运行状态机测试确认失败**

Run: `node --test scripts/dca-state.test.mjs`  
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现显式 reducer，不在 reducer 内创建计时器**

```js
export const initialJourneyState = {
  phase: 'setup', cursor: 0, endIndex: 0,
  activeEventId: null, impactEndIndex: null, returnPhase: null,
}

export const createJourneyState = () => ({ ...initialJourneyState })

export function journeyReducer(state, action) {
  switch (action.type) {
    case 'START': return { ...createJourneyState(), phase: 'playing', endIndex: action.endIndex }
    case 'TICK':
      return action.eventId
        ? { ...state, cursor: action.nextIndex, phase: 'eventIntro', activeEventId: action.eventId }
        : { ...state, cursor: action.nextIndex }
    case 'PAUSE':
      return ['playing', 'eventImpact'].includes(state.phase)
        ? { ...state, phase: 'paused', returnPhase: state.phase }
        : state
    case 'RESUME':
      return state.phase === 'paused'
        ? { ...state, phase: state.returnPhase ?? 'playing', returnPhase: null }
        : state
    case 'ACK_EVENT_INTRO': return { ...state, phase: 'eventImpact', impactEndIndex: action.impactEndIndex }
    case 'REACH_EVENT_END': return { ...state, phase: 'eventOutcome' }
    case 'ACK_EVENT_OUTCOME': return { ...state, phase: state.cursor >= state.endIndex ? 'completed' : 'playing', activeEventId: null, impactEndIndex: null }
    case 'OPEN_AMOUNT': return { ...state, phase: 'adjustingAmount', returnPhase: state.phase }
    case 'CLOSE_AMOUNT': return { ...state, phase: state.returnPhase ?? 'paused', returnPhase: null }
    case 'COMPLETE': return { ...state, cursor: state.endIndex, phase: 'completed' }
    case 'FAIL': return { ...state, phase: 'error', error: action.error }
    case 'RESTART': return createJourneyState()
    default: return state
  }
}
```

- [ ] **Step 4: 补齐跳转和重复事件保护测试并运行全部单测**

验证 `JUMP_TO_NEXT_EVENT` 不跳过事件、已经完成的事件不会再次触发、`RESTART` 清空所有事件状态。

Run: `npm run test:dca`  
Expected: PASS。

---

### Task 4: 重建开始页与页面级编排

**Files:**
- Modify: `src/pages/QdiiMonitor/components/DcaSimulator/index.jsx`
- Create: `src/pages/QdiiMonitor/components/DcaSimulator/JourneySetup.jsx`
- Modify: `src/pages/DcaPage/index.jsx`
- Modify: `src/pages/QdiiMonitor/components/DcaSimulator/DcaSimulator.module.css`

**Interfaces:**
- `JourneySetup({ years, onStart })`。
- `onStart({ startYear, assetKey, initialAmount })` 只在表单合法时触发。
- 页面编排持有 `simData`、`eventData`、`config`、`amountChanges`、`curve` 和 reducer state。

- [ ] **Step 1: 将行情与事件加载拆成可独立失败的请求**

```jsx
useEffect(() => {
  const controller = new AbortController()
  fetch('/qdii/simulation-data.json', { cache: 'no-store', signal: controller.signal })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error(`行情数据 HTTP ${response.status}`)))
    .then(setSimData)
    .catch((error) => error.name !== 'AbortError' && setDataError(error.message))
  fetch('/qdii/simulation-events.json', { cache: 'no-store', signal: controller.signal })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error(`事件数据 HTTP ${response.status}`)))
    .then((payload) => setEvents(payload.events ?? []))
    .catch((error) => error.name !== 'AbortError' && setEventError(error.message))
  return () => controller.abort()
}, [])
```

行情失败显示重试页；事件失败仍允许开始，但在开始页显示“历史事件暂不可用，本次将直接播放至终点”。重试按钮重新触发同一加载函数，不要求刷新整个页面。

- [ ] **Step 2: 实现只含三个字段的开始表单**

```jsx
export default function JourneySetup({ years, onStart }) {
  const [startYear, setStartYear] = useState(years[0] ?? '')
  const [assetKey, setAssetKey] = useState('ndx')
  const [amountText, setAmountText] = useState('1000')
  const amount = Number(amountText)
  const valid = years.includes(Number(startYear)) && ['ndx', 'spx'].includes(assetKey) && Number.isFinite(amount) && amount > 0
  return (
    <form onSubmit={(event) => { event.preventDefault(); if (valid) onStart({ startYear: Number(startYear), assetKey, initialAmount: amount }) }}>
      <span className="section-label">鉴往</span>
      <h1>以史为鉴，可以知兴替</h1>
      <p>选择一个年份出发，看看你的定投计划如何穿越真实历史，一直走到今天。</p>
      {/* 年份 select、二选一按钮、金额 input 和 disabled 提交按钮 */}
    </form>
  )
}
```

表单字段必须有关联 `label`，非法金额显示行内错误；按钮禁用期间不响应重复提交。

- [ ] **Step 3: 在编排组件中从参数创建曲线与精选事件**

```jsx
const curve = useMemo(() => config
  ? buildJourneyCurve(simData.monthly, { ...config, amountChanges }, simData.dividend_assumption?.spx_annual)
  : [], [simData, config, amountChanges])

const selectedEvents = useMemo(() => curve.length
  ? selectJourneyEvents(events, { startYm: curve[0].ym, endYm: curve.at(-1).ym, limit: 5 })
  : [], [curve, events])
```

开始新旅程时清空 `amountChanges` 并 dispatch `START`。重新开始返回设置页，不保留上次输入之外的运行状态。

- [ ] **Step 4: 删除旧面板的 UI 依赖**

从 `index.jsx` 移除混合权重、年限、费用、对照线、滚动窗口、逐年表格和点击事件标记相关状态。暂时保留 `dca.js` 中只有新组件使用的导出，删除无人引用的旧计算导出。

- [ ] **Step 5: 验证开始页**

Run: `npm run lint -- --quiet`  
Expected: exit 0。

Manual: 访问 `/qdii/dca`，确认只有年份、指数、金额三个输入；空金额、0、负数不能开始；事件 JSON 请求失败时仍能开始普通旅程。

---

### Task 5: 实现渐进折线、播放控制与两幕式事件

**Files:**
- Create: `src/pages/QdiiMonitor/components/DcaSimulator/JourneyPlayer.jsx`
- Modify: `src/pages/QdiiMonitor/components/DcaSimulator/DcaChart.jsx`
- Create: `src/pages/QdiiMonitor/components/DcaSimulator/EventDialog.jsx`
- Modify: `src/pages/QdiiMonitor/components/DcaSimulator/DcaSimulator.module.css`

**Interfaces:**
- `JourneyPlayer({ curve, events, state, dispatch, onAdjustAmount })`。
- `DcaChart({ curve, cursor })` 只渲染 `curve.slice(0, cursor + 1)`。
- `EventDialog({ stage: 'intro' | 'outcome', event, currentPoint, outcome, onConfirm, onAdjustAmount })`。

- [ ] **Step 1: 实现单一可清理的播放计时器**

```jsx
useEffect(() => {
  if (!['playing', 'eventImpact'].includes(state.phase)) return undefined
  const timerId = window.setTimeout(() => advanceOneMonth(), prefersReducedMotion ? 0 : frameDelay)
  return () => window.clearTimeout(timerId)
}, [state.phase, state.cursor, frameDelay, prefersReducedMotion, advanceOneMonth])

useEffect(() => {
  const onVisibilityChange = () => {
    if (document.hidden) dispatch({ type: 'PAUSE' })
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => document.removeEventListener('visibilitychange', onVisibilityChange)
}, [dispatch])
```

最长区间的 `frameDelay` 根据曲线长度换算，使普通播放总时长约 25 秒；事件影响阶段使用略慢但有上限的间隔。不能同时使用 interval 与 timeout。

- [ ] **Step 2: 将图表收敛为两条渐进线**

保留现有 SVG 坐标与响应式 `viewBox`，删除事件圆点、回撤底纹、对照资产、hover 多指标和相关 legend。用可见曲线计算路径：

```jsx
const visibleCurve = useMemo(() => curve.slice(0, cursor + 1), [curve, cursor])
const investedPath = createPath(visibleCurve, (point) => point.invested)
const valuePath = createPath(visibleCurve, (point) => point.value)
```

图例明确使用文字和不同线型：“累计投入”为虚线，“账户资产”为实线。Y 轴尺度基于完整曲线固定计算，避免播放时画面上下跳动，但不绘制未来路径。

- [ ] **Step 3: 触发事件第一幕和影响窗口**

`advanceOneMonth` 在普通播放中先检查下一月份是否为尚未处理事件的 `startYm`；若是，dispatch `TICK` 并携带 `eventId`。第一幕确认时查找 `impactEndYm` 对应索引并 dispatch `ACK_EVENT_INTRO`。

```jsx
const eventByStartYm = new Map(events.map((event) => [event.startYm, event]))
const nextPoint = curve[state.cursor + 1]
const nextEvent = eventByStartYm.get(nextPoint?.ym)
dispatch({ type: 'TICK', nextIndex: state.cursor + 1, eventId: nextEvent?.id ?? null })
```

- [ ] **Step 4: 在事件结束月展示第二幕**

影响播放到 `impactEndIndex` 后 dispatch `REACH_EVENT_END`，用 `calculateEventOutcome` 派生文案。低于本金时显示浮亏；仍高于本金时显示阶段回撤并明确仍盈利。

```jsx
const isPrincipalLoss = outcome.profit < 0
const accountCopy = isPrincipalLoss
  ? `最低时浮亏 ${formatMoney(Math.abs(outcome.profit))}（${formatPercent(outcome.profitRate)}）`
  : `从阶段高点回撤 ${formatPercent(outcome.peakDrawdown)}，仍高于累计投入 ${formatMoney(outcome.profit)}`
```

- [ ] **Step 5: 实现播放控制语义**

- 暂停只在 `playing` 生效；恢复只从 `paused` 回到 `playing`。
- “跳到下个事件”寻找下一个事件开始索引，并推进到其前一月，让正常 `TICK` 触发第一幕；没有事件时 dispatch `COMPLETE`。
- 事件弹层存在时隐藏跳过控制，不能绕过第一幕或第二幕。
- “重新开始”先停止计时器，再 dispatch `RESTART`。

- [ ] **Step 6: 验证事件流程和计时器清理**

Run: `npm run test:dca && npm run lint -- --quiet`  
Expected: PASS。

Manual: 从 2001 年开始，确认第一幕不显示未来结果；确认后折线走到 `impactEndYm` 才显示第二幕；切换浏览器标签页后月份不再推进。

---

### Task 6: 实现金额调整与终点总结

**Files:**
- Create: `src/pages/QdiiMonitor/components/DcaSimulator/AmountAdjustDialog.jsx`
- Create: `src/pages/QdiiMonitor/components/DcaSimulator/JourneySummary.jsx`
- Modify: `src/pages/QdiiMonitor/components/DcaSimulator/JourneyPlayer.jsx`
- Modify: `src/pages/QdiiMonitor/components/DcaSimulator/index.jsx`
- Modify: `src/pages/QdiiMonitor/components/DcaSimulator/DcaSimulator.module.css`

**Interfaces:**
- `AmountAdjustDialog({ currentAmount, effectiveYm, onConfirm, onCancel })`。
- `onConfirm({ effectiveYm, amount })` 覆盖同一生效月的旧记录，不追加重复记录。
- `JourneySummary({ config, curve, eventCount, amountChanges })` 使用 `summarizeJourney(curve)`。

- [ ] **Step 1: 实现非阻断年度提示**

当已播放点进入 `-01` 且不是旅程第一个月时，显示短暂年度提示。提示本身不改变 reducer phase；用户点击“调整”才 dispatch `OPEN_AMOUNT`。

```jsx
const isYearBoundary = currentPoint.ym.endsWith('-01') && state.cursor > 0
const nextYm = curve[state.cursor + 1]?.ym ?? null
```

没有下一月份时不显示调整入口，因为不存在可受影响的后续投入。

- [ ] **Step 2: 实现金额调整面板与校验**

```jsx
const options = [
  { label: `维持 ${formatMoney(currentAmount)}`, amount: currentAmount },
  { label: '提高 10%', amount: Math.round(currentAmount * 1.1) },
]
```

自定义金额必须大于 0。确认后写入 `{ effectiveYm: nextYm, amount }`，重算完整 curve，但保持当前 cursor 和事件 phase；当前月份及以前的 curve 点必须与调整前完全一致。

- [ ] **Step 3: 实现恢复本金的轻提示**

事件第二幕若结束时仍低于累计投入，记录待恢复事件；后续首次出现 `profit >= 0` 时显示一次不阻断播放的提示并标记已处理。不得在第二幕预先展示恢复月份。

- [ ] **Step 4: 实现历史答卷**

```jsx
const summary = summarizeJourney(curve)
const selectedIndexKey = config.assetKey === 'ndx' ? 'nasdaq100' : 'sp500'
const fundHref = `/qdii?index=${selectedIndexKey}`
```

默认只展示累计投入、最终账户、最差浮盈亏、最长低于本金、事件数量、起始和最终月投金额、调整次数。使用确认文案：

> 回望这段旅程，不是为了预测下一次危机，而是理解长期投入真正需要承受什么。

底部固定说明：

> 本体验按指数历史行情与人民币汇率模拟，不包含基金费率、跟踪误差及实际申购成本。

- [ ] **Step 5: 验证调整和总结**

Run: `npm run test:dca`  
Expected: PASS。

Manual: 在年度提示和事件卡分别打开调整面板；确认新金额只从下一月生效；走到终点后核对总结累计投入等于各月 amount 之和。

---

### Task 7: 将总结入口连接到 QDII 指数筛选

**Files:**
- Modify: `src/pages/QdiiMonitor/index.jsx`
- Modify: `scripts/dca-smoke.mjs`

**Interfaces:**
- Consumes: `/qdii?index=nasdaq100`、`/qdii?index=sp500`。
- Produces: 初始 `indexKey` 为合法查询值；其他值回落为 `all`。

- [ ] **Step 1: 使用 React Router 查询参数初始化筛选**

```jsx
import { useSearchParams } from 'react-router-dom'

const VALID_INDEX_KEYS = new Set(['nasdaq100', 'sp500'])

function QdiiMonitorPage() {
  const [searchParams] = useSearchParams()
  const requestedIndex = searchParams.get('index')
  const [indexKey, setIndexKey] = useState(
    VALID_INDEX_KEYS.has(requestedIndex) ? requestedIndex : 'all',
  )
```

不修改 `data.json`、`rules` 或基金字段。用户随后点击现有筛选按钮时沿用当前组件内状态。

- [ ] **Step 2: 添加浏览器断言**

```js
await page.goto('http://localhost:5173/qdii?index=nasdaq100', { waitUntil: 'networkidle' })
await expect(page.getByRole('button', { name: /纳斯达克100/ })).toHaveClass(/active/)
await page.goto('http://localhost:5173/qdii?index=invalid', { waitUntil: 'networkidle' })
await expect(page.getByRole('button', { name: /全部/ })).toHaveClass(/active/)
```

若项目当前未使用 Playwright test runner，则继续使用脚本式 `assert.match(await locator.getAttribute('class'), /active/)`，不新增 `@playwright/test`。

- [ ] **Step 3: 验证查询参数兼容性**

Manual: 直接访问 `/qdii` 仍显示“全部”；两个合法参数只改变指数筛选；刷新页面保持查询参数对应筛选。

---

### Task 8: 完成响应式、可访问性和端到端验证

**Files:**
- Modify: `src/pages/QdiiMonitor/components/DcaSimulator/DcaSimulator.module.css`
- Create: `scripts/dca-smoke.mjs`
- Delete: `scripts/dca-smoke.tmp.mjs`

**Interfaces:**
- Consumes: Tasks 1—7 完整页面。
- Produces: 可重复运行的桌面端与移动端冒烟验证脚本。

- [ ] **Step 1: 完成焦点、减少动态效果和移动端布局**

- 事件与金额弹层使用 `role="dialog"`、`aria-modal="true"` 和可读标题。
- 打开弹层时聚焦主标题或首个操作；关闭后恢复到触发按钮。
- 所有按钮提供 `:focus-visible`。
- `@media (prefers-reduced-motion: reduce)` 禁用装饰动画和过渡。
- 768px 以下将统计卡改为两列，事件指标改为单列，播放按钮允许换行。
- 360px 宽度下金额与日期不得溢出。

- [ ] **Step 2: 编写完整冒烟脚本**

```js
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))

await page.goto('http://localhost:5173/qdii/dca', { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: '以史为鉴，可以知兴替' }).waitFor()
await page.getByLabel('开始年份').selectOption('2001')
await page.getByRole('button', { name: '纳斯达克 100' }).click()
await page.getByLabel('起始月投金额').fill('1000')
await page.getByRole('button', { name: '开始穿越' }).click()
await page.getByRole('button', { name: /看看接下来会怎样/ }).waitFor({ timeout: 30000 })
assert.equal(await page.locator('svg[aria-label="历史定投旅程折线图"]').count(), 1)
assert.deepEqual(errors, [])

await browser.close()
```

扩展脚本覆盖：两幕式事件、金额调整、跳到下个事件、走到总结、纳指与标普 CTA、非法 query 回落和 390px 移动端无横向溢出。

- [ ] **Step 3: 运行自动验证**

Run: `npm run test:dca`  
Expected: PASS。

Run: `npm run lint`  
Expected: exit 0。

Run: `npm run build`  
Expected: exit 0。

在本地开发服务器运行时执行：`node scripts/dca-smoke.mjs`  
Expected: exit 0，终端输出核心流程检查结果且无 console/page error。

- [ ] **Step 4: 运行格式与改动范围检查**

Run: `git diff --check`  
Expected: 无输出，exit 0。

Run: `git status --short`  
Expected: 只包含本功能文件和用户原有未提交改动；不得误删或覆盖 `.mimosa/`、`.workbuddy/`、`qdii-notify/` 等无关内容。

- [ ] **Step 5: 手动验收并记录未验证风险**

- 桌面端完整走一遍 2001 年纳指旅程，确认事件不超过 5 个。
- 从 2025 年开始走短旅程，确认没有事件时直接完成。
- 在事件第一幕、事件影响播放、第二幕和金额调整期间分别测试刷新或重新开始。
- 用键盘完成开始、暂停、确认事件和金额调整。
- 核对总结 CTA 到 `/qdii` 后正确选择对应指数。
- 把事件事实来源核对情况、未在真实基金净值上验证的差异和浏览器兼容性风险写入实施交付说明。

---

## Final Verification Matrix

| Requirement | Automated | Manual |
| --- | --- | --- |
| 年份动态上限 | `dca-engine.test.mjs` | 开始页选择器 |
| 人民币收益与无费用扣除 | `dca-engine.test.mjs` | 方法说明文案 |
| 金额只影响后续月份 | engine test | 年度与事件入口各一次 |
| 最多 5 个非重叠事件 | engine test | 2001 完整旅程 |
| 两幕式不剧透 | state test | 事件完整流程 |
| 单计时器与后台暂停 | state test | 切换标签页 |
| 两条渐进折线 | smoke | 桌面与移动端 |
| 最终总结 | engine + smoke | 数字人工核对 |
| QDII 筛选入口 | smoke | 两个指数各一次 |
| 错误与空事件降级 | fixture/smoke | 断开对应 JSON |
