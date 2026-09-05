import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const errors = []

function trackPage(page, bucket = errors) {
  page.on('pageerror', (error) => bucket.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const url = message.location()?.url ?? ''
      bucket.push(`console: ${message.text()} (${url})`)
    }
  })
}

const browser = await chromium.launch()

try {
  // ---- 1. 桌面端完整旅程：2001 年纳指，5 个事件两幕式走完并生成总结 ----
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  trackPage(page)

  await page.goto(`${BASE}/qdii/dca`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: '以史为鉴，可以知兴替' }).waitFor({ timeout: 20000 })
  await page.getByLabel('开始年份').selectOption('2001')
  await page.getByRole('button', { name: '纳斯达克 100' }).click()
  await page.getByLabel('起始月投金额').fill('1000')
  await page.getByRole('button', { name: '开始穿越' }).click()

  await page.getByRole('button', { name: '看看接下来会怎样' }).waitFor({ timeout: 30000 })
  assert.equal(await page.locator('svg[aria-label="历史定投旅程折线图"]').count(), 1)

  // 第一幕不得提前展示未来账户结果：此时只显示“已坚持/累计投入/账户资产”
  const introText = await page.locator('[role="dialog"]').innerText()
  assert.ok(!introText.includes('最差出现在'), '第一幕不应出现第二幕指标')

  // 进入第一段事件影响窗口后立即暂停，再恢复到 eventImpact 继续播放。
  await page.getByRole('button', { name: '看看接下来会怎样' }).click({ timeout: 2000 })
  const pauseImpactBtn = page.getByRole('button', { name: '暂停', exact: true })
  await pauseImpactBtn.click({ timeout: 1200 })
  const resumeImpactBtn = page.getByRole('button', { name: '继续', exact: true })
  await resumeImpactBtn.waitFor({ timeout: 2000 })
  await resumeImpactBtn.click({ timeout: 1200 })

  // 依次走完所有事件：第一幕 → 第二幕 → 跳到下一个事件，直到总结出现。
  // 弹层可能在任意 tick 出现并移除跳过按钮，因此每次点击都用短超时容忍竞态。
  const summaryLink = page.getByRole('link', { name: /查看当前可申购的/ })
  let guard = 0
  while (!(await summaryLink.count()) && guard < 120) {
    guard += 1
    const introBtn = page.getByRole('button', { name: '看看接下来会怎样' })
    if (await introBtn.count()) {
      await introBtn.click({ timeout: 2000 })
      continue
    }
    const outcomeBtn = page.getByRole('button', { name: '继续穿越' })
    if (await outcomeBtn.count()) {
      await outcomeBtn.click({ timeout: 2000 })
      continue
    }
    try {
      await page.getByRole('button', { name: '跳到下一个事件' }).click({ timeout: 400 })
    } catch {
      // 弹层随时可能出现并移除该按钮，交给下一轮循环处理
    }
    await page.waitForTimeout(120)
  }
  assert.ok(await summaryLink.count(), '旅程应到达总结')
  assert.match(
    await summaryLink.getAttribute('href'),
    /\/qdii\?index=nasdaq100$/,
    '纳指总结入口应指向 nasdaq100',
  )
  const summaryText = await page.locator('section[aria-labelledby="journey-summary-title"]').innerText()
  assert.ok(summaryText.includes('累计投入'), '总结应包含累计投入')
  assert.ok(summaryText.includes('最长连续低于本金'), '总结应包含最长低于本金')

  // CTA 跳转 /qdii 并选中纳指筛选
  await summaryLink.click()
  await page.waitForURL(/\/qdii\?index=nasdaq100$/)
  await page.getByRole('button', { name: /纳斯达克100/ }).first().waitFor({ timeout: 15000 })
  assert.match(
    await page.getByRole('button', { name: /纳斯达克100/ }).first().getAttribute('class'),
    /active/,
    '应通过查询参数初始化纳指筛选',
  )

  // ---- 2. 非法 index 查询参数回落为全部 ----
  await page.goto(`${BASE}/qdii?index=invalid`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^全部/ }).first().waitFor({ timeout: 15000 })
  assert.match(
    await page.getByRole('button', { name: /^全部/ }).first().getAttribute('class'),
    /active/,
    '非法 index 应回落为全部',
  )
  await page.close()

  // ---- 3. 短旅程（2025 标普）：年度提示里调整金额，无事件直接完成 ----
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  trackPage(page2)
  await page2.goto(`${BASE}/qdii/dca`, { waitUntil: 'networkidle' })
  await page2.getByLabel('开始年份').selectOption('2025')
  await page2.getByRole('button', { name: '标普 500' }).click()
  await page2.getByLabel('起始月投金额').fill('1000')
  await page2.getByRole('button', { name: '开始穿越' }).click()

  const adjustInToast = page2.getByRole('button', { name: '调整', exact: true })
  await adjustInToast.waitFor({ timeout: 30000 })
  await adjustInToast.click()
  await page2.getByRole('dialog').getByLabel('输入自定义金额（元/月）').fill('2000')
  await page2.getByRole('button', { name: '确认调整' }).click()

  await page2.getByRole('link', { name: /查看当前可申购的 标普500 QDII/ }).waitFor({ timeout: 60000 })
  assert.match(
    await page2.getByRole('link', { name: /查看当前可申购的 标普500 QDII/ }).getAttribute('href'),
    /\/qdii\?index=sp500$/,
  )
  const shortSummary = await page2.locator('section[aria-labelledby="journey-summary-title"]').innerText()
  assert.ok(shortSummary.includes('1,000 元 → 2,000 元'), '总结应展示起始与最终月投金额')
  assert.ok(shortSummary.includes('中途调整 1 次'), '总结应统计调整次数')
  await page2.close()

  // ---- 4. 事件文件失败：允许开始普通旅程并直接完成 ----
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page3 = await ctx3.newPage()
  const injectedErrors = []
  trackPage(page3, injectedErrors)
  await page3.route('**/qdii/simulation-events.json', (route) =>
    route.fulfill({ status: 500, body: 'events unavailable' }))
  await page3.goto(`${BASE}/qdii/dca`, { waitUntil: 'networkidle' })
  await page3.getByText('历史事件暂不可用').waitFor({ timeout: 15000 })
  await page3.getByLabel('开始年份').selectOption('2025')
  await page3.getByRole('button', { name: '开始穿越' }).click()
  await page3.getByRole('link', { name: /查看当前可申购的/ }).waitFor({ timeout: 60000 })
  await ctx3.close()

  // ---- 5. 行情文件失败：停留错误页并可重试 ----
  const ctx4 = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page4 = await ctx4.newPage()
  const dataFailErrors = []
  trackPage(page4, dataFailErrors)
  await page4.route('**/qdii/simulation-data.json', (route) =>
    route.fulfill({ status: 500, body: 'data unavailable' }))
  await page4.goto(`${BASE}/qdii/dca`, { waitUntil: 'networkidle' })
  await page4.getByRole('button', { name: '重试加载' }).waitFor({ timeout: 15000 })
  await ctx4.close()

  // ---- 6. 2022 纳指：第二幕浮亏文案 + 恢复本金提示不得提前显示 ----
  const page6 = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  trackPage(page6)
  await page6.goto(`${BASE}/qdii/dca`, { waitUntil: 'networkidle' })
  await page6.getByLabel('开始年份').selectOption('2022')
  await page6.getByRole('button', { name: '开始穿越' }).click()
  const intro6 = page6.getByRole('button', { name: '看看接下来会怎样' })
  await intro6.waitFor({ timeout: 30000 })
  const outcomeText6 = await page6.locator('[role="dialog"]').innerText()
  assert.ok(!outcomeText6.includes('指数人民币口径回撤'), '第一幕不得展示回撤结果')
  await intro6.click({ timeout: 5000 })
  const outcomeBtn6 = page6.getByRole('button', { name: '继续穿越' })
  await outcomeBtn6.waitFor({ timeout: 20000 })
  const dialog6 = await page6.locator('[role="dialog"]').innerText()
  assert.ok(dialog6.includes('浮亏'), '2022 事件第二幕应为浮亏文案')
  assert.ok(dialog6.includes('指数人民币口径回撤'), '第二幕应展示指数人民币口径回撤')
  assert.ok(/指数人民币口径回撤\s*-\d/.test(dialog6.replace(/\n/g, ' ')), '2022 加息窗口回撤必须为负')
  await outcomeBtn6.click({ timeout: 5000 })
  const restoreToast6 = page6.getByText('2022 年 11 月，账户资产重新回到累计投入之上。')
  // 恢复月由同一引擎离线计算：2022-10 第二幕结束时仍亏 -520（月份索引 9），2022-11 才首次
  // 回到本金之上（+61，索引 10）。不变量：月份索引 < 10 期间提示绝不可见。
  const toMonthIndex = (text) => {
    const match = text.match(/(\d+) 年 (\d+) 月/)
    return match ? (Number(match[1]) - 2022) * 12 + (Number(match[2]) - 1) : -1
  }
  const monthCell6 = page6.locator('[class*=statBar] > div').filter({ hasText: '当前年月' }).locator('[class*=statValue]')
  const pollDeadline = Date.now() + 60000
  while (Date.now() < pollDeadline) {
    const monthIndex = toMonthIndex(await monthCell6.innerText())
    if (monthIndex >= 10) break
    assert.equal(await restoreToast6.count(), 0, '恢复前（仍低于本金）不得显示恢复提示')
    await page6.waitForTimeout(120)
  }
  await restoreToast6.waitFor({ timeout: 10000 })
  await page6.close()

  // ---- 7. 390px 移动端：设置页无横向溢出 ----
  const ctx5 = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page5 = await ctx5.newPage()
  trackPage(page5)
  await page5.goto(`${BASE}/qdii/dca`, { waitUntil: 'networkidle' })
  await page5.getByRole('heading', { name: '以史为鉴，可以知兴替' }).waitFor({ timeout: 15000 })
  const scrollWidth = await page5.evaluate(() => document.documentElement.scrollWidth)
  assert.ok(scrollWidth <= 392, `390px 视口不应出现横向溢出（scrollWidth=${scrollWidth}）`)
  await ctx5.close()

  // 离线/受限网络环境可能无法加载 Google Fonts；它不影响页面功能。
  // 仅忽略这一条明确的外部字体错误，应用脚本、数据请求和其他资源错误仍会令测试失败。
  const appErrors = errors.filter((message) => !message.includes('https://fonts.googleapis.com/'))
  assert.deepEqual(appErrors, [], `不应出现应用 console/page error：\n${appErrors.join('\n')}`)
  console.log('dca smoke: all checks passed')
} finally {
  await browser.close()
}
