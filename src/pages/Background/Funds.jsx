import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  createAdminFund,
  deleteAdminFund,
  listAdminFunds,
  previewFund,
  updateAdminFund,
} from './api'

import { inferFundClassification } from './fundClassification'
import { compareRegions, getRegionDisplay } from '../QdiiMonitor/regions'

const CODE_RE = /^\d{6}$/

const MARKETS = [
  { value: 'us', label: '美国' },
  { value: 'other', label: '其他市场' },
  { value: 'cross', label: '跨市场' },
]
const MARKET_LABEL = Object.fromEntries(MARKETS.map((m) => [m.value, m.label]))

// 编辑/补录表单分组（顺序即展示顺序）
const AMOUNT_FIELDS = [
  { key: 'direct_limit_amount', label: '直销额度', type: 'number' },
  { key: 'limit_amount', label: '代销额度', type: 'number' },
]
const EDIT_FIELDS = [...AMOUNT_FIELDS, { key: 'status', label: '申购状态', type: 'select' }]
const PURCHASE_STATUSES = ['开放申购', '限大额', '暂停申购', '暂无申购信息']
const FIELD_GROUPS = [
  { title: '基本信息', fields: [
    { key: 'name', label: '基金名称', required: true },
    { key: 'market', label: '市场', type: 'select', options: MARKETS, required: true },
    { key: 'region', label: '地区（投资市场）', required: true, placeholder: '例如：中国 / A股、美国、日本', hint: '其他市场按此地区分组；自定义地区会新增栏目。' },
    { key: 'kind', label: '类型', required: true, placeholder: '例如：被动指数、主动' },
    { key: 'tags', label: '标签（逗号分隔）', type: 'tags' },
  ] },
  { title: '申购额度 · 元 / 日', fields: AMOUNT_FIELDS },
]

const FORM_KEYS = FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key)).filter(
  (k) => k !== 'tags'
)
const BASIC_FIELDS = FIELD_GROUPS[0].fields
const LOCKABLE_HINT = '维护申购额度与状态，其余资料随每日扫描更新'

function trimNumber(n) {
  const s = String(Number(n.toFixed(4)))
  // 仅在有小数位时去掉尾部多余的 0，避免误删整数末尾的 0（如 500 被截成 5）
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}

