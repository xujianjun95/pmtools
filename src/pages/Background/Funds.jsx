import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createAdminFund,
  deleteAdminFund,
  listAdminFunds,
  previewFund,
  unlockAdminFund,
  updateAdminFund,
} from './api'

const CODE_RE = /^\d{6}$/

const MARKETS = [
  { value: 'us', label: '美国' },
  { value: 'other', label: '其他市场' },
  { value: 'cross', label: '跨市场' },
]
const MARKET_LABEL = Object.fromEntries(MARKETS.map((m) => [m.value, m.label]))

// 编辑/补录表单分组（顺序即展示顺序）
const FIELD_GROUPS = [
  {
    title: '分类',
    fields: [
      { key: 'market', label: '市场', type: 'select', options: MARKETS, required: true },
      { key: 'region', label: '地区', required: true },
      { key: 'kind', label: '类型', required: true },
      { key: 'index_key', label: '指数键' },
      { key: 'tags', label: '标签（逗号分隔）', type: 'tags' },
    ],
  },
  {
    title: '申购与额度（金额单位：元）',
    fields: [
      { key: 'status', label: '申购状态' },
      { key: 'redeem', label: '赎回状态' },
      { key: 'limit_amount', label: '代销额度', type: 'number' },
      { key: 'min_buy', label: '起购金额', type: 'number' },
      { key: 'direct_limit_amount', label: '直销额度', type: 'number' },
      { key: 'direct_as_of', label: '直销数据日期', type: 'date' },
      { key: 'direct_source', label: '直销来源' },
    ],
  },
  {
    title: '资料与收益（收益率单位：%）',
    fields: [
      { key: 'track_target', label: '跟踪标的' },
      { key: 'tracking_error', label: '跟踪误差', type: 'number' },
      { key: 'fee', label: '手续费', type: 'number' },
      { key: 'return_1m', label: '近1月', type: 'number', signed: true },
      { key: 'return_6m', label: '近6月', type: 'number', signed: true },
      { key: 'return_1y', label: '近1年', type: 'number', signed: true },
      { key: 'return_3y', label: '近3年', type: 'number', signed: true },
      { key: 'return_since', label: '成立来', type: 'number', signed: true },
      { key: 'inception_date', label: '成立日期', type: 'date' },
      { key: 'fund_size', label: '规模（亿元）', type: 'number' },
      { key: 'fund_size_date', label: '规模日期', type: 'date' },
    ],
  },
  {
    title: '费率（单位：%）',
    fields: [
      { key: 'management_fee_rate', label: '管理费率', type: 'number' },
      { key: 'custody_fee_rate', label: '托管费率', type: 'number' },
      { key: 'sales_service_fee_rate', label: '销售服务费率', type: 'number' },
      { key: 'operation_fee_rate', label: '运作费率', type: 'number' },
    ],
  },
]

const FORM_KEYS = FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key)).filter(
  (k) => k !== 'tags'
)
const LOCKABLE_HINT = '手动保存后该字段锁定，扫描器不再覆盖；可随时恢复自动更新'

function trimNumber(n) {
  const s = String(Number(n.toFixed(4)))
  // 仅在有小数位时去掉尾部多余的 0，避免误删整数末尾的 0（如 500 被截成 5）
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}

/** 元 → 友好金额 */
function formatAmount(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  if (n === 0) return '0'
  if (Math.abs(n) >= 1e8) return `${trimNumber(n / 1e8)}亿元`
  if (Math.abs(n) >= 1e4) return `${trimNumber(n / 1e4)}万元`
  return `${trimNumber(n)}元`
}

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 由基金对象生成表单初始值（数字转字符串供 input 使用） */
function formFromFund(fund = {}) {
  const out = { market: fund.market || 'other' }
  for (const key of FORM_KEYS) {
    if (key === 'market') continue
    const v = fund[key]
    out[key] = v === null || v === undefined ? '' : String(v)
  }
  out.tags = Array.isArray(fund.tags) ? fund.tags.join(', ') : ''
  return out
}

