# QDII Fund Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在基金展开区展示四项收益率、成立日和单只基金规模，并由阿里云现有扫描脚本定时更新。

**Architecture:** 复用服务器 `scanner.py` 的逐基金 enrichment 流程，为每只基金请求一次天天基金主页并解析六项详情；最新值写入 `funds` 表并导出到 `data.json`。前端读取新增字段组成详情网格，现有 `snapshots`、`changes` 与邮件检测输入保持不变。

**Tech Stack:** Python 3、requests、SQLite、React 19、CSS Modules、Vite

**Spec:** `docs/superpowers/specs/2026-09-03-qdii-fund-details-design.md`

## Global Constraints

- 新增详情字段只用于展示，不写入 `snapshots` 或 `changes`，不触发邮件。
- 不新增 Python 或前端依赖。
- 单只基金详情抓取失败不能阻断整次扫描，缺失值导出为 `null`。
- 保留当前工作区内排序、邮件单位、订阅验证码、去微信和鼠标效果等未提交改动。
- 不执行 `git commit` 或 `git push`。

---

### Task 1: 天天基金详情解析与服务器扫描脚本

**Files:**
- Modify: `/opt/qdii-watcher/scanner.py`
- Backup: `/opt/qdii-watcher/scanner.py.bak-20260903`
- Test: `/tmp/qdii-watcher-test/test_fund_details.py`

**Interfaces:**
- Consumes: `fetch_fund_details(code: str, session: requests.Session) -> dict`
- Produces: `return_1m`, `return_6m`, `return_1y`, `return_since`, `inception_date`, `fund_size`, `fund_size_date`

- [ ] **Step 1: Copy the server scanner into an isolated test directory**

Run:

```bash
ssh root@182.92.76.163 'rm -rf /tmp/qdii-watcher-test && cp -a /opt/qdii-watcher /tmp/qdii-watcher-test'
scp root@182.92.76.163:/opt/qdii-watcher/scanner.py /private/tmp/qdii-scanner.py
```

- [ ] **Step 2: Add a failing parser test**

Test an inline UTF-8 HTML fragment containing `近1月`、`近6月`、`近1年`、`成立来`、`成 立 日` and `规模`, asserting numeric values, dates and `null` handling.

- [ ] **Step 3: Run the parser test and confirm it fails before implementation**

Run: `python3 /private/tmp/test_qdii_scanner.py`

Expected: import or missing-function failure for `parse_fund_details_html`.

- [ ] **Step 4: Implement detail parsing and enrichment**

Add `FUND_DETAIL_URL`, compiled regular expressions, `parse_fund_details_html(html)`, `fetch_fund_details(code, session)`, and extend the current per-fund enrichment loop. Decode response bytes as `utf-8-sig`; convert percentages and scale to floats; return `None` for `--` or unmatched fields.

- [ ] **Step 5: Extend SQLite latest-value storage without touching change history**

Add seven columns to `funds`, migrate missing columns with `ALTER TABLE`, and include them in the `INSERT ... ON CONFLICT DO UPDATE`. Do not add them to `snapshots`, `changes`, `save_snapshot` comparison fields, or `qdii-notify/detect.js`.

- [ ] **Step 6: Run unit and isolated full-scan verification**

Run:

```bash
python3 /private/tmp/test_qdii_scanner.py
ssh root@182.92.76.163 'cd /tmp/qdii-watcher-test && python3 scanner.py --out /tmp/qdii-details-data.json'
```

Expected: parser tests pass; full scan exits 0; every output fund contains all seven keys; failures are represented by `null` without aborting.

- [ ] **Step 7: Back up and deploy the verified scanner**

Run:

```bash
ssh root@182.92.76.163 'cp /opt/qdii-watcher/scanner.py /opt/qdii-watcher/scanner.py.bak-20260903'
scp /private/tmp/qdii-scanner.py root@182.92.76.163:/opt/qdii-watcher/scanner.py
ssh root@182.92.76.163 'chmod 755 /opt/qdii-watcher/scanner.py && python3 -m py_compile /opt/qdii-watcher/scanner.py'
```

### Task 2: 展开区基金详情网格

**Files:**
- Modify: `src/pages/QdiiMonitor/components/FundTable.jsx`
- Modify: `src/pages/QdiiMonitor/components/FundTable.module.css`

**Interfaces:**
- Consumes: seven JSON fields produced by Task 1
- Produces: `FundDetails({ fund })` shown above `HistoryTimeline`

- [ ] **Step 1: Add formatting helpers and the details component**

Implement percentage formatting with two decimals, `—` fallback, `亿元` scale suffix, and scale cutoff date. Render fields in the order: 近 1 月、近 6 月、近 1 年、成立以来、成立日、基金规模。

- [ ] **Step 2: Place details above the history timeline**

Inside the existing expanded clip render `<FundDetails fund={f} />` followed by `<HistoryTimeline fund={f} />`; do not change the row click or animation state.

- [ ] **Step 3: Add responsive styles**

Use three columns on desktop, two columns on tablet, one column on very narrow screens. Reuse existing color, border, font and spacing variables; separate details from history with one subtle divider.

- [ ] **Step 4: Run focused frontend checks**

Run:

```bash
./node_modules/.bin/eslint src/pages/QdiiMonitor/components/FundTable.jsx
npm run build
git diff --check
```

Expected: all commands exit 0; only the existing Vite chunk-size warning may remain.

### Task 3: Generate data and verify the integrated page

**Files:**
- Modify: `public/qdii/data.json` through the scanner output

**Interfaces:**
- Consumes: deployed server scanner and frontend details component
- Produces: verified local and production-ready generated data

- [ ] **Step 1: Run the deployed scanner against the production output path**

Run:

```bash
ssh root@182.92.76.163 'cd /opt/qdii-watcher && python3 scanner.py --out /var/www/pmtools/main/qdii/data.json'
```

Expected: exit 0 and generated JSON includes all detail keys. This scanner does not send mail; notification logic runs separately and ignores the new fields.

- [ ] **Step 2: Copy generated data locally for UI verification**

Run:

```bash
scp root@182.92.76.163:/var/www/pmtools/main/qdii/data.json public/qdii/data.json
```

- [ ] **Step 3: Verify desktop and narrow-screen expansion**

Open `http://127.0.0.1:5174/qdii`, expand a fund, and assert the six labels appear before `HISTORY · 变化节点`; resize to a narrow viewport and confirm there is no horizontal overflow.

- [ ] **Step 4: Verify notification isolation and final workspace state**

Run:

```bash
rg -n "return_1m|return_6m|return_1y|return_since|inception_date|fund_size" qdii-notify/detect.js
git diff --check
git status --short
```

Expected: no new detail field appears in `detect.js`; diff check exits 0; prior user-owned changes remain present.