/** 元 → 友好金额 */
function formatAmount(value) {
  if (value == null || value === '') return '待更新'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  if (n >= 1e11) return '不限额'
  if (n === 0) return '0 元'
  if (Math.abs(n) >= 1e8) return `${trimNumber(n / 1e8)}亿元`
  if (Math.abs(n) >= 1e4) return `${trimNumber(n / 1e4)}万元`
  return `${trimNumber(n)}元`
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

/** 原生 dialog 提供焦点约束、Escape 关闭和关闭后的焦点恢复。 */
function FundDialog({ children, footer, onClose, busy = false, title }) {
  const dialogRef = useRef(null)
  const scrollRef = useRef(null)
  const contentRef = useRef(null)
  const trackRef = useRef(null)
  const dragRef = useRef(null)
  const scrollId = useId()
  const [scrollbar, setScrollbar] = useState({ height: 0, top: 0, max: 0, value: 0 })

  const syncScrollbar = useCallback(() => {
    const viewport = scrollRef.current
    const track = trackRef.current
    if (!viewport || !track) return
    const max = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
    const height = Math.min(track.clientHeight, Math.max(32, track.clientHeight * viewport.clientHeight / Math.max(1, viewport.scrollHeight)))
    const top = max ? (track.clientHeight - height) * viewport.scrollTop / max : 0
    setScrollbar({ height, top, max, value: viewport.scrollTop })
  }, [])

  useEffect(() => {
    const observer = new ResizeObserver(syncScrollbar)
    observer.observe(scrollRef.current)
    observer.observe(contentRef.current)
    observer.observe(trackRef.current)
    return () => observer.disconnect()
  }, [syncScrollbar])

  function handlePointerDown(event) {
    if (!scrollbar.max || event.button !== 0) return
    event.preventDefault()
    const viewport = scrollRef.current
    const track = event.currentTarget
    if (event.target === track) {
      const travel = track.clientHeight - scrollbar.height
      if (travel > 0) viewport.scrollTop = (event.clientY - track.getBoundingClientRect().top - scrollbar.height / 2) / travel * scrollbar.max
    }
    dragRef.current = { y: event.clientY, value: viewport.scrollTop }
    track.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event) {
    if (!dragRef.current) return
    const travel = event.currentTarget.clientHeight - scrollbar.height
    if (travel > 0) scrollRef.current.scrollTop = dragRef.current.value + (event.clientY - dragRef.current.y) / travel * scrollbar.max
  }

  function handleScrollKey(event) {
    const viewport = scrollRef.current
    const destinations = {
      ArrowUp: viewport.scrollTop - 40, ArrowDown: viewport.scrollTop + 40,
      PageUp: viewport.scrollTop - viewport.clientHeight, PageDown: viewport.scrollTop + viewport.clientHeight,
      Home: 0, End: scrollbar.max,
    }
    if (!Object.hasOwn(destinations, event.key)) return
    event.preventDefault()
    viewport.scrollTop = destinations[event.key]
  }

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog ref={dialogRef} className="bg-dialog bg-fundDialog" aria-label={title}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || busy) return
        const box = event.currentTarget.getBoundingClientRect()
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose()
      }}>
      <div className="bg-fundDialogBody">
      <div ref={scrollRef} id={scrollId} className="bg-fundDialogScroll" onScroll={syncScrollbar}>
        <div ref={contentRef} className="bg-fundDialogContent">{children}</div>
      </div>
      <div ref={trackRef} className="bg-fundScrollTrack" role="scrollbar" aria-label="弹窗滚动条"
        aria-controls={scrollId} aria-orientation="vertical" aria-valuemin={0}
        aria-valuemax={Math.ceil(scrollbar.max)} aria-valuenow={Math.round(scrollbar.value)}
        aria-hidden={scrollbar.max <= 1} tabIndex={scrollbar.max > 1 ? 0 : -1}
        style={{ visibility: scrollbar.max > 1 ? 'visible' : 'hidden' }}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
        onPointerUp={() => { dragRef.current = null }} onLostPointerCapture={() => { dragRef.current = null }}
        onPointerCancel={() => { dragRef.current = null }} onKeyDown={handleScrollKey}
        onWheel={(event) => { scrollRef.current.scrollTop += event.deltaY }}>
        <div className="bg-fundScrollThumb" style={{ height: scrollbar.height, transform: `translateY(${scrollbar.top}px)` }} />
      </div>
      </div>
      {footer ? <div className="bg-fundDialogFooter">{footer}</div> : null}
    </dialog>
  )
}

function FieldInput({ field, value, onChange, locked, onUnlock, busy }) {
  const id = `fld-${field.key}`
  const lockBtn = locked ? (
    <button
      type="button"
      className="bg-fundLock"
      title="该字段已锁定，点击恢复自动更新"
      disabled={busy}
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
        disabled={busy}
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
        min={field.type === 'number' ? 0 : undefined}
        required={field.required}
        value={value}
        disabled={busy}
        placeholder={field.type === 'number' ? '空值表示未知' : field.placeholder || ''}
        onChange={(e) => onChange(field.key, e.target.value)}
      />
    )
  }

  return (
    <label className={`bg-field${field.key === 'name' ? ' bg-fieldWide' : ''}`}>
      <span className="bg-fieldLabel">
        {field.label}
        {field.required ? ' *' : ''}
      </span>
      {input}
      {field.hint ? <small className="bg-fieldHint">{field.hint}</small> : null}
      {lockBtn}
    </label>
  )
}

