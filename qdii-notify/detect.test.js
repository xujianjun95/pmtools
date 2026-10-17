import test from 'node:test'
import assert from 'node:assert/strict'
import { diffStates, extractState } from './detect.js'
import { buildMailBody } from './mailer.js'

const fund = { code: '018966', name: '测试纳斯达克人民币A', status: '限大额', redeem: '开放赎回', limit_amount: 2000 }
const state = (patch = {}) => extractState([{ ...fund, ...patch }])

test('世界基金无限额哨兵值在邮件中显示无限额', () => {
  const changes = diffStates(state(), state({ limit_amount: 1e11 }))
  assert.equal(changes[0].to, '无限额')
})

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
  assert.match(mail.subject, /额度收紧/)
  assert.match(mail.html, /日累计限额（代销）/)
})
test('主题体现变动方向，预览文本携带关键变动', () => {
  // 收紧：2000 → 10
  const tighten = buildMailBody(diffStates(state(), state({ limit_amount: 10 })), { updatedAt: '2026-09-06' })
  assert.match(tighten.subject, /额度收紧/)
  assert.match(tighten.html, /mso-hide:all/)
  assert.match(tighten.html, /2,000→10元\/日/)

  // 放宽：10 → 2000
  const loosen = buildMailBody(diffStates(state({ limit_amount: 10 }), state()), { updatedAt: '2026-09-06' })
  assert.match(loosen.subject, /额度放宽/)
})
test('额度单位混用、无限额互转都能判出方向', () => {
  // 从渲染结果里读箭头，避免测试直接依赖内部函数签名
  const direction = (from, to) => {
    const { html } = buildMailBody(
      [{ code: '000000', name: '测试基金', field: '日累计限额（代销）', from, to }],
      { updatedAt: '2026-09-06' }
    )
    const m = /font-size:10px[^>]*>(&#8595;|&#8593;)/.exec(html)
    if (!m) return null
    return m[1] === '&#8595;' ? 'down' : 'up'
  }
  // 亿与万混用：1 亿 > 5,000 万
  assert.equal(direction('5,000 万元/日', '1 亿元/日'), 'up')
  assert.equal(direction('1 亿元/日', '5,000 万元/日'), 'down')
  // 无限额是上限，不是"无法比较"
  assert.equal(direction('2,000 元/日', '无限额'), 'up')
  assert.equal(direction('无限额', '2,000 元/日'), 'down')
  // 纯状态词退回等级比较
  assert.equal(direction('暂停申购', '开放申购'), 'up')
  assert.equal(direction('开放申购', '暂停申购'), 'down')
  assert.equal(direction('限大额', '开放申购'), 'up')
})
test('主题里的基金只数按代码去重，不按变动条数', () => {
  const sameFundTwoRows = [
    { code: '018966', name: '测试纳斯达克人民币A', field: '日累计限额（代销）', from: '100 元/日', to: '10 元/日' },
    { code: '018966', name: '测试纳斯达克人民币A', field: '日累计限额（直销）', from: '100 元/日', to: '10 元/日' },
  ]
  assert.match(buildMailBody(sameFundTwoRows, { updatedAt: '2026-09-06' }).subject, /测试纳斯达克 额度收紧/)

  const twoFunds = [
    sameFundTwoRows[0],
    { code: '006479', name: '广发纳斯达克100ETF联接人民币C', field: '日累计限额（代销）', from: '100 元/日', to: '10 元/日' },
  ]
  assert.match(buildMailBody(twoFunds, { updatedAt: '2026-09-06' }).subject, /等 2 只基金额度收紧/)
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
test('直销限额变动单独通知，缺失值不触发', () => {
  // 旧值 → 新值：正常通知
  const changes = diffStates(state({ direct_limit_amount: 100 }), state({ direct_limit_amount: 50 }))
  assert.equal(changes.length, 1)
  assert.equal(changes[0].field, '日累计限额（直销）')
  assert.equal(changes[0].from, '100 元/日')
  assert.equal(changes[0].to, '50 元/日')
  // 旧值缺失（数据源未覆盖/抓取失败置空）→ 不误报
  assert.deepEqual(diffStates(state(), state({ direct_limit_amount: 100 })), [])
})
test('代销与直销同时变动产生两条记录', () => {
  const changes = diffStates(
    state({ direct_limit_amount: 20 }),
    state({ limit_amount: 10, direct_limit_amount: 5 })
  )
  assert.equal(changes.length, 2)
  assert.deepEqual(
    changes.map((c) => c.field).sort(),
    ['日累计限额（代销）', '日累计限额（直销）']
  )
})
test('老快照缺直销字段时不误报（平滑迁移）', () => {
  const legacy = { '018966': { name: fund.name, status: '限大额', limit_amount: 2000, redeem: '开放赎回' } }
  assert.deepEqual(diffStates(legacy, state({ direct_limit_amount: 100, limit_amount: 2000 })), [])
  assert.deepEqual(diffStates(state(), legacy), [])
})
