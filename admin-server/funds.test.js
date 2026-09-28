import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createFundStore } from './funds.js'

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'fund-store-'))
  const dbPath = path.join(directory, 'fund.db')
  const store = createFundStore({ dbPath })
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }) })
  return { store, dbPath }
}
const input = { code: '999999', name: '测试基金', market: 'other', region: '日本', kind: '主动' }

test('创建支持最小表单；重复、负额度和缺名称拒绝', (t) => {
  const { store } = fixture(t)
  assert.equal(store.create({ ...input, name: '' }).code, 400)
  assert.equal(store.create({ ...input, limit_amount: -1 }).code, 400)
  assert.equal(store.create(input).ok, true)
  assert.equal(store.create(input).code, 409)
})

test('只改额度：锁定零和空值，恢复最近自动值；其他字段禁止手动覆盖', (t) => {
  const { store } = fixture(t)
  store.create({ ...input, limit_amount: 100, direct_limit_amount: 200 })
  assert.equal(store.update(input.code, { track_target: '禁止修改扫描字段' }).code, 400)
  const updated = store.update(input.code, { limit_amount: 0, direct_limit_amount: null }).fund
  assert.equal(updated.limit_amount, 0)
  assert.equal(updated.direct_limit_amount, null)
  assert.deepEqual(updated.locked_fields, ['direct_limit_amount', 'limit_amount'])
  const restored = store.unlock(input.code, ['direct_limit_amount']).fund
  assert.equal(restored.direct_limit_amount, 200)
  assert.equal(restored.limit_amount, 0)
  assert.deepEqual(restored.locked_fields, ['limit_amount'])
})

test('公开名册立即反映额度、删除和空值；不输出自动值或内部锁定', (t) => {
  const { store } = fixture(t)
  store.create(input)
  store.update(input.code, { limit_amount: 123 })
  const fund = store.public().funds.find((f) => f.code === input.code)
  assert.equal(fund.limit_amount, 123)
  assert.equal(fund.direct_limit_amount, null)
  assert.equal('auto_values' in fund, false)
  assert.equal('locked_fields' in fund, false)
  store.delete(input.code)
  assert.equal(store.public().funds.some((f) => f.code === input.code), false)
  assert.equal(store.create(input).code, 409)
})

test('基本信息与额度一起保存，名称不锁定，市场切换更新出口', (t) => {
  const { store } = fixture(t)
  store.create({ ...input, limit_amount: 100 })
  const result = store.update(input.code, {
    name: '新名称', market: 'us', region: '美国', kind: '被动指数', tags: ['科技'],
    locked_fields: ['limit_amount'], limit_amount: 200,
  })
  assert.equal(result.ok, true)
  assert.equal(result.fund.name, '新名称')
  assert.equal(result.fund.region, '美国')
  assert.equal(result.fund.kind, '被动指数')
  assert.deepEqual(result.fund.tags, ['科技'])
  assert.equal(result.fund.source_group, 'us')
  assert.equal(result.fund.index_key, 'manual')
  assert.deepEqual(result.fund.locked_fields, ['limit_amount'])
  assert.equal(store.update(input.code, { name: '' }).code, 400)
  assert.equal(store.update(input.code, { region: '' }).code, 400)
  assert.equal(store.update(input.code, { market: 'invalid' }).code, 400)
  assert.equal(store.update(input.code, { tags: [null] }).code, 400)
  assert.equal(store.update(input.code, { code: '111111' }).code, 400)
  assert.equal(store.public().funds.find((fund) => fund.code === input.code).name, '新名称')
  const automatic = store.update(input.code, { name: '扫描命名', market: 'other', region: '日本', locked_fields: [] })
  assert.equal(automatic.ok, true)
  assert.equal(automatic.fund.source_group, 'manual')
  assert.equal(automatic.fund.index_key, 'worldpage')
  assert.deepEqual(automatic.fund.locked_fields, [])
  assert.equal(automatic.fund.limit_amount, 100)
})

test('无扫描快照的基金用资料记录日期；已有快照保留扫描日期', (t) => {
  const { store, dbPath } = fixture(t)
  store.create({ ...input, status: '开放申购', limit_amount: 100 })
  const db = new Database(dbPath)
  t.after(() => db.close())
  db.prepare('UPDATE fund_registry SET updated_at=? WHERE code=?').run('2026-09-28T02:26:00.000Z', input.code)
  const history = store.public().funds.find((fund) => fund.code === input.code).history
  assert.equal(history[0].date, '2026-09-28')
  assert.equal(history[0].source, 'registry')
  db.exec('CREATE TABLE snapshots (code TEXT, date TEXT, status TEXT, redeem TEXT, limit_amount REAL, direct_limit_amount REAL)')
  db.prepare('INSERT INTO snapshots VALUES(?,?,?,?,?,?)').run(input.code, '2026-09-26', '开放申购', null, 100, null)
  const scanned = store.public().funds.find((fund) => fund.code === input.code).history
  assert.equal(scanned[0].date, '2026-09-26')
  assert.equal(scanned[0].source, undefined)
})