/** 新增基金：代码 → 获取资料预览 → 补齐 → 确认；失败可手动补录 */
function NewFundDialog({ existingFunds, onEditExisting, onClose, onCreated }) {
  const [code, setCode] = useState('')
  const [stage, setStage] = useState('code') // code | preview | manual
  const [form, setForm] = useState(() => formFromFund({ market: 'other' }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [source, setSource] = useState('')
  const [previewValues, setPreviewValues] = useState({})
  const existingFund = existingFunds.find((fund) => fund.code === code.trim())

  const handlePreview = useCallback(async () => {
    if (busy) return
    const c = code.trim()
    if (existingFund) { setError('该基金已在名册中，请直接编辑已有基金'); return }
    if (!CODE_RE.test(c)) {
      setError('基金代码须为 6 位数字')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await previewFund(c)
      const fund = result.fund || {}
      setPreviewValues(fund)
      setForm(
        formFromFund({
          ...inferFundClassification(fund),
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
  }, [busy, code, existingFund])

  const handleChange = useCallback((key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (busy) return
    if (!CODE_RE.test(code) || !form.name?.trim() || !form.region?.trim() || !form.kind?.trim()) {
      setError('请填写六位基金代码、名称、地区和类型')
      return
    }
    const input = payloadFromForm(form)
    if (AMOUNT_FIELDS.some(({ key }) => input[key] !== null && (typeof input[key] !== 'number' || input[key] < 0))) {
      setError('额度须为非负数字；留空表示未知')
      return
    }
    setBusy(true)
    setError('')
    try {
      const locked_fields = AMOUNT_FIELDS.filter(({ key }) => input[key] !== (previewValues[key] ?? null)).map(({ key }) => key)
      const fund = await createAdminFund({ ...previewValues, code: code.trim(), ...input, locked_fields })
      onCreated(fund)
    } catch (err) {
      setError(err?.message || '添加失败')
      setBusy(false)
    }
  }, [busy, code, form, previewValues, onCreated])

  return (
    <FundDialog onClose={onClose} busy={busy} title="新增基金">
      <div>
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
            disabled={busy || stage !== 'code'}
            placeholder="6 位数字，如 012980"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </label>

        {existingFund ? (
          <div className="bg-importPreview">
            <p>该代码已在名册中：{existingFund.name}</p>
            <button type="button" className="bg-btnGhost" disabled={busy} onClick={() => onEditExisting(existingFund)}>编辑已有基金</button>
          </div>
        ) : null}

        {stage === 'code' ? (
          <>
            {error ? <p className="bg-formError">{error}</p> : null}
            <div className="bg-dialogActions">
              <button type="button" className="bg-btnGhost" disabled={busy} onClick={onClose}>
                取消
              </button>
              <button type="button" className="bg-btnGhost" disabled={busy || Boolean(existingFund) || !CODE_RE.test(code)} onClick={() => { setStage('manual'); setError('') }}>
                手动补录
              </button>
              <button type="button" className="bg-btnPrimary" disabled={busy || Boolean(existingFund) || !CODE_RE.test(code)} onClick={handlePreview}>
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
              <p className="bg-dialogHint">分类按名称与跟踪标的预填；未识别的地区和类型留空，请核对后添加。</p>
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
                      busy={busy}
                    />
                  ))}
                </div>
              </div>
            ))}
            {error ? <p className="bg-formError">{error}</p> : null}
            <div className="bg-dialogActions">
              <button type="button" className="bg-btnGhost" disabled={busy} onClick={onClose}>
                取消
              </button>
              <button type="button" className="bg-btnPrimary" disabled={busy} onClick={handleSubmit}>
                {busy ? '提交中…' : '确认添加'}
              </button>
            </div>
          </>
        )}
      </div>
    </FundDialog>
  )
}

