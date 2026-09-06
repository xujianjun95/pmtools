// 先 npm run build；拦截全部网络，生产构建在测试域名运行，不向线上上报。
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const dist = new URL('../dist/', import.meta.url)
const data = JSON.parse(await readFile(new URL('qdii/simulation-data.json', dist), 'utf8'))
data.monthly = data.monthly.filter(row => row.ym.startsWith('2001-'))
const eventData = JSON.parse(await readFile(new URL('qdii/simulation-events.json', dist), 'utf8'))
const fixtureEvent = { ...eventData.events[0], startYm: '2001-11', impactEndYm: '2001-12' }
const browser = await chromium.launch()
try {
  for (const withEvent of [false, true]) {
    const context = await browser.newContext()
    const events = []
    const errors = []
    await context.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.hostname !== 'pmtools.test') return route.fulfill({ status: 204 })
      if (url.pathname === '/api/track') {
        events.push(...route.request().postDataJSON().events)
        return route.fulfill({ status: 204 })
      }
      if (url.pathname.endsWith('simulation-data.json')) return route.fulfill({ json: data })
      if (url.pathname.endsWith('simulation-events.json')) return route.fulfill({ json: { events: withEvent ? [fixtureEvent] : [] } })
      const relative = url.pathname.startsWith('/assets/') ? url.pathname.slice(1) : 'index.html'
      const contentType = relative.endsWith('.js') ? 'application/javascript' : relative.endsWith('.css') ? 'text/css' : 'text/html'
      return route.fulfill({ body: await readFile(new URL(relative, dist)), contentType })
    })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    for (let run = 1; run <= 2; run++) {
      await page.goto('https://pmtools.test/qdii/dca')
      await page.getByRole('button', { name: '开始穿越', exact: true }).click()
      if (withEvent) {
        await page.getByRole('button', { name: '看看接下来会怎样', exact: true }).click()
        await page.getByRole('button', { name: '继续穿越', exact: true }).click()
      }
      await page.locator('section[aria-labelledby="journey-summary-title"]').waitFor()
      // 真实组件完成状态更新后，一秒合并窗口内送达拦截器。
      const deadline = Date.now() + 5000
      while (events.filter(e => e.event === 'dca_complete').length < run && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      assert.equal(events.filter(e => e.event === 'dca_start').length, run)
      assert.equal(events.filter(e => e.event === 'dca_complete').length, run)
    }
    assert.equal(new Set(events.filter(e => e.event === 'dca_start').map(e => e.visitor_id)).size, 1)
    assert.equal(new Set(events.filter(e => e.event === 'dca_start').map(e => e.visit_id)).size, 2)
    assert.deepEqual(errors, [])
    console.log(`PASS ${withEvent ? '终点事件确认' : '普通播放'}：两次旅程均上报开始/完成，访客稳定，访问独立，无页面异常`)
    await context.close()
  }
} finally {
  await browser.close()
}