/** 表单 → 接口 payload */
function payloadFromForm(form) {
  const payload = { market: form.market }
  for (const key of FORM_KEYS) {
    if (key === 'market') continue
    const field = FIELD_GROUPS.flatMap((g) => g.fields).find((f) => f.key === key)
    const raw = String(form[key] ?? '').trim()
    if (raw === '') {
      payload[key] = null
      continue
    }
    if (field?.type === 'number') {
      const n = Number(raw)
      payload[key] = Number.isFinite(n) ? n : raw
    } else if (field?.type === 'date') {
      payload[key] = raw
    } else {
      payload[key] = raw
    }
  }
  payload.tags = String(form.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  return payload
}

/** 编辑保存：只收集相对当前基金真正改动的字段，避免未改动的未锁定字段被数据层误锁 */
function changedPayload(original, form) {
  const full = payloadFromForm(form)
  const norm = (v) => {
    if (v === '' || v === undefined) return null
    if (Array.isArray(v)) return JSON.stringify(v)
    return v
  }
  const out = {}
  for (const [key, val] of Object.entries(full)) {
    if (JSON.stringify(norm(val)) !== JSON.stringify(norm(original?.[key]))) out[key] = val
  }
  return out
}

function FieldInput({ field, value, onChange, locked, onUnlock }) {
  const id = `fld-${field.key}`
  const lockBtn = locked ? (
    <button
      type="button"
      className="bg-fundLock"
      title="该字段已锁定，点击恢复自动更新"
      onClick={onUnlock}
    >
      已锁定 · 恢复
    </button>
  ) : null

  let input
  if (field.type === 'select') {
    input = (
      <select
        id={id}
        className="bg-input"
        value={value}
        disabled={locked}
        onChange={(e) => onChange(field.key, e.target.value)}
      >
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  } else {
    input = (
      <input
        id={id}
        className="bg-input"
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        step="any"
        value={value}
        disabled={locked}
        placeholder={field.type === 'number' ? '空值表示未知' : ''}
        onChange={(e) => onChange(field.key, e.target.value)}
      />
    )
  }

  return (
    <label className="bg-field">
      <span className="bg-fieldLabel">
        {field.label}
        {field.required ? ' *' : ''}
        {lockBtn}
      </span>
      {input}
    </label>
  )
}

/** 新增基金：代码 → 获取资料预览 → 补齐 → 确认；失败可手动补录 */
function NewFundDialog({ onClose, onCreated }) {
  const [code, setCode] = useState('')
  const [stage, setStage] = useState('code') // code | preview | manual
  const [form, setForm] = useState(() => formFromFund({ market: 'other' }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [source, setSource] = useState('')

  const handlePreview = useCallback(async () => {
    const c = code.trim()
    if (!CODE_RE.test(c)) {
      setError('基金代码须为 6 位数字')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await previewFund(c)
      const fund = result.fund || {}
      setForm(
        formFromFund({
          market: 'other',
          region: '多市场 / 全球',
          kind: /ETF联接|指数发起/.test(fund.name) ? '被动联接' : '主动',
          ...fund,
        })
      )
      setSource(result.source || '')
      setStage('preview')
    } catch (err) {
      setError(`${err?.message || '获取失败'}，可手动补录`)
    } finally {
      setBusy(false)
    }
  }, [code])

  const handleChange = useCallback((key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
  }, [])

  const handleSubmit = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const fund = await createAdminFund({ code: code.trim(), ...payloadFromForm(form) })
      onCreated(fund)
    } catch (err) {
      setError(err?.message || '添加失败')
      setBusy(false)
    }
  }, [code, form, onCreated])

  return (
    <div className="bg-dialogMask" onClick={onClose}>
      <div className="bg-dialog bg-dialogWide" onClick={(e) => e.stopPropagation()}>
        <h2 className="bg-dialogTitle">新增基金</h2>
        <p className="bg-dialogHint">
          不同份额使用各自代码；代码创建后不可修改，重复代码将被拒绝。
        </p>

        <label className="bg-field">
          <span className="bg-fieldLabel">基金代码 *</span>
          <input
            className="bg-input bg-mono"
            value={code}
            maxLength={6}
            disabled={stage !== 'code'}
            placeholder="6 位数字，如 012980"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </label>

        {stage === 'code' ? (
          <>
            {error ? <p className="bg-formError">{error}</p> : null}
            <div className="bg-dialogActions">
              <button type="button" className="bg-btnGhost" onClick={onClose}>
                取消
              </button>
              <button type="button" className="bg-btnGhost" onClick={() => setStage('manual')}>
                手动补录
              </button>
              <button type="button" className="bg-btnPrimary" disabled={busy} onClick={handlePreview}>
                {busy ? '获取中…' : '获取资料'}
              </button>
            </div>
          </>
        ) : (
          <>
            {source ? <p className="bg-okLine">资料来源：{source}</p> : null}
            {stage === 'manual' ? (
              <p className="bg-dialogHint">手动补录：请逐项填写下列信息。</p>
            ) : (
              <p className="bg-dialogHint">请核对预填资料并补齐分类信息，确认后添加。</p>
            )}
            {FIELD_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="bg-subTitle">{group.title}</p>
                <div className="bg-fundGrid">
                  {group.fields.map((field) => (
                    <FieldInput
                      key={field.key}
                      field={field}
                      value={form[field.key]}
                      onChange={handleChange}
                    />
                  ))}
                </div>
              </div>
            ))}
            {error ? <p className="bg-formError">{error}</p> : null}
            <div className="bg-dialogActions">
              <button type="button" className="bg-btnGhost" onClick={onClose}>
                取消
              </button>
              <button type="button" className="bg-btnPrimary" disabled={busy} onClick={handleSubmit}>
                {busy ? '提交中…' : '确认添加'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** 编辑基金：分组表单 + 锁定字段即时恢复 */
function EditFundDialog({ fund, onClose, onSaved, onMutate }) {
  const [form, setForm] = useState(() => formFromFund(fund))
  const [lockedFields, setLockedFields] = useState(() => new Set(fund.locked_fields || []))
  const [current, setCurrent] = useState(fund)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleChange = useCallback((key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
  }, [])

  const handleUnlock = useCallback(
    async (key) => {
      setBusy(true)
      setError('')
      try {
        const updated = await unlockAdminFund(fund.code, [key])
        setCurrent(updated)
        setLockedFields(new Set(updated.locked_fields || []))
        setForm(formFromFund(updated))
        onMutate?.(updated) // 恢复即时生效，即便随后取消也让列表保持同步
      } catch (err) {
        setError(err?.message || '恢复失败')
      } finally {
        setBusy(false)
      }
    },
    [fund.code, onMutate]
  )

  const handleSave = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const payload = changedPayload(current, form)
      if (Object.keys(payload).length === 0) {
        onClose()
        return
      }
      const updated = await updateAdminFund(fund.code, payload)
      onSaved(updated)
    } catch (err) {
      setError(err?.message || '保存失败')
      setBusy(false)
    }
  }, [fund.code, current, form, onClose, onSaved])

  return (
    <div className="bg-dialogMask" onClick={onClose}>
      <div className="bg-dialog bg-dialogWide" onClick={(e) => e.stopPropagation()}>
        <h2 className="bg-dialogTitle">
          编辑基金
          <span className="bg-dialogHint"> · {current.code}（代码不可修改）</span>
        </h2>
        <p className="bg-dialogHint">{LOCKABLE_HINT}。</p>
        {FIELD_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="bg-subTitle">{group.title}</p>
            <div className="bg-fundGrid">
              {group.fields.map((field) => (
                <FieldInput
                  key={field.key}
                  field={field}
                  value={form[field.key]}
                  onChange={handleChange}
                  locked={lockedFields.has(field.key)}
                  onUnlock={() => handleUnlock(field.key)}
                />
              ))}
            </div>
          </div>
        ))}
        {error ? <p className="bg-formError">{error}</p> : null}
        <div className="bg-dialogActions">
          <button type="button" className="bg-btnGhost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="bg-btnPrimary" disabled={busy} onClick={handleSave}>
            {busy ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteDialog({ fund, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      await deleteAdminFund(fund.code)
      onDeleted(fund.code)
    } catch (err) {
      setError(err?.message || '删除失败')
      setBusy(false)
    }
  }, [fund, onDeleted])

  return (
    <div className="bg-dialogMask" onClick={onClose}>
      <div className="bg-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="bg-dialogTitle">删除基金</h2>
        <p className="bg-dialogHint">
          确定删除「{fund.name}（{fund.code}）」吗？删除后将退出前台展示与扫描名单，且不能被旧静态名单重新加入。
        </p>
        {error ? <p className="bg-formError">{error}</p> : null}
        <div className="bg-dialogActions">
          <button type="button" className="bg-btnGhost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="bg-btnPrimary" disabled={busy} onClick={handleDelete}>
            {busy ? '删除中…' : '确认删除'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Funds() {
  const [funds, setFunds] = useState([])
  const [status, setStatus] = useState('loading') // loading | error | ready
  const [market, setMarket] = useState('all')
  const [tag, setTag] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [opError, setOpError] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const list = await listAdminFunds()
      setFunds(list)
      setStatus('ready')
    } catch (err) {
      setOpError(err?.message || '加载失败')
      setStatus('error')
    }
  }, [])

  // 首次加载：status 初始已是 loading，直接拉取后落库；setState 放在异步回调里，
  // 避免在 effect 体内同步 setState 触发级联渲染。load() 仍供「刷新」按钮手动调用。
  useEffect(() => {
    let cancelled = false
    listAdminFunds()
      .then((list) => {
        if (!cancelled) {
          setFunds(list)
          setStatus('ready')
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setOpError(err?.message || '加载失败')
          setStatus('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const allTags = useMemo(() => {
    const s = new Set()
    for (const f of funds) for (const t of f.tags || []) s.add(t)
    return [...s].sort()
  }, [funds])

  const counts = useMemo(() => {
    const c = { all: funds.length, us: 0, other: 0, cross: 0 }
    for (const f of funds) c[f.market] = (c[f.market] || 0) + 1
    return c
  }, [funds])

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return funds.filter((f) => {
      if (market !== 'all' && f.market !== market) return false
      if (tag !== 'all' && !(f.tags || []).includes(tag)) return false
      if (kw && !f.code.includes(kw) && !f.name.toLowerCase().includes(kw)) return false
      return true
    })
  }, [funds, market, tag, keyword])

  const refreshOne = useCallback((updated) => {
    setFunds((list) => list.map((f) => (f.code === updated.code ? updated : f)))
  }, [])

  const marketFilters = [
    { value: 'all', label: '全部' },
    ...MARKETS,
  ]

  if (status === 'loading') {
    return <p className="bg-hint">正在加载基金名册…</p>
  }
  if (status === 'error') {
    return (
      <div className="bg-stateBox">
        <p>{opError}</p>
        <button type="button" className="bg-btnPrimary" onClick={load}>
          重试
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="bg-pageHead">
        <h1 className="bg-pageTitle">基金管理</h1>
        <button type="button" className="bg-btnPrimary" onClick={() => setShowNew(true)}>
          新增基金
        </button>
      </div>

      <div className="bg-fundToolbar">
        <div className="bg-days">
          {marketFilters.map((m) => (
            <button
              key={m.value}
              type="button"
              className={`bg-daysBtn${market === m.value ? ' is-active' : ''}`}
              onClick={() => setMarket(m.value)}
            >
              {m.label} {counts[m.value] ?? 0}
            </button>
          ))}
        </div>
        <div className="bg-fundTools">
          <select className="bg-input bg-fundTagSelect" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="all">全部标签</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            className="bg-input bg-fundSearch"
            value={keyword}
            placeholder="搜索代码 / 名称"
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="bg-stateBox">
          <p>{funds.length === 0 ? '名册为空，点击右上角新增第一只基金' : '没有符合筛选条件的基金'}</p>
        </div>
      ) : (
        <div className="bg-tableWrap">
          <table className="bg-table bg-fundTable">
            <thead>
              <tr>
                <th className="bg-colTitle">代码 / 名称</th>
                <th className="bg-fundColMarket">市场</th>
                <th className="bg-fundColRegion">地区 / 类型</th>
                <th className="bg-colTags">标签</th>
                <th className="bg-fundColStatus">申购状态</th>
                <th className="bg-fundColAmount">代销额度</th>
                <th className="bg-colTime">更新时间</th>
                <th className="bg-colOps">操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((f) => (
                <tr key={f.code}>
                  <td className="bg-cellTitle">
                    <span className="bg-mono">{f.code}</span>
                    <br />
                    {f.name}
                  </td>
                  <td>
                    <span className={`bg-status bg-fundMarket is-${f.market}`}>
                      {MARKET_LABEL[f.market]}
                    </span>
                  </td>
                  <td className="bg-cellMuted">
                    {f.region || '—'}
                    <br />
                    {f.kind || '—'}
                  </td>
                  <td className="bg-cellTags">{(f.tags || []).join('、') || '—'}</td>
                  <td className="bg-cellMuted">{f.status || '—'}</td>
                  <td className="bg-cellMuted">{formatAmount(f.limit_amount)}</td>
                  <td className="bg-cellTime">{formatTime(f.updated_at)}</td>
                  <td>
                    <div className="bg-rowOps">
                      <button type="button" className="bg-linkBtn" onClick={() => setEditing(f)}>
                        编辑
                      </button>
                      <button
                        type="button"
                        className="bg-linkBtn is-danger"
                        onClick={() => setDeleting(f)}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="bg-footnote">共 {visible.length} 只；手动修改的字段锁定后不被扫描覆盖。</p>

      {showNew ? (
        <NewFundDialog
          onClose={() => setShowNew(false)}
          onCreated={(fund) => {
            setShowNew(false)
            setFunds((list) => [...list, fund])
          }}
        />
      ) : null}
      {editing ? (
        <EditFundDialog
          fund={editing}
          onClose={() => setEditing(null)}
          onMutate={refreshOne}
          onSaved={(updated) => {
            setEditing(null)
            refreshOne(updated)
          }}
        />
      ) : null}
      {deleting ? (
        <DeleteDialog
          fund={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(code) => {
            setDeleting(null)
            setFunds((list) => list.filter((f) => f.code !== code))
          }}
        />
      ) : null}
    </div>
  )
}

export default Funds
