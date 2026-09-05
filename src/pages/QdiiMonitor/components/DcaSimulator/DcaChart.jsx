import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import styles from './DcaSimulator.module.css'

const W = 1200
const H = 280
const PAD = { l: 58, r: 16, t: 24, b: 30 }

function fmtAxis(v) {
  if (v >= 10000) {
    const n = (v / 10000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, '')
    return `${n}万`
  }
  return `${Math.round(v)}`
}

// 摄像机式纵轴：可见数据的量级决定 Y 轴跨度（取「最近档位」×4）。
// 钱少时轴放大贴着曲线，涨上去后整轴拉远；档位切换用 rAF 缓动过渡。
function niceStepFor(max) {
  const raw = Math.max(1, max) / 4
  const pow = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 2.5, 5, 10]) {
    const step = m * pow
    if (step * 4 >= max) return step
  }
  return 10 * pow
}

function fmtAxisTick(v) {
  return v >= 10000 ? fmtAxis(v) : Math.round(v).toLocaleString('zh-CN')
}

// 渐进式折线图：只绘制已播放到 cursor 的月份，未来月份不显示。
export default function DcaChart({ curve, cursor, playing, frameDelay, reducedMotion, events, onReviewEvent }) {
  // 可见窗口内的资产/投入最大值 → 目标纵轴档位
  const targetMax = useMemo(() => {
    let m = 1
    const upto = Math.min(cursor, curve.length - 1)
    for (let i = 0; i <= upto; i += 1) {
      m = Math.max(m, curve[i].value, curve[i].invested)
    }
    return m * 1.06
  }, [curve, cursor])

  const targetStep = useMemo(() => niceStepFor(targetMax), [targetMax])
  const targetViewMax = targetStep * 4

  const [viewMax, setViewMax] = useState(() => targetStep * 4)
  const viewMaxRef = useRef(viewMax)

  // 档位变化时缓动过渡，像镜头拉远/推近
  useEffect(() => {
    const from = viewMaxRef.current
    if (Math.abs(from - targetViewMax) < 1) return undefined
    let rafId
    const t0 = performance.now()
    const duration = 340
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration)
      const eased = 1 - (1 - t) ** 3
      const v = from + (targetViewMax - from) * eased
      viewMaxRef.current = v
      setViewMax(v)
      if (t < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [targetViewMax])

  const geo = useMemo(() => {
    if (!curve.length || !viewMax) return null
    const iw = W - PAD.l - PAD.r
    const ih = H - PAD.t - PAD.b
    const x = (i) => PAD.l + (curve.length === 1 ? iw / 2 : (i / (curve.length - 1)) * iw)
    const y = (v) => PAD.t + ih - (Math.max(0, v) / viewMax) * ih
    const line = (points, get) =>
      points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(get(p)).toFixed(1)}`)
        .join(' ')
    // 横轴年份标注：放在每一年区间的中点（不再贴着左边缘），超密时抽稀；
    // 首尾标注向内收，避免悬挂到绘图区外。
    const yearMarks = []
    curve.forEach((p, i) => {
      if (p.ym.endsWith('-01')) yearMarks.push({ i, label: p.ym.slice(0, 4) })
    })
    if (yearMarks.length === 0 || curve[0].ym.slice(0, 4) !== yearMarks[0].label) {
      yearMarks.unshift({ i: 0, label: curve[0].ym.slice(0, 4) })
    }
    const step = Math.max(1, Math.ceil(yearMarks.length / 9))
    const xticks = []
    yearMarks.forEach((t, k) => {
      if (k % step !== 0) return
      const next = yearMarks[k + 1]
      const endIdx = next ? next.i : curve.length - 1
      const midX = Math.min(W - PAD.r - 24, Math.max(PAD.l + 24, x((t.i + endIdx) / 2)))
      xticks.push({ label: t.label, x: midX })
    })
    const yticks = [1, 2, 3, 4].map((k) => {
      const v = k * (viewMax / 4)
      return { v, label: fmtAxisTick(v), y: y(v) }
    })
    return { x, y, line, xticks, yticks }
  }, [curve, viewMax])

  const visibleCurve = useMemo(() => curve.slice(0, cursor + 1), [curve, cursor])
  const dInvested = useMemo(() => (geo ? geo.line(visibleCurve, (p) => p.invested) : ''), [geo, visibleCurve])
  const dValue = useMemo(() => (geo ? geo.line(visibleCurve, (p) => p.value) : ''), [geo, visibleCurve])

  // 事件标点：只放已播放到的事件月，点击回调给宿主打开回顾弹窗
  const markers = useMemo(() => {
    if (!geo || !events.length) return []
    const idxOfYm = new Map(curve.map((point, index) => [point.ym, index]))
    return events
      .map((event) => ({ event, index: idxOfYm.get(event.startYm) }))
      .filter((item) => item.index != null && item.index <= cursor)
  }, [curve, events, cursor, geo])

  const dotValueRef = useRef(null)
  const dotInvestedRef = useRef(null)
  const tipValueRef = useRef(null)
  const tipInvestedRef = useRef(null)
  // 滑行时钟：key（月份/播放态/动效偏好）变化才重置起点。
  // 之前用独立的 useEffect 写时间戳，但 useLayoutEffect 先于它执行，会拿到上个月的旧起点，
  // 导致 t≥1 瞬移、只在轴缩放重建 geo 时碰巧读到新值——形成「缩放流畅、平段卡」的周期性抖动。
  const glideRef = useRef({ key: '', start: 0 })

  useLayoutEffect(() => {
    if (!geo) return undefined
    const from = curve[cursor]
    if (!from) return undefined
    const to = curve[cursor + 1]
    const glideKey = `${cursor}:${playing}:${reducedMotion}`
    if (glideRef.current.key !== glideKey) {
      glideRef.current = { key: glideKey, start: performance.now() }
    }
    const start = glideRef.current.start
    const x0 = geo.x(cursor)
    const yv0 = geo.y(from.value)
    const yi0 = geo.y(from.invested)
    const x1 = to ? geo.x(cursor + 1) : x0
    const yv1 = to ? geo.y(to.value) : yv0
    const yi1 = to ? geo.y(to.invested) : yi0
    const place = (t) => {
      const x = x0 + (x1 - x0) * t
      const yv = yv0 + (yv1 - yv0) * t
      const yi = yi0 + (yi1 - yi0) * t
      dotValueRef.current?.setAttribute('cx', x.toFixed(1))
      dotValueRef.current?.setAttribute('cy', yv.toFixed(1))
      dotInvestedRef.current?.setAttribute('cx', x.toFixed(1))
      dotInvestedRef.current?.setAttribute('cy', yi.toFixed(1))
      // 尖端延伸段：折线随游标连续生长，而不是逐月跳格
      const growing = t > 0.002
      tipValueRef.current?.setAttribute('d', growing ? `M${x0.toFixed(1)},${yv0.toFixed(1)} L${x.toFixed(1)},${yv.toFixed(1)}` : '')
      tipInvestedRef.current?.setAttribute('d', growing ? `M${x0.toFixed(1)},${yi0.toFixed(1)} L${x.toFixed(1)},${yi.toFixed(1)}` : '')
    }
    place(0)
    if (!playing || reducedMotion || !to) return undefined
    let rafId
    const step = (now) => {
      const t = Math.min(1, (now - start) / Math.max(1, frameDelay))
      place(t)
      if (t < 1) rafId = requestAnimationFrame(step)
    }
    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [geo, curve, cursor, playing, frameDelay, reducedMotion])

  if (!geo) return null

  return (
    <div className={styles.chartWrap}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="历史定投旅程折线图"
      >
        {geo.yticks.map((t, k) => (
          <g key={`${t.label}-${k}`}>
            <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} className={styles.grid} />
            <text x={PAD.l - 8} y={t.y + 4} textAnchor="end" className={styles.tick}>
              {t.label}
            </text>
          </g>
        ))}
        {geo.xticks.map((t, k) => (
          <text key={k} x={t.x} y={H - 8} textAnchor="middle" className={styles.tick}>
            {t.label}
          </text>
        ))}
        <path d={dInvested} className={`${styles.line} ${styles.lineInvested}`} />
        <path d={dValue} className={`${styles.line} ${styles.lineValue}`} />
        {/* 游标尖端延伸段：播放中逐帧生长，保证折线连续绘制 */}
        <path ref={tipInvestedRef} className={`${styles.line} ${styles.lineInvested}`} />
        <path ref={tipValueRef} className={`${styles.line} ${styles.lineValue}`} />
        {markers.map(({ event, index }) => (
          <circle
            key={event.id}
            cx={geo.x(index)}
            cy={geo.y(curve[index].value)}
            r={5}
            className={styles.eventMarker}
            role="button"
            tabIndex={0}
            aria-label={`回顾事件：${event.title}`}
            onClick={() => onReviewEvent?.(event.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onReviewEvent?.(event.id)
            }}
          />
        ))}
        <circle ref={dotValueRef} r={4.5} className={styles.dotValue} />
        <circle ref={dotInvestedRef} r={3} className={styles.dotInvested} />
      </svg>
      <div className={styles.legend}>
        <span>
          <i className={`${styles.sw} ${styles.swValue}`} /> 账户资产
        </span>
        <span>
          <i className={`${styles.sw} ${styles.swInvested}`} /> 累计投入
        </span>
      </div>
    </div>
  )
}
