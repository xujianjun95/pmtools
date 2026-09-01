import assert from 'node:assert/strict'
import test from 'node:test'

import { scrollToSection } from './scrollToSection.js'

test('新的导航滚动会取消上一个区块的延迟补滚', async () => {
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  const timers = new Map()
  const sectionTops = { builds: 600, news: 2200 }
  const scrollCalls = []
  let nextTimerId = 1

  const sections = Object.fromEntries(
    Object.keys(sectionTops).map((id) => [
      id,
      {
        getBoundingClientRect: () => ({ top: sectionTops[id] }),
        scrollIntoView: () => {
          scrollCalls.push(id)
          for (const sectionId of Object.keys(sectionTops)) {
            sectionTops[sectionId] = sectionId === id ? 0 : 600
          }
        },
      },
    ])
  )

  globalThis.window = {
    setTimeout(callback, delay) {
      const timerId = nextTimerId++
      timers.set(timerId, { callback, delay })
      return timerId
    },
    clearTimeout(timerId) {
      timers.delete(timerId)
    },
  }
  globalThis.document = {
    documentElement: { style: { scrollBehavior: '' } },
    fonts: { ready: Promise.resolve() },
    getElementById: (id) => sections[id] ?? null,
  }

  const flushTimers = async () => {
    let runs = 0
    while (timers.size > 0) {
      assert.ok(runs++ < 50, '定时任务未能收敛')
      const [timerId, timer] = timers.entries().next().value
      timers.delete(timerId)
      timer.callback()
      await Promise.resolve()
    }
  }

  try {
    scrollToSection('news', 'smooth')
    await Promise.resolve()
    await Promise.resolve()

    // 先让资讯滚动开始，但保留其位置校验与补滚任务。
    const newsStartTimer = [...timers.entries()].find(
      ([, timer]) => timer.delay === 400
    )
    assert.ok(newsStartTimer, '资讯滚动应已排队')
    timers.delete(newsStartTimer[0])
    newsStartTimer[1].callback()

    scrollToSection('builds', 'smooth')
    await Promise.resolve()
    await Promise.resolve()

    // 用户点回造物后，新滚动先到位，旧资讯位置校验才到期。
    const buildsStartTimer = [...timers.entries()].find(
      ([, timer]) => timer.delay === 400
    )
    assert.ok(buildsStartTimer, '造物滚动应已排队')
    timers.delete(buildsStartTimer[0])
    buildsStartTimer[1].callback()

    await flushTimers()

    assert.deepEqual(scrollCalls, ['news', 'builds'])
  } finally {
    globalThis.window = originalWindow
    globalThis.document = originalDocument
  }
})
