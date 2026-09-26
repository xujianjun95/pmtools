/** 基金名册存储、校验与天天基金资料预览。 */
import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SEED_PATH = path.join(HERE, '..', 'qdii-watcher', 'fund_registry_seed.json')
const POOL_PATH = path.join(HERE, '..', 'qdii-watcher', 'active_qdii_pool.json')
const META_PATH = path.join(HERE, '..', 'qdii-watcher', 'active_qdii_metadata.json')
const CODE_RE = /^\d{6}$/
const MARKET_VALUES = new Set(['us', 'other', 'cross'])
// 收益率允许负数（验收场景：编辑收益率为负数需保留）；其余数值字段非负
const SIGNED_NUMERIC = new Set(['return_1m', 'return_6m', 'return_1y', 'return_3y', 'return_since'])
const NUMERIC_FIELDS = new Set(['limit_amount', 'min_buy', 'direct_limit_amount', 'tracking_error', 'fee', 'return_1m', 'return_6m', 'return_1y', 'return_3y', 'return_since', 'fund_size', 'management_fee_rate', 'custody_fee_rate', 'sales_service_fee_rate', 'operation_fee_rate'])
const SCAN_FIELDS = ['name', 'status', 'redeem', 'limit_amount', 'min_buy', 'direct_limit_amount', 'direct_as_of', 'direct_source', 'direct_source_url', 'track_target', 'tracking_error', 'fee', 'return_1m', 'return_6m', 'return_1y', 'return_3y', 'return_since', 'inception_date', 'fund_size', 'fund_size_date', 'management_fee_rate', 'custody_fee_rate', 'sales_service_fee_rate', 'operation_fee_rate']
const LOCKABLE_FIELDS = new Set(SCAN_FIELDS)
const ALL_FIELDS = new Set(['market', 'region', 'kind', 'tags', 'source_group', 'index_key', ...SCAN_FIELDS])
const RULES = { nasdaq100: '纳斯达克100', sp500: '标普500', manual: '手动管理' }
const TIMESTAMP = () => new Date().toISOString()

const SCHEMA = `
CREATE TABLE IF NOT EXISTS fund_registry (
  code TEXT PRIMARY KEY, name TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('us', 'other', 'cross')),
  region TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]',
  source_group TEXT NOT NULL DEFAULT 'manual', index_key TEXT NOT NULL DEFAULT '',
  status TEXT, redeem TEXT, limit_amount REAL, min_buy REAL,
  direct_limit_amount REAL, direct_as_of TEXT, direct_source TEXT, direct_source_url TEXT,
  track_target TEXT, tracking_error REAL, fee REAL,
  return_1m REAL, return_6m REAL, return_1y REAL, return_3y REAL, return_since REAL,
  inception_date TEXT, fund_size REAL, fund_size_date TEXT,
  management_fee_rate REAL, custody_fee_rate REAL, sales_service_fee_rate REAL,
  operation_fee_rate REAL,
  locked_fields TEXT NOT NULL DEFAULT '[]', auto_values TEXT NOT NULL DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS fund_registry_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS fund_registry_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, action TEXT NOT NULL,
  changed_fields TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL
);
`

function readJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return fallback }
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function limitInYuan(value) {
  const amount = asNumber(value)
  return amount === null ? null : amount >= 1e11 ? amount : amount * 10000
}

function inferKind(name) {
  if (/ETF联接|指数发起/.test(name || '')) return '被动联接'
  if (/FOF/.test(name || '')) return '被动FOF'
  return '主动'
}