test('旧扫描表100元保持100元；seed静态万元仍正常转换', (t) => {
  const { store, dbPath } = fixture(t)
  const db = new Database(dbPath)
  db.exec('CREATE TABLE funds(code TEXT PRIMARY KEY,name TEXT,index_key TEXT,limit_amount REAL)')
  db.prepare('INSERT INTO funds VALUES(?,?,?,?)').run('040046', '历史基金', 'nasdaq100', 100)
  db.prepare('INSERT INTO funds VALUES(?,?,?,?)').run('999998', '旧清单外基金', 'nasdaq100', 100)
  db.close()
  const funds = store.list()
  assert.equal(funds.find((f) => f.code === '040046').limit_amount, 100)
  assert.equal(funds.find((f) => f.code === '040046').index_key, 'nasdaq100')
  assert.equal(funds.find((f) => f.code === '999998').limit_amount, 100)
  assert.equal(funds.find((f) => f.code === '000834').limit_amount, 100000)
})

test('已迁移库修复可证明的万倍额度；保留人工额度和状态锁定', (t) => {
  const { store, dbPath } = fixture(t)
  store.create({ ...input, status: '开放申购', limit_amount: 100, direct_limit_amount: 200 })
  store.close()
  const db = new Database(dbPath)
  db.exec('CREATE TABLE funds(code TEXT PRIMARY KEY,name TEXT,index_key TEXT,limit_amount REAL,direct_limit_amount REAL)')
  db.prepare('INSERT INTO funds VALUES(?,?,?,?,?)').run(input.code, input.name, 'worldpage', 100, 200)
  db.prepare('UPDATE fund_registry SET limit_amount=1000000,direct_limit_amount=999,status=?,locked_fields=? WHERE code=?')
    .run('暂停申购', JSON.stringify(['status', 'direct_limit_amount']), input.code)
  db.exec("DELETE FROM fund_registry_meta WHERE key IN ('funds_units_v2','amount_overrides_v1')")
  db.close()
  const fund = store.list().find((f) => f.code === input.code)
  assert.equal(fund.limit_amount, 100)
  assert.equal(fund.direct_limit_amount, 999)
  assert.equal(fund.status, '暂停申购')
  assert.deepEqual(fund.locked_fields, ['status', 'direct_limit_amount'])
  store.close()
  assert.equal(store.list().find((f) => f.code === input.code).limit_amount, 100)
})

test('新增美国指数基金无需填写指数键即可正确分类，其他市场不误归美国', (t) => {
  const { store } = fixture(t)
  for (const [code, name, market, expected] of [
    ['999991', '测试纳斯达克100ETF联接', 'us', 'nasdaq100'],
    ['999992', '测试标准普尔500指数', 'us', 'sp500'],
    ['999993', '美国精选股票', 'us', 'manual'],
    ['999994', '测试纳斯达克100ETF联接', 'cross', 'worldpage'],
  ]) {
    const result = store.create({ ...input, code, name, market, region: market === 'us' ? '美国' : '全球' })
    assert.equal(result.ok, true)
    assert.equal(result.fund.index_key, expected)
    assert.equal(store.public().funds.find((fund) => fund.code === code).index_key, expected)
  }
  const moved = store.update('999994', { market: 'us', region: '美国' })
  assert.equal(moved.fund.index_key, 'nasdaq100')
})

test('额度与申购状态独立锁定：不改数值也可锁定，切回自动原子恢复', (t) => {
  const { store } = fixture(t)
  store.create({ ...input, status: '开放申购', limit_amount: 100, direct_limit_amount: 200 })
  const manual = store.update(input.code, { locked_fields: ['status', 'direct_limit_amount'], status: '暂停申购' }).fund
  assert.equal(manual.status, '暂停申购')
  assert.equal(manual.direct_limit_amount, 200)
  assert.deepEqual(manual.locked_fields, ['direct_limit_amount', 'status'])
  store.close()
  assert.equal(store.list().find((f) => f.code === input.code).status, '暂停申购')
  const automatic = store.update(input.code, { locked_fields: ['direct_limit_amount'] }).fund
  assert.equal(automatic.status, '开放申购')
  assert.deepEqual(automatic.locked_fields, ['direct_limit_amount'])
  assert.equal(store.update(input.code, { locked_fields: [], limit_amount: 300 }).code, 400)
  assert.equal(store.update(input.code, { locked_fields: ['status'], status: null }).code, 400)
  assert.equal(store.update(input.code, { locked_fields: ['status'], status: '' }).code, 400)
})