/** 基本信息与三个独立更新模式一起保存。 */
function EditFundDialog({ fund, onClose, onSaved }) {
  const formId = useId()
  const [form, setForm] = useState(() => ({ ...formFromFund(fund), status: fund.status || '' }))
  const [manualFields, setManualFields] = useState(() => new Set((fund.locked_fields || []).filter((key) => EDIT_FIELDS.some((field) => field.key === key))))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function automaticValue(key) {
    if (Object.hasOwn(fund.auto_values || {}, key)) return fund.auto_values[key]
    return fund.locked_fields?.includes(key) ? null : fund[key]
  }

  function changeMode(key, manual) {
    setManualFields((previous) => {
      const next = new Set(previous)
      if (manual) next.add(key)
      else next.delete(key)
      return next
    })
    setError('')
  }

  async function handleSave(event) {
    event.preventDefault()
    if (busy) return
    const payload = { locked_fields: [...manualFields].sort() }
    const basicValues = payloadFromForm(form)
    const originalValues = payloadFromForm(formFromFund(fund))
    for (const { key, required, label } of BASIC_FIELDS) {
      if (required && !basicValues[key]) { setError(`请填写${label}`); return }
      if (JSON.stringify(basicValues[key]) !== JSON.stringify(originalValues[key])) {
        payload[key] = basicValues[key]
      }
    }
    for (const { key } of EDIT_FIELDS) {
      if (!manualFields.has(key)) continue
      const raw = form[key].trim()
      if (key === 'status') {
        if (!raw) { setError('手动更新时请选择申购状态'); return }
        payload[key] = raw
      } else {
        const value = raw === '' ? null : Number(raw)
        if (value !== null && (!Number.isFinite(value) || value < 0)) {
          setError('额度须为非负数字；留空表示未知')
          return
        }
        payload[key] = value
      }
    }
    setBusy(true)
    setError('')
    try { onSaved(await updateAdminFund(fund.code, payload)) }
    catch (err) { setError(err?.message || '保存失败'); setBusy(false) }
  }

  return (
    <FundDialog onClose={onClose} busy={busy} title="编辑基金" footer={
      <div className="bg-dialogActions">
        <button type="button" className="bg-btnGhost" disabled={busy} onClick={onClose}>取消</button>
        <button type="submit" form={formId} className="bg-btnPrimary" disabled={busy}>{busy ? '保存中…' : '保存修改'}</button>
      </div>
    }>
      <form id={formId} onSubmit={handleSave}>
        <p className="bg-fundEyebrow">申购设置</p>
        <h2 className="bg-dialogTitle">{fund.name}</h2>
        <p className="bg-dialogHint"><span className="bg-mono">{fund.code}</span> · {fund.region} · {fund.kind}</p>
        <details className="bg-basicInfoEditor" onInvalid={(event) => { event.currentTarget.open = true }}>
          <summary><span>基本信息</span><span className="bg-basicInfoChevron" aria-hidden="true">›</span></summary>
          <div className="bg-basicInfoFields bg-fundGrid">
            <p className="bg-basicInfoHint">名称后续随扫描更新；市场、地区、类型和标签由后台维护。</p>
            {BASIC_FIELDS.map((field) => (
              <FieldInput
                key={field.key}
                field={field}
                value={form[field.key] ?? ''}
                busy={busy}
                onChange={(key, value) => {
                  setForm((previous) => ({ ...previous, [key]: value }))
                  setError('')
                }}
              />
            ))}
          </div>
        </details>
        <div className="bg-amountEditor">
          {EDIT_FIELDS.map((field) => {
            const manual = manualFields.has(field.key)
            const autoValue = automaticValue(field.key)
            const value = manual ? form[field.key] : autoValue == null ? '' : String(autoValue)
            const statuses = [...new Set([...PURCHASE_STATUSES, fund.status, fund.auto_values?.status, form.status].filter(Boolean))]
            return (
              <div className="bg-amountField" key={field.key}>
                <div className="bg-amountFieldHead"><strong>{field.label}</strong>
                  <div className="bg-updateMode" role="group" aria-label={`${field.label}更新模式`}>
                    <button type="button" disabled={busy} aria-pressed={!manual} className={!manual ? 'is-active' : ''} onClick={() => changeMode(field.key, false)}>自动更新</button>
                    <button type="button" disabled={busy} aria-pressed={manual} className={manual ? 'is-active is-manual' : ''} onClick={() => changeMode(field.key, true)}>手动锁定</button>
                  </div>
                </div>
                {field.key === 'status' ? (
                  <label className="bg-purchaseStatusInput"><span className="bg-srOnly">申购状态</span>
                    <select aria-label="申购状态" className="bg-input" value={value} disabled={busy || !manual}
                      onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))}>
                      <option value="">{manual ? '请选择申购状态' : '待更新'}</option>
                      {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                ) : (
                  <label className="bg-amountInput"><span className="bg-srOnly">{field.label}</span>
                    <input aria-label={field.label} type="number" min="0" step="any" value={value} disabled={busy || !manual}
                      placeholder="待更新" onChange={(event) => setForm((previous) => ({ ...previous, [field.key]: event.target.value }))} />
                    <span>元 / 日</span>
                  </label>
                )}
                <div className="bg-amountFieldFoot">
                  <span>扫描值 {field.key === 'status' ? autoValue || '待更新' : formatAmount(autoValue)}</span>
                  <span>{manual ? '保存后扫描不覆盖' : '跟随每日扫描'}</span>
                </div>
              </div>
            )
          })}
        </div>
        <p className="bg-dialogHint">各项更新模式独立生效。额度留空表示未知，0 表示无可用额度。</p>
        {error ? <p className="bg-formError" role="alert">{error}</p> : null}
      </form>
    </FundDialog>
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
    <FundDialog onClose={onClose} busy={busy} title="删除基金">
      <div>
        <h2 className="bg-dialogTitle">删除基金</h2>
        <p className="bg-dialogHint">
          确定删除「{fund.name}（{fund.code}）」吗？删除后将退出前台展示与扫描名单，且不能被旧静态名单重新加入。
        </p>
        {error ? <p className="bg-formError">{error}</p> : null}
        <div className="bg-dialogActions">
          <button type="button" className="bg-btnGhost" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button type="button" className="bg-btnPrimary" disabled={busy} onClick={handleDelete}>
            {busy ? '删除中…' : '确认删除'}
          </button>
        </div>
      </div>
    </FundDialog>
  )
}

