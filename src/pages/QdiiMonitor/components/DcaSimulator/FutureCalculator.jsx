import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DcaChart from './DcaChart'
import { createCompoundRun, planWithdrawal } from '../../utils/compoundEngine'
import { SPX_DIV_DEFAULT } from '../../utils/dca'
import { calibrateReturnModel, createFutureAnchor, FUTURE_ASSETS, randomSeed } from '../../utils/scenarioEngine'
import styles from './FutureCalculator.module.css'
import pageStyles from '../../../DcaPage/DcaPage.module.css'

const money = (value) => `¥${Math.round(value).toLocaleString('zh-CN')}`
const numeric = (text) => text.trim() === '' ? NaN : Number(text)

// 取用时长的可读格式。
const formatDuration = (months) => {
  if (months < 1) return '不足 1 个月'
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return `${rest} 个月`
  return rest === 0 ? `${years} 年` : `${years} 年 ${rest} 个月`
}

// 年化收益率输入：小数最多保留两位（输入与粘贴一致），科学计数等杂字符直接裁掉。
const trimRateInput = (text) => {
  const prefix = text.match(/^-?\d*(?:\.\d{0,2})?/)
  return prefix ? prefix[0] : ''
}

const INVESTMENT_MODES = [{ key: 'lumpSum', label: '一次性买入' }, { key: 'monthly', label: '按月定投' }]

// 分段选择器：白色滑块由 CSS 变量驱动平移，切换选项时平滑滑到目标位置。
function Segments({ options, value, onChange, labelledBy }) {
  const index = Math.max(0, options.findIndex(option => option.key === value))
  return (
    <div className={styles.segments} role="group" aria-labelledby={labelledBy}>
      <span className={styles.thumb} aria-hidden="true" style={{ '--seg-count': options.length, '--seg-index': index }} />
      {options.map(option => (
        <button key={option.key} type="button" aria-pressed={value === option.key} className={value === option.key ? styles.selected : ''} onClick={() => onChange(option.key)}>{option.label}</button>
      ))}
    </div>
  )
}

