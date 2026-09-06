import test from 'node:test'
import assert from 'node:assert/strict'
import { diffStates, extractState } from './detect.js'
import { buildMailBody } from './mailer.js'

const fund = { code: '018966', name: '测试纳斯达克人民币A', status: '限大额', redeem: '开放赎回', limit_amount: 2000 }
const state = (patch = {}) => extractState([{ ...fund, ...patch }])

test('暂停及恢复申赎不触发通知', () => {
  const paused = state({ status: '暂停申购', redeem: '暂停赎回' })
  assert.deepEqual(diffStates(state(), paused), [])
  assert.deepEqual(diffStates(paused, state()), [])
})
test('状态同时变化时仅通知限额并正确渲染邮件', () => {
  const changes = diffStates(state(), state({ status: '暂停申购', redeem: '暂停赎回', limit_amount: 10 }))
  assert.equal(changes.length, 1)
  assert.equal(changes[0].field, '日累计限额（代销）')
  assert.equal(changes[0].from, '2,000 元/日')
  assert.equal(changes[0].to, '10 元/日')
  const mail = buildMailBody(changes, { updatedAt: '2026-09-06', rawCount: 1 })
  assert.match(mail.subject, /额度变化1条/)
  assert.match(mail.html, /日累计限额（代销）/)
})
test('新增、移出不通知', () => {
  assert.deepEqual(diffStates({}, state()), [])
  assert.deepEqual(diffStates(state(), {}), [])
})
test('零额度与正额度互变均通知，零额度状态变化不通知', () => {
  assert.equal(diffStates(state(), state({ limit_amount: 0 })).length, 1)
  assert.equal(diffStates(state({ limit_amount: 0 }), state()).length, 1)
  assert.deepEqual(diffStates(state({ limit_amount: 0 }), state({ limit_amount: 0, status: '暂停申购' })), [])
})
test('相同数值、缺失或非法额度不误报', () => {
  assert.deepEqual(diffStates(state(), state({ limit_amount: '2000' })), [])
  for (const value of [null, undefined, '', ' ', 'bad', NaN, Infinity, -1, false]) {
    assert.deepEqual(diffStates(state(), state({ limit_amount: value })), [])
    assert.deepEqual(diffStates(state({ limit_amount: value }), state()), [])
  }
})
test('美元份额不通知，已消费额度不会重复通知', () => {
  assert.deepEqual(extractState([{ ...fund, name: '纳斯达克美元A' }]), {})
  const next = state({ limit_amount: 10 })
  assert.deepEqual(diffStates(next, next), [])
})