function Funds() {
  const [funds, setFunds] = useState([])
  const [status, setStatus] = useState('loading') // loading | error | ready
  const [market, setMarket] = useState('all')
  const [region, setRegion] = useState('')
  const [keyword, setKeyword] = useState('')
  const [opError, setOpError] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    setStatus('loading')
    setOpError('')
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

  const allRegions = useMemo(() => {
    const regions = new Set()
    for (const fund of funds) {
      if (market !== 'all' && fund.market !== market) continue
      const fundRegion = typeof fund.region === 'string' ? fund.region.trim() : ''
      if (fundRegion) regions.add(fundRegion)
    }
    return [...regions].sort(compareRegions)
  }, [funds, market])

  const counts = useMemo(() => {
    const c = { all: funds.length, us: 0, other: 0, cross: 0 }
    for (const f of funds) c[f.market] = (c[f.market] || 0) + 1
    return c
  }, [funds])

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return funds.filter((f) => {
      if (market !== 'all' && f.market !== market) return false
      if (region && (typeof f.region === 'string' ? f.region.trim() : '') !== region) return false
      if (kw && !f.code.includes(kw) && !f.name.toLowerCase().includes(kw)) return false
      return true
    })
  }, [funds, market, region, keyword])

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
    <div className="bg-fundsPage">
      <div className="bg-pageHead bg-fundsHead">
        <div><p className="bg-fundEyebrow">基金名册 · {funds.length} 只</p>
          <h1 className="bg-pageTitle">基金管理</h1>
          <p className="bg-fundIntro">{LOCKABLE_HINT}。</p>
        </div>
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
              aria-pressed={market === m.value}
              aria-expanded={m.value === 'other' ? market === 'other' : undefined}
              aria-controls={m.value === 'other' ? 'fund-region-options' : undefined}
              onClick={() => {
                setMarket(m.value)
                setRegion('')
              }}
            >
              {m.label}<span className="bg-filterCount">{counts[m.value] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="bg-fundTools">
          <input
            className="bg-input bg-fundSearch"
            value={keyword}
            aria-label="搜索基金"
            placeholder="搜索代码或名称"
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </div>

      {market === 'other' && (
        <div id="fund-region-options" className="bg-fundRegions" role="group" aria-label="其他市场地区分类">
          <button
            type="button"
            className={`bg-fundRegionBtn${region === '' ? ' is-active' : ''}`}
            aria-pressed={region === ''}
            onClick={() => setRegion('')}
          >全部地区</button>
          {allRegions.map((fundRegion) => {
            const display = getRegionDisplay(fundRegion)
            return (
              <button
                key={fundRegion}
                type="button"
                className={`bg-fundRegionBtn${region === fundRegion ? ' is-active' : ''}`}
                aria-pressed={region === fundRegion}
                onClick={() => setRegion(fundRegion)}
              >
                <span aria-hidden="true">{display.flag}</span> {display.name}
              </button>
            )
          })}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="bg-stateBox">
          <p>{funds.length === 0 ? '名册为空，点击右上角新增第一只基金' : '没有符合筛选条件的基金'}</p>
        </div>
      ) : (
        <div className="bg-tableWrap">
          <table className="bg-table bg-fundTable">
            <thead><tr>
              <th className="bg-fundIdentity">基金</th><th className="bg-fundColStatus">申购状态</th>
              <th className="bg-fundColAmount">直销额度 <span>元 / 日</span></th>
              <th className="bg-fundColAmount">代销额度 <span>元 / 日</span></th>
              <th className="bg-colOps">操作</th>
            </tr></thead>
            <tbody>{visible.map((fund) => (
              <tr key={fund.code}>
                <td className="bg-fundIdentity">
                  <strong className="bg-fundName">{fund.name}</strong>
                  <div className="bg-fundMeta"><span className="bg-mono">{fund.code}</span><span>{MARKET_LABEL[fund.market]} · {fund.region}</span><span>{fund.kind}</span></div>
                </td>
                <td><span className={`bg-status ${String(fund.status).includes('暂停') ? 'is-paused' : 'is-open'}`}>{fund.status || '待更新'}</span></td>
                {AMOUNT_FIELDS.map(({ key }) => <td className="bg-fundAmount" key={key}>
                  <strong>{formatAmount(fund[key])}</strong>
                  <span className={fund.locked_fields?.includes(key) ? 'bg-manualMark' : 'bg-autoMark'}>{fund.locked_fields?.includes(key) ? '人工设置' : '自动更新'}</span>
                </td>)}
                <td><div className="bg-rowOps">
                  <button type="button" className="bg-fundEditBtn" onClick={() => setEditing(fund)}>编辑基金</button>
                  <button type="button" className="bg-linkBtn is-danger" aria-label={`删除${fund.name}`} onClick={() => setDeleting(fund)}>删除</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <div className="bg-fundFooter"><span>显示 {visible.length} / {funds.length} 只基金</span><span>保存后刷新前台即可查看最新额度</span></div>

      {showNew ? (
        <NewFundDialog
          existingFunds={funds}
          onEditExisting={(fund) => { setShowNew(false); setEditing(fund) }}
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