export default function FutureCalculator() {
  const navigate = useNavigate()
  const [investmentMode, setInvestmentMode] = useState('lumpSum')
  const [principalText, setPrincipalText] = useState('100000')
  const [initialText, setInitialText] = useState('0')
  const [monthlyText, setMonthlyText] = useState('1000')
  const [annualText, setAnnualText] = useState('')
  const [years, setYears] = useState(20)
  const [includeDrawdowns, setIncludeDrawdowns] = useState(false)
  const [assetKey, setAssetKey] = useState('ndx')
  const [rateRefKey, setRateRefKey] = useState(null)
  const [withdrawText, setWithdrawText] = useState('10000')
  const [historyState, setHistoryState] = useState({ status: 'loading', payload: null, models: [], error: null })
  const [historyAttempt, setHistoryAttempt] = useState(0)
  const [run, setRun] = useState(null)
  const [phase, setPhase] = useState('idle')
  const [cursor, setCursor] = useState(0)
  const [error, setError] = useState(null)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const cursorRef = useRef(0)
  const runRef = useRef(null)
  const resultRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = window.setTimeout(() => controller.abort(), 10000)
    const load = async () => {
      try {
        const response = await fetch('/qdii/simulation-data.json', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error(`历史行情 HTTP ${response.status}`)
        const payload = await response.json()
        const asOf = createFutureAnchor({ initialAssets: 0, monthlyAmount: 1 }).ym
        const models = FUTURE_ASSETS.map(asset => calibrateReturnModel(payload, asset.key, asOf))
        if (active) setHistoryState({ status: 'ready', payload, models, error: null })
      } catch (cause) {
        if (active) setHistoryState({ status: 'error', payload: null, models: [], error: cause.name === 'AbortError' ? '历史参考加载超时' : '历史参考暂不可用' })
      } finally { window.clearTimeout(timeout) }
    }
    load()
    return () => { active = false; controller.abort(); window.clearTimeout(timeout) }
  }, [historyAttempt])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReducedMotion(query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])

  const lastIndex = run ? run.curve.length - 1 : 0
  const frameDelay = (reducedMotion ? 1500 : 12000) / Math.max(1, lastIndex)
  useEffect(() => {
    if (phase !== 'playing' || !run) return undefined
    const from = cursorRef.current
    const start = performance.now()
    let rafId
    const tick = (now) => {
      // 帧内迟到注册的 rAF 可能拿到早于 start 的帧时间戳（now - start 为负），
      // 直接相除会让步进算出负数、游标越界（-1）导致渲染崩溃；这里夹到 0。
      const elapsed = Math.max(0, now - start)
      const next = Math.min(lastIndex, from + Math.floor(elapsed / frameDelay))
      cursorRef.current = next
      setCursor(next)
      if (next >= lastIndex) setPhase('done')
      else rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [phase, run, lastIndex, frameDelay])

  useEffect(() => {
    const pause = () => { if (document.hidden) setPhase(current => current === 'playing' ? 'paused' : current) }
    document.addEventListener('visibilitychange', pause)
    return () => document.removeEventListener('visibilitychange', pause)
  }, [])

  useEffect(() => {
    if (run) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      resultRef.current?.focus({ preventScroll: true })
    }
  }, [run])

  const initialAssets = numeric(investmentMode === 'lumpSum' ? principalText : initialText)
  const monthlyAmount = numeric(monthlyText)
  const annualPercent = numeric(annualText)
  const validPrincipal = Number.isSafeInteger(initialAssets) && initialAssets >= (investmentMode === 'lumpSum' ? 1 : 0)
  const validMonthly = Number.isSafeInteger(monthlyAmount) && monthlyAmount >= 1 && monthlyAmount <= 100000
  const validRate = Number.isFinite(annualPercent) && annualPercent >= -99 && annualPercent <= 100
  const valid = validPrincipal && (investmentMode === 'lumpSum' || validMonthly) && validRate

  // 超出两位小数的输入就地裁掉并回写；中间态（如 "23."）保持不动。
  const updateRate = (event) => {
    const next = event.target.value
    const fixed = trimRateInput(next)
    if (fixed !== next) event.target.value = fixed
    setAnnualText(fixed)
  }

  const start = (event) => {
    event.preventDefault()
    if (!valid || runRef.current || (includeDrawdowns && historyState.status !== 'ready')) return
    try {
      const nextRun = createCompoundRun({ investmentMode, initialAssets, monthlyAmount, years, annualRate: annualPercent / 100, includeDrawdowns, assetKey }, historyState.payload, includeDrawdowns ? randomSeed() : 0)
      runRef.current = nextRun
      cursorRef.current = 0
      setCursor(0)
      setError(null)
      setRun(nextRun)
      setPhase('playing')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '测算生成失败，请重试') }
  }
  const reset = () => {
    runRef.current = null
    setRun(null)
    setPhase('idle')
    cursorRef.current = 0
    setCursor(0)
    setError(null)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  // 结果态先退回表单（保留填写内容）；表单态再退回来源页，无来源时回监控页。
  const goBack = () => {
    if (run) { reset(); return }
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate('/qdii')
  }
  const replay = () => { cursorRef.current = 0; setCursor(0); setPhase('playing') }
  const regenerate = () => {
    try {
      const nextRun = createCompoundRun(run.config, historyState.payload, randomSeed())
      runRef.current = nextRun
      cursorRef.current = 0
      setCursor(0)
      setRun(nextRun)
      setError(null)
      setPhase('playing')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '测算生成失败，请重试') }
  }
  // 游标兜底夹取：任何异常值都不至于把渲染打崩（整页白屏）。
  const currentIndex = run ? Math.min(Math.max(Number.isFinite(cursor) ? cursor : 0, 0), run.curve.length - 1) : 0
  const current = run?.curve[currentIndex]
  const done = phase === 'done'

  // 取用测算：以期末资产为基数，余额按设定年化继续复利，看每月取用能撑多久。
  const withdrawal = useMemo(() => {
    if (!run) return null
    const amount = numeric(withdrawText)
    if (!Number.isSafeInteger(amount) || amount < 1) return null
    try {
      return planWithdrawal({ initialAssets: run.curve[run.curve.length - 1].value, monthlyWithdrawal: amount, annualRate: run.config.annualRate })
    } catch { return null }
  }, [run, withdrawText])

  return (
    <>
      <button type="button" onClick={goBack} className={pageStyles.back}>← 返回</button>
      <section className={styles.section} aria-label="知来 · 复利测算">
      <span className="section-label">知来</span>
      {!run ? (
        <form onSubmit={start} noValidate className={styles.setup}>
          <h1 className={styles.title}>未来有很多种走法</h1>
          <p className={styles.description}>设定投入、年限和预期年化收益率，看看本金如何随时间积累，复利如何生长。</p>
          <div className={styles.fields}>
            <div className={`${styles.field} ${styles.fullWidth} ${styles.modeField}`}>
              <span className={styles.label} id="compound-mode-label">投入方式</span>
              <Segments options={INVESTMENT_MODES} value={investmentMode} onChange={setInvestmentMode} labelledBy="compound-mode-label" />
              <p className={styles.hint}>{investmentMode === 'lumpSum' ? '全部本金在期初一次投入，之后持续持有。' : '初始本金在期初投入，每月定投在月末加入。'}</p>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="compound-principal">{investmentMode === 'lumpSum' ? '计划投入本金' : '初始本金'}</label>
              <div className={styles.inputWrap}><input id="compound-principal" type="number" min={investmentMode === 'lumpSum' ? 1 : 0} step="1" value={investmentMode === 'lumpSum' ? principalText : initialText} aria-invalid={!validPrincipal} onChange={event => (investmentMode === 'lumpSum' ? setPrincipalText : setInitialText)(event.target.value)} /><span>元</span></div>
              {!validPrincipal && <p className={styles.fieldError}>请输入{investmentMode === 'lumpSum' ? '大于 0' : '非负'}的整数本金。</p>}
            </div>
            {investmentMode === 'monthly' && <div className={styles.field}>
              <label className={styles.label} htmlFor="compound-monthly">每月投入</label>
              <div className={styles.inputWrap}><input id="compound-monthly" type="number" min="1" max="100000" step="1" value={monthlyText} aria-invalid={!validMonthly} onChange={event => setMonthlyText(event.target.value)} /><span>元/月</span></div>
              {!validMonthly && <p className={styles.fieldError}>每月投入为 1 至 100,000 元的整数。</p>}
            </div>}
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <div className={styles.rangeHeader}><label className={styles.label} htmlFor="compound-years">投资年限</label><output htmlFor="compound-years">{years}<span>年</span></output></div>
              <div className={styles.rangeWrap}>
                <input className={styles.range} id="compound-years" type="range" min="1" max="50" step="1" value={years} style={{ '--p': `${((years - 1) / 49) * 100}%` }} onChange={event => setYears(Number(event.target.value))} />
                <div className={styles.rangeTicks} aria-hidden="true">
                  {[1, 10, 20, 30, 40, 50].map(value => <span key={value} style={{ left: `calc((100% - 18px) * ${(value - 1) / 49} + 9px)` }} />)}
                </div>
              </div>
              <div className={styles.rangeEnds}><span>1 年</span><span>50 年</span></div>
            </div>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label} htmlFor="compound-rate">预期年化收益率</label>
              <div className={styles.inputWrap}><input id="compound-rate" type="number" min="-99" max="100" step="0.01" placeholder="手动填写，或点击下方历史参考" value={annualText} aria-invalid={annualText !== '' && !validRate} aria-describedby="compound-rate-hint" onChange={updateRate} /><span>%</span></div>
              {annualText !== '' && !validRate && <p id="compound-rate-hint" className={styles.fieldError}>请输入 -99 至 100 之间的数字。</p>}
              <div className={styles.referenceHeader}><span>历史年化参考 · 人民币口径</span><span>点击带入</span></div>
              {historyState.status === 'loading' && <p className={styles.hint} role="status">正在加载历史参考…</p>}
              {historyState.status === 'error' && <p className={styles.hint} role="status">{historyState.error}。手动填写仍可计算。<button type="button" className={styles.textButton} onClick={() => { setHistoryState({ status: 'loading', payload: null, models: [], error: null }); setHistoryAttempt(attempt => attempt + 1) }}>重新加载</button></p>}
              <div className={styles.references}>{historyState.models.map(model => <button key={model.assetKey} type="button" aria-label={`使用${model.assetLabel}历史年化`} aria-pressed={rateRefKey === model.assetKey} className={rateRefKey === model.assetKey ? styles.selected : ''} onClick={() => { setAnnualText((model.annualReturn * 100).toFixed(2)); setAssetKey(model.assetKey); setRateRefKey(model.assetKey) }}>
                <span>{model.assetLabel}</span><strong>{(model.annualReturn * 100).toFixed(2)}%</strong><small>{model.startYm} — {model.endYm}</small>
              </button>)}</div>
            </div>
            <div className={`${styles.field} ${styles.fullWidth} ${styles.randomOption}`}>
              <label className={styles.checkLabel}><input type="checkbox" checked={includeDrawdowns} onChange={event => setIncludeDrawdowns(event.target.checked)} />加入随机回撤</label>
              <p className={styles.hint}>{includeDrawdowns ? '加入历史波动，曲线自动播放并标记大幅回撤，最终结果随路径变化。' : '按设定年化收益率生成平滑复利曲线。'}</p>
              {includeDrawdowns && <div className={styles.field}><span className={styles.label} id="compound-volatility-label">波动参考</span><Segments options={FUTURE_ASSETS} value={assetKey} onChange={setAssetKey} labelledBy="compound-volatility-label" /></div>}
            </div>
          </div>
          {error && <p className={styles.fieldError} role="alert">{error}</p>}
          <button className={styles.primaryButton} type="submit" disabled={!valid || (includeDrawdowns && historyState.status !== 'ready')}>开始测算</button>
          <details className={styles.method}><summary>历史参考与计算口径</summary><p>沿用现有知来历史样本：纳斯达克 100 使用 QQQ 月线代理；标普 500 使用价格月线加年化 {((historyState.payload?.dividend_assumption?.spx_annual ?? SPX_DIV_DEFAULT) * 100).toFixed(2)}% 的股息近似。均包含历史美元兑人民币变化，排除当前未完成月份。</p><p>年化收益率按复合收益折算为月收益；月投在月末加入。不计费用，输入金额与结果均以人民币计。</p></details>
        </form>
      ) : (
        <div className={styles.result}>
          <h1 className={styles.resultTitle} ref={resultRef} tabIndex={-1}>{run.config.investmentMode === 'lumpSum' ? `一次性投入 ${money(run.config.initialAssets)}` : `每月定投 ${money(run.config.monthlyAmount)}`}，持续 {run.config.years} 年</h1>
          <p className={styles.hint}>设定年化 {(run.config.annualRate * 100).toFixed(2)}%{run.config.includeDrawdowns ? ` · 随机波动参考 ${run.reference.assetLabel}` : ' · 平滑复利'}</p>
          <div className={styles.total}><span>{done ? (run.config.includeDrawdowns ? '模拟期末资产' : '预计期末资产') : '当前模拟资产'}</span><strong data-testid="compound-value">{money(current.value)}</strong></div>
          <dl className={styles.stats}><div><dt>投入本金</dt><dd>{money(current.invested)}</dd></div><div><dt>累计收益</dt><dd className={current.profit >= 0 ? styles.positive : styles.negative}>{money(current.profit)}</dd></div><div><dt>本金倍数</dt><dd>{current.invested ? `${(current.value / current.invested).toFixed(2)} 倍` : '—'}</dd></div>{run.config.includeDrawdowns && <div><dt>已历大幅回撤</dt><dd>{run.events.filter(item => item.index <= cursor).length} 次</dd></div>}</dl>
          <div className={styles.chartCard}><div className={styles.chartHeading}><h2>资产增长趋势</h2><span>第 {(cursor / 12).toFixed(1)} 年 / {run.config.years} 年</span></div>
            <DcaChart key={run.seed} curve={run.curve} cursor={cursor} playing={phase === 'playing'} frameDelay={frameDelay} reducedMotion={reducedMotion} events={[]} drawdowns={run.events} showArea responsive ariaLabel="复利资产增长趋势图" />
            <div className={styles.progress} role="progressbar" aria-label="测算进度" aria-valuemin={0} aria-valuemax={lastIndex} aria-valuenow={cursor}><span style={{ width: `${cursor / lastIndex * 100}%` }} /></div>
          </div>
          <div className={styles.actions}>
            {phase !== 'done' && <button type="button" className={styles.primaryButton} onClick={() => setPhase(phase === 'playing' ? 'paused' : 'playing')}>{phase === 'playing' ? '暂停' : '继续'}</button>}
            {done && <button type="button" className={styles.primaryButton} onClick={replay}>重新播放</button>}
            {done && run.config.includeDrawdowns && <button type="button" className={styles.secondaryButton} onClick={regenerate}>重新生成路径</button>}
            <button type="button" className={styles.secondaryButton} onClick={reset}>重新设置</button>
            <span className={styles.hint} role="status">{phase === 'done' ? '测算完成' : phase === 'paused' ? '已暂停' : '正在测算…'}</span>
          </div>
          {error && <p className={styles.fieldError} role="alert">{error}</p>}
          {run.config.includeDrawdowns && <p className={styles.hint}>大幅回撤按模拟市场较前高下跌至少 20% 识别，同一轮下跌只计一次。参考样本 {run.reference.startYm} — {run.reference.endYm}；较长年限属于历史样本外推，回撤不保证发生或恢复。</p>}
          <div className={styles.withdrawCard}>
            <div className={styles.chartHeading}><h2>取用测算</h2><span>余额继续复利</span></div>
            <div className={styles.withdrawRow}>
              <label className={styles.label} htmlFor="compound-withdraw">每月取用</label>
              <div className={styles.inputWrap}><input id="compound-withdraw" type="number" min="1" step="1" value={withdrawText} onChange={event => setWithdrawText(event.target.value)} /><span>元/月</span></div>
            </div>
            {withdrawal ? (withdrawal.perpetual
              ? <p className={styles.withdrawResult}><strong>花不完</strong> —— 每月取用低于 {money(withdrawal.threshold)} 时，光靠增值就够花，本金不降。</p>
              : withdrawal.months >= 1200
                ? <p className={styles.withdrawResult}><strong>超过 100 年</strong></p>
                : <p className={styles.withdrawResult}>预计可支撑 <strong>{formatDuration(withdrawal.months)}</strong></p>)
              : <p className={styles.hint}>填写不小于 1 元的整数金额。</p>}
          </div>
        </div>
      )}
      <p className={styles.foot}>按设定参数计算的理论情景，不代表未来实际收益。人民币口径，未扣除费用。</p>
    </section>
    </>
  )
}
