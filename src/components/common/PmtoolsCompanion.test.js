import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const vite = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

after(() => vite.close())

const companionCss = await readFile(
  new URL('./PmtoolsCompanion.module.css', import.meta.url),
  'utf8'
)
const winkModule = await vite.ssrLoadModule('/src/components/common/bloubWinkMotion.js')

function verticalScale(matrix) {
  const values = matrix.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  return Math.hypot(values[1] ?? 0, values[3] ?? 0)
}

test('展开前后保持同一个按钮尺寸', () => {
  const guideRules = [
    ...companionCss.matchAll(/\.root\[data-state='guide'\] \.botButton\s*\{([^}]*)\}/g),
  ]
  for (const [, declarations] of guideRules) {
    assert.doesNotMatch(declarations, /\b(?:width|height)\s*:/)
  }
})

test('wink 完成进入后仍按 bloub 日程继续眨眼', () => {
  assert.equal(typeof winkModule.sampleWink, 'function')
  const openFrame = winkModule.sampleWink(1.32)
  const blinkFrame = winkModule.sampleWink(1.49)
  assert.ok(verticalScale(openFrame.eyes[0].transform) > 0.8)
  assert.ok(verticalScale(blinkFrame.eyes[0].transform) < 0.35)
})