function seedInsert(db, item, now) {
  const code = String(item.code || '')
  const name = String(item.name || '').trim()
  if (!CODE_RE.test(code) || !name) return
  const scan = Object.fromEntries(SCAN_FIELDS.map((field) => [field, item[field] ?? null]))
  if (scan.return_1y === null && item.y1 !== undefined) scan.return_1y = asNumber(item.y1)
  scan.limit_amount = limitInYuan(item.limit_amount)
  scan.direct_limit_amount = limitInYuan(item.direct_limit_amount)
  const tags = Array.isArray(item.tags) ? item.tags : []
  const columns = ['code', 'name', 'market', 'region', 'kind', 'tags', 'source_group', 'index_key', ...SCAN_FIELDS.slice(1), 'locked_fields', 'auto_values', 'active', 'created_at', 'updated_at', 'deleted_at']
  const values = [code, name, MARKET_VALUES.has(item.market) ? item.market : 'other', String(item.region || ''), String(item.kind || inferKind(name)), JSON.stringify(tags), String(item.source_group || 'manual'), String(item.index_key || ''), ...SCAN_FIELDS.slice(1).map((field) => scan[field]), '[]', JSON.stringify(scan), 1, now, now, null]
  db.prepare(`INSERT OR IGNORE INTO fund_registry (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...values)
}

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name))
}

function initializeFundDb(db) {
  db.exec(SCHEMA)
  if (db.prepare("SELECT 1 FROM fund_registry_meta WHERE key='seed_v1'").get()) return
  const now = TIMESTAMP()
  const seed = readJson(SEED_PATH, { funds: [] })
  for (const fund of seed.funds || []) seedInsert(db, fund, now)

  const pool = readJson(POOL_PATH, { funds: [] })
  const metadata = readJson(META_PATH, { funds: {} }).funds || {}
  for (const fund of pool.funds || []) {
    const info = metadata[fund.code] || {}
    const regions = Array.isArray(info.regions) ? info.regions.filter((v) => typeof v === 'string' && v) : []
    const region = regions.join(' / ') || '多市场 / 全球'
    const cross = regions.length > 1 || regions.some((value) => /全球|多市场/.test(value))
    seedInsert(db, { code: fund.code, name: fund.name, market: cross ? 'cross' : 'other', region, kind: '主动', tags: [...regions, ...(info.themes || [])], source_group: 'active_pool', index_key: 'world', inception_date: fund.inception_date }, now)
  }

  if (tableExists(db, 'funds')) {
    const oldColumns = new Set(db.prepare('PRAGMA table_info(funds)').all().map((row) => row.name))
    const columns = SCAN_FIELDS.filter((field) => oldColumns.has(field))
    const oldRows = db.prepare(`SELECT code, name, index_key${columns.length ? `, ${columns.join(',')}` : ''} FROM funds`).all()
    for (const old of oldRows) {
      if (!CODE_RE.test(String(old.code || '')) || !old.name) continue
      if (!db.prepare('SELECT 1 FROM fund_registry WHERE code=?').get(old.code)) {
        const indexKey = old.index_key || ''
        const market = ['nasdaq100', 'sp500', 'manual'].includes(indexKey) ? 'us' : 'other'
        seedInsert(db, { ...old, market, region: market === 'us' ? '美国' : '多市场 / 全球', kind: inferKind(old.name), source_group: market === 'us' ? 'us' : (indexKey === 'world' ? 'active_pool' : 'worldpage'), index_key: indexKey }, now)
      } else {
        const valueColumns = columns.filter((field) => field !== 'name')
        const assignments = valueColumns.map((field) => `${field}=COALESCE(?,${field})`)
        if (assignments.length) {
          // 旧静态表额度以万元存储，合并前同样要换算为元（>=1e11 的无限额度标记保持原值）
          const values = valueColumns.map((field) =>
            field === 'limit_amount' || field === 'direct_limit_amount'
              ? limitInYuan(old[field])
              : old[field]
          )
          db.prepare(`UPDATE fund_registry SET ${assignments.join(',')}, updated_at=? WHERE code=?`).run(...values, now, old.code)
        }
      }
    }
  }

  const legacy = {
    '012979': { direct_limit_amount: 100000000000, direct_as_of: '2026-09-22', direct_source: '人工核验' },
    '012980': { direct_limit_amount: 100000000000, direct_as_of: '2026-09-22', direct_source: '人工核验' },
    '022005': { status: '暂停申购' },
  }
  for (const [code, values] of Object.entries(legacy)) {
    const row = db.prepare('SELECT locked_fields FROM fund_registry WHERE code=?').get(code)
    if (!row) continue
    const locked = new Set(JSON.parse(row.locked_fields || '[]'))
    for (const [field, value] of Object.entries(values)) {
      if (!locked.has(field)) {
        db.prepare(`UPDATE fund_registry SET ${field}=?, updated_at=? WHERE code=?`).run(value, now, code)
        locked.add(field)
      }
    }
    db.prepare('UPDATE fund_registry SET locked_fields=? WHERE code=?').run(JSON.stringify([...locked].sort()), code)
  }
  db.prepare("INSERT INTO fund_registry_meta(key,value) VALUES('seed_v1',?)").run(now)
}

function decode(row) {
  return {
    ...row,
    tags: safeJson(row.tags, []),
    locked_fields: safeJson(row.locked_fields, []),
    auto_values: safeJson(row.auto_values, {}),
    active: Boolean(row.active),
  }
}

function safeJson(value, fallback) {
  try { return JSON.parse(value || JSON.stringify(fallback)) } catch { return fallback }
}

function logEvent(db, code, action, fields = []) {
  db.prepare('INSERT INTO fund_registry_events(code,action,changed_fields,created_at) VALUES(?,?,?,?)').run(code, action, JSON.stringify(fields), TIMESTAMP())
}

function validateFields(input, { partial = false } = {}) {
  const errors = []
  const output = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: ['请求内容格式不正确'], fields: {} }
  for (const key of Object.keys(input)) {
    if (!ALL_FIELDS.has(key) && key !== 'locked_fields' && key !== 'code') errors.push(`不支持的字段：${key}`)
  }
  if (!partial || Object.hasOwn(input, 'market')) {
    const market = input.market
    if (!MARKET_VALUES.has(market)) errors.push('市场必须是 us、other 或 cross')
    else output.market = market
  }
  for (const field of ['name', 'region', 'kind', 'index_key', 'status', 'redeem', 'direct_as_of', 'direct_source', 'direct_source_url', 'track_target', 'inception_date', 'fund_size_date']) {
    if (partial && !Object.hasOwn(input, field)) continue
    if (!partial && !Object.hasOwn(input, field)) {
      // 全量创建时缺失的可选文本字段按空串处理（表结构为 NOT NULL DEFAULT ''）；仅名称/地区/类型必填
      if (['name', 'region', 'kind'].includes(field)) { errors.push(`${field}不能为空`); continue }
      output[field] = ''
      continue
    }
    const value = input[field]
    if (value === null && !['name', 'region', 'kind', 'index_key'].includes(field)) {
      output[field] = null
      continue
    }
    if (typeof value !== 'string') { errors.push(`${field} 必须是文本`); continue }
    const text = value.trim()
    const max = field === 'direct_source_url' ? 1000 : field === 'name' ? 120 : 100
    if (text.length > max) { errors.push(`${field} 长度不能超过 ${max}`); continue }
    if (!partial && ['name', 'region', 'kind'].includes(field) && !text) { errors.push(`${field} 不能为空`); continue }
    if (['direct_as_of', 'inception_date', 'fund_size_date'].includes(field) && text && !validDate(text)) { errors.push(`${field} 日期格式应为 YYYY-MM-DD`); continue }
    output[field] = text
  }
  for (const field of NUMERIC_FIELDS) {
    if (partial && !Object.hasOwn(input, field)) continue
    if (!partial && !Object.hasOwn(input, field)) { output[field] = null; continue }
    const value = input[field]
    if (value === null || value === '') { output[field] = null; continue }
    const rangeOk = SIGNED_NUMERIC.has(field) ? Number.isFinite(value) : Number.isFinite(value) && value >= 0
    if (typeof value !== 'number' || !rangeOk) { errors.push(`${field} 必须是有限数字或空值`); continue }
    output[field] = value
  }
  if (!partial || Object.hasOwn(input, 'tags')) {
    const tags = input.tags === undefined ? [] : input.tags
    if (!Array.isArray(tags) || tags.length > 20 || tags.some((tag) => typeof tag !== 'string' || !tag.trim() || tag.trim().length > 30)) errors.push('tags 需为不超过20个、每个不超过30字的文本数组')
    else output.tags = [...new Set(tags.map((tag) => tag.trim()))]
  }
  if (!partial || Object.hasOwn(input, 'locked_fields')) {
    const locked = input.locked_fields === undefined ? [] : input.locked_fields
    if (!Array.isArray(locked) || locked.some((field) => typeof field !== 'string' || !LOCKABLE_FIELDS.has(field))) errors.push('locked_fields 包含不支持的字段')
    else output.locked_fields = [...new Set(locked)].sort()
  }
  if (Object.hasOwn(input, 'source_group')) {
    if (typeof input.source_group !== 'string' || !['us', 'worldpage', 'active_pool', 'manual'].includes(input.source_group)) errors.push('source_group 不合法')
    else output.source_group = input.source_group
  }
  if (!partial && (!output.name || !output.region || !output.kind)) errors.push('名称、地区和类型必填')
  return { ok: errors.length === 0, errors, fields: output }
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function rowList(db, includeDeleted = false) {
  const where = includeDeleted ? '' : 'WHERE active=1'
  return db.prepare(`SELECT * FROM fund_registry ${where} ORDER BY market, region, name, code`).all().map(decode)
}

function appendHistory(db, fund) {
  const result = { ...fund }
  if (!tableExists(db, 'snapshots')) { result.history = []; return result }
  result.history = db.prepare('SELECT date,status,redeem,limit_amount,direct_limit_amount FROM snapshots WHERE code=? ORDER BY date').all(fund.code)
  if (!result.history.length && fund.status) result.history = [{ date: '', status: fund.status, redeem: fund.redeem, limit_amount: fund.limit_amount, direct_limit_amount: fund.direct_limit_amount }]
  return result
}

function publicPayload(db) {
  const funds = rowList(db).map((fund) => appendHistory(db, fund))
  const tombstones = db.prepare('SELECT code FROM fund_registry WHERE active=0 ORDER BY code').all().map((row) => row.code)
  const recentChanges = tableExists(db, 'changes')
    ? db.prepare("SELECT code,date,field,old_val,new_val FROM changes WHERE date >= date('now','-7 days') ORDER BY date DESC,id DESC LIMIT 300").all()
    : []
  const byCode = new Map(funds.map((fund) => [fund.code, fund]))
  for (const item of recentChanges) {
    const fund = byCode.get(item.code)
    item.name = fund?.name || ''
    item.region = fund?.region || (fund?.market === 'us' ? '美国' : undefined)
  }
  return { ok: true, registry_version: 1, generated_at: TIMESTAMP(), funds, recent_changes: recentChanges, rules: RULES, tombstones }
}

function parseAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  const match = String(value ?? '').replace(/,/g, '').match(/^\s*(-)?([\d.]+)\s*([万亿]?)\s*(?:元|%)?\s*$/)
  if (!match) return null
  const sign = match[1] === '-' ? -1 : 1
  return sign * Number(match[2]) * ({ '': 1, '万': 10000, '亿': 100000000 }[match[3]])
}

function parsePercent(value) {
  const number = parseAmount(String(value ?? '').replace('%', ''))
  return number === null ? null : number
}

async function getText(url) {
  let response
  try { response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PMTOOLS/1.0)' }, signal: AbortSignal.timeout(8000) }) }
  catch (error) { throw Object.assign(new Error('资料源请求超时或连接失败'), { status: 502, cause: error }) }
  if (!response.ok) throw Object.assign(new Error(`资料源返回 HTTP ${response.status}`), { status: 502 })
  const text = await response.text()
  if (text.length > 20_000_000) throw Object.assign(new Error('资料源响应超过大小限制'), { status: 502 })
  return text
}

function decodeHtml(value) {
  return String(value || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim()
}

function parseDetails(html) {
  const result = {}
  const target = html.match(/跟踪标的[：:]\s*<\/a>\s*([^<|]+)/)
  if (target && !['--', '无', '该基金无跟踪标的'].includes(decodeHtml(target[1]))) result.track_target = decodeHtml(target[1])
  const labels = { return_1m: '近1月', return_6m: '近6月', return_1y: '近1年', return_3y: '近3年', return_since: '成立来' }
  for (const [field, label] of Object.entries(labels)) {
    const match = html.match(new RegExp(`${label}：</span>\\s*<span[^>]*>\\s*([^<]+?)\\s*</span>`, 's'))
    if (match) result[field] = parsePercent(match[1].replace(/,/g, '').replace('%', ''))
  }
  const inception = html.match(/<span[^>]*>成\s*立\s*日<\/span>：\s*(\d{4}-\d{2}-\d{2})/s)
  if (inception) result.inception_date = inception[1]
  const size = html.match(/>规模<\/a>：\s*([\d.]+)\s*亿元（(\d{4}-\d{2}-\d{2})）/s)
  if (size) { result.fund_size = Number(size[1]); result.fund_size_date = size[2] }
  return result
}

function parseFees(html) {
  const result = {}
  const labels = { management_fee_rate: '管理费率', custody_fee_rate: '托管费率', sales_service_fee_rate: '销售服务费率' }
  for (const [field, label] of Object.entries(labels)) {
    const match = html.match(new RegExp(`>${label}<\\/td>\\s*<td[^>]*>\\s*([\\d.]+)%`, 's'))
    if (match) result[field] = Number(match[1])
  }
  if (result.management_fee_rate != null && result.custody_fee_rate != null) result.operation_fee_rate = Number((result.management_fee_rate + result.custody_fee_rate + (result.sales_service_fee_rate || 0)).toFixed(4))
  return result
}

function parsePurchasePayload(text, code) {
  const raw = text.slice(text.indexOf('=') + 1).trim().replace(/;\s*$/, '')
  // 天天基金返回 JS 对象字面量（{datas:[...]}，键无引号），给裸键补引号后再解析
  const jsonText = raw.replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":')
  let payload
  try { payload = JSON.parse(jsonText) } catch { throw Object.assign(new Error('天天基金申购数据结构无法识别'), { status: 502 }) }
  const row = payload?.datas?.find((item) => Array.isArray(item) && String(item[0]).padStart(6, '0') === code)
  if (!row || row.length < 13) throw Object.assign(new Error('天天基金申购表中没有该代码'), { status: 404 })
  return {
    code,
    name: String(row[1] || '').trim(),
    status: String(row[5] || '暂无申购信息').trim(),
    redeem: String(row[6] || '暂无赎回信息').trim(),
    limit_amount: parseAmount(row[9]),
    min_buy: parseAmount(row[8]),
    fee: parsePercent(row[12]),
  }
}

export async function previewFundFromEastmoney(code) {
  if (!CODE_RE.test(String(code || ''))) throw Object.assign(new Error('基金代码须为6位数字'), { status: 400 })
  const purchaseUrl = new URL('https://fund.eastmoney.com/Data/Fund_JJJZ_Data.aspx')
  purchaseUrl.search = new URLSearchParams({ t: '8', page: '1,50000', js: 'reData', sort: 'fcode,asc' }).toString()
  const detailUrl = `https://fund.eastmoney.com/${code}.html`
  const feeUrl = `https://fundf10.eastmoney.com/jjfl_${code}.html`
  const [purchaseText, detailHtml, feeHtml] = await Promise.all([getText(purchaseUrl), getText(detailUrl), getText(feeUrl)])
  const fund = { ...parsePurchasePayload(purchaseText, code), ...parseDetails(detailHtml), ...parseFees(feeHtml) }
  return { fund, source: '东方财富天天基金申购表、基金主页及费率页' }
}

export function createFundStore({ dbPath, fundPreview = previewFundFromEastmoney }) {
  let db
  const getDb = () => {
    if (!db) {
      db = new Database(dbPath, { timeout: 5000 })
      db.pragma('busy_timeout = 5000')
      db.pragma('journal_mode = WAL')
      db.transaction(() => initializeFundDb(db)).immediate()
    }
    return db
  }
  const activeFund = (code) => getDb().prepare('SELECT * FROM fund_registry WHERE code=? AND active=1').get(code)
  return {
    list: () => rowList(getDb()),
    public: () => publicPayload(getDb()),
    preview: (code) => fundPreview(code),
    create(input) {
      const validation = validateFields(input)
      if (!validation.ok) return { ok: false, code: 400, errors: validation.errors }
      const fields = validation.fields
      const code = String(input.code || '')
      if (!CODE_RE.test(code)) return { ok: false, code: 400, errors: ['基金代码须为6位数字'] }
      const database = getDb()
      const exists = database.prepare('SELECT active FROM fund_registry WHERE code=?').get(code)
      if (exists) return { ok: false, code: 409, errors: [exists.active ? '基金代码已存在' : '该基金代码已删除并保留墓碑，不能重复新增'] }
      const now = TIMESTAMP()
      const autoValues = Object.fromEntries(SCAN_FIELDS.map((field) => [field, fields[field] ?? null]))
      const values = { ...fields, code, source_group: fields.source_group || (fields.market === 'us' ? 'us' : 'manual'), locked_fields: JSON.stringify(fields.locked_fields || []), tags: JSON.stringify(fields.tags || []), auto_values: JSON.stringify(autoValues), active: 1, created_at: now, updated_at: now, deleted_at: null }
      const columns = Object.keys(values)
      database.transaction(() => {
        database.prepare(`INSERT INTO fund_registry (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...columns.map((column) => values[column]))
        logEvent(database, code, 'create', columns.filter((key) => !['code', 'created_at', 'updated_at', 'auto_values', 'active', 'deleted_at'].includes(key)))
      }).immediate()
      return { ok: true, fund: decode(database.prepare('SELECT * FROM fund_registry WHERE code=?').get(code)) }
    },
    update(code, input) {
      if (!CODE_RE.test(code)) return { ok: false, code: 400, errors: ['基金代码须为6位数字'] }
      if (Object.hasOwn(input || {}, 'code') && input.code !== code) return { ok: false, code: 400, errors: ['基金代码创建后不可修改'] }
      const validation = validateFields(input, { partial: true })
      if (!validation.ok) return { ok: false, code: 400, errors: validation.errors }
      const fields = validation.fields
      delete fields.code
      delete fields.source_group
      const database = getDb()
      const before = activeFund(code)
      if (!before) return { ok: false, code: 404, errors: ['基金不存在'] }
      const currentLocks = safeJson(before.locked_fields, [])
      const newLocks = fields.locked_fields || currentLocks
      delete fields.locked_fields
      for (const field of Object.keys(fields)) {
        if (LOCKABLE_FIELDS.has(field) && !newLocks.includes(field)) {
          // 所有手工改动默认锁住；显式 lock 列表可解锁指定字段。
          newLocks.push(field)
        }
      }
      const lockValue = JSON.stringify([...new Set(newLocks)].sort())
      const serialized = { ...fields, locked_fields: lockValue, updated_at: TIMESTAMP() }
      if (Object.hasOwn(fields, 'tags')) serialized.tags = JSON.stringify(fields.tags)
      const columns = Object.keys(serialized)
      database.transaction(() => {
        database.prepare(`UPDATE fund_registry SET ${columns.map((key) => `${key}=?`).join(',')} WHERE code=? AND active=1`).run(...columns.map((key) => serialized[key]), code)
        logEvent(database, code, 'update', columns.filter((key) => key !== 'updated_at'))
      }).immediate()
      return { ok: true, fund: decode(database.prepare('SELECT * FROM fund_registry WHERE code=?').get(code)) }
    },
    unlock(code, fields) {
      if (!CODE_RE.test(code)) return { ok: false, code: 400, errors: ['基金代码须为6位数字'] }
      if (!Array.isArray(fields) || !fields.length || fields.some((field) => !LOCKABLE_FIELDS.has(field))) return { ok: false, code: 400, errors: ['fields 必须包含可恢复自动更新的字段'] }
      const database = getDb()
      const before = activeFund(code)
      if (!before) return { ok: false, code: 404, errors: ['基金不存在'] }
      const locks = new Set(safeJson(before.locked_fields, []))
      const auto = safeJson(before.auto_values, {})
      const updates = { updated_at: TIMESTAMP() }
      for (const field of fields) {
        locks.delete(field)
        if (Object.hasOwn(auto, field)) updates[field] = auto[field]
        else updates[field] = null
      }
      updates.locked_fields = JSON.stringify([...locks].sort())
      const columns = Object.keys(updates)
      database.transaction(() => {
        database.prepare(`UPDATE fund_registry SET ${columns.map((key) => `${key}=?`).join(',')} WHERE code=? AND active=1`).run(...columns.map((key) => updates[key]), code)
        logEvent(database, code, 'unlock', fields)
      }).immediate()
      return { ok: true, fund: decode(database.prepare('SELECT * FROM fund_registry WHERE code=?').get(code)) }
    },
    delete(code) {
      if (!CODE_RE.test(code)) return { ok: false, code: 400, errors: ['基金代码须为6位数字'] }
      const database = getDb()
      if (!activeFund(code)) return { ok: false, code: 404, errors: ['基金不存在'] }
      const now = TIMESTAMP()
      database.transaction(() => {
        database.prepare('UPDATE fund_registry SET active=0,deleted_at=?,updated_at=? WHERE code=?').run(now, now, code)
        logEvent(database, code, 'delete', ['active'])
      }).immediate()
      return { ok: true }
    },
    close() { if (db) { db.close(); db = null } },
  }
}

export { CODE_RE, LOCKABLE_FIELDS, validateFields }
