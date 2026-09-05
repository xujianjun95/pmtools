import { Link } from 'react-router-dom'
import { summarizeJourney } from '../../utils/dca'
import styles from './DcaSimulator.module.css'

// 返回值自带单位（元/万/亿），调用处不要再拼「 元」，避免「10.1 万 元」这类空隙。
const fmtMoney = (v) => {
  const n = Math.round(v ?? 0)
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)} 亿元`
  if (Math.abs(n) >= 1e5) return `${(n / 1e4).toFixed(1)} 万元`
  return `${n.toLocaleString('zh-CN')} 元`
}

// 拆解数：与 fmtMoney 同尺度但不含单位，用于「最终资产 = 投入 + 盈亏」括号展示。
// base 决定尺度（元/万/亿），保证两部分与总额同一量纲、相加吻合。
const fmtPart = (v, base) => {
  const scale = Math.abs(base ?? v ?? 0) >= 1e8 ? 1e8 : Math.abs(base ?? v ?? 0) >= 1e5 ? 1e4 : 1
  const n = (v ?? 0) / scale
  return scale === 1 ? Math.round(n).toLocaleString('zh-CN') : n.toFixed(1)
}

const fmtSigned = (v) => `${(v ?? 0) >= 0 ? '+' : '-'}${fmtMoney(Math.abs(v ?? 0))}`

const fmtPct = (v) => `${((v ?? 0) * 100).toFixed(1)}%`

function fmtYm(ym) {
  if (!ym) return '—'
  const [year, month] = ym.split('-')
  return `${year} 年 ${Number(month)} 月`
}

function fmtDuration(months) {
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years <= 0) return `${months} 个月`
  return rest ? `${years} 年 ${rest} 个月` : `${years} 年`
}

const ASSET_LABEL = { ndx: '纳斯达克100', spx: '标普500' }

// 旅程总结：终点历史答卷与返回 QDII 申购监控的入口。
export default function JourneySummary({ config, curve }) {
  const summary = summarizeJourney(curve)
  if (!summary) return null
  const selectedIndexKey = config.assetKey === 'ndx' ? 'nasdaq100' : 'sp500'
  const assetLabel = ASSET_LABEL[config.assetKey] ?? '对应指数'

  const totalProfit = summary.finalValue - summary.invested
  const totalRate = summary.invested > 0 ? totalProfit / summary.invested : 0
  const years = summary.months / 12
  // 年化：按「累计投入 → 最终资产」的复合年化近似（定投场景的资金占用介于其间，作参考视角）
  const annualRate = years > 0 && summary.invested > 0 && summary.finalValue > 0
    ? Math.pow(summary.finalValue / summary.invested, 1 / years) - 1
    : null
  const rateClass = (v) => (v >= 0 ? styles.pos : styles.neg)
  const fmtSignedPct = (v) => `${v >= 0 ? '+' : ''}${fmtPct(v)}`
  const perYuan = summary.invested > 0 ? summary.finalValue / summary.invested : 0
  const months = summary.months

  // 复利叙事：按旅程时长与收益幅度选话术，按比例取窗口长度，
  // 避免「3 年的旅程里谈最后 5 年」这种穿帮。
  const lastIdx = curve.length - 1
  const backN = Math.min(60, Math.max(6, Math.round(months * 0.3)))
  const backIdx = Math.max(0, lastIdx - backN)
  const profitLastN = totalProfit > 0 && curve.length > 1
    ? (curve[lastIdx].value - curve[backIdx].value) - (curve[lastIdx].invested - curve[backIdx].invested)
    : 0
  const lateShare = totalProfit > 0 ? Math.max(0, profitLastN) / totalProfit : 0
  const windowLabel = (() => {
    if (months < 12) return '最后几个月'
    const y = Math.round((backN / 12) * 10) / 10
    if (y < 1.5) return '最后这一年多'
    return `最后 ${y.toFixed(1).replace(/\.0$/, '')} 年`
  })()

  const compoundCopy = (() => {
    const body = fmtDuration(months)
    const yuan = perYuan.toFixed(1)
    if (totalProfit <= 0) {
      return {
        kicker: '时间还在路上',
        content: '这段旅程里，收益还没有长出来。但复利的规则从未改变：它只奖励在场足够久的人——时间不会辜负等待，它只是把回报攒在后面。',
      }
    }
    if (totalRate >= 1) {
      return {
        kicker: '复利的威力',
        content: `${body}的坚持，投入的每 1 元最终长成了 ${yuan} 元。${
          lateShare >= 0.5 ? `而超过一半的收益，来自${windowLabel}——前面所有的等待，都是在为最后一程蓄力。` : '收益在复利曲线里加速放大，'
        }时间，是这份旅程里最慷慨的合伙人。`,
      }
    }
    if (totalRate >= 0.2) {
      return {
        kicker: '时间的朋友',
        content: `${body}的复利，让每 1 元变成了 ${yuan} 元。${
          lateShare >= 0.5 ? `超过一半的收益来自${windowLabel}——` : '时间不会辜负等待，'
        }耐心，是这份计划里最划算的杠杆。`,
      }
    }
    return {
      kicker: '慢慢复利',
      content: `${body}的坚持，投入的每 1 元长成了 ${yuan} 元。收益正在慢慢攒出形状。时间从来不响，但它一直在场。`,
    }
  })()

  return (
    <section className={styles.summary} aria-labelledby="journey-summary-title">
      <span className="section-label">旅程总结</span>
      <h2 className={styles.summaryTitle} id="journey-summary-title">
        {fmtYm(summary.startYm)} — {fmtYm(summary.endYm)} · 坚持了 {fmtDuration(summary.months)}
      </h2>
      <p className={styles.summaryQuote}>
        回望这段旅程，不是为了预测下一次危机，而是理解长期投入真正需要承受什么。
      </p>

      <dl className={styles.summaryGrid}>
        <div>
          <dt>累计投入</dt>
          <dd>{fmtMoney(summary.invested)}</dd>
        </div>
        <div>
          <dt>最终账户资产</dt>
          <dd>
            {fmtMoney(summary.finalValue)}
            <span className={styles.summarySub}>
              （{fmtPart(summary.invested, summary.finalValue)}+{fmtPart(summary.finalValue - summary.invested, summary.finalValue)}）
            </span>
          </dd>
        </div>
        <div>
          <dt>累计盈亏</dt>
          <dd className={rateClass(totalProfit)}>{fmtSigned(totalProfit)}</dd>
        </div>
        <div>
          <dt>收益率</dt>
          <dd className={rateClass(totalRate)}>{fmtSignedPct(totalRate)}</dd>
        </div>
        <div>
          <dt>年化收益率</dt>
          <dd className={annualRate == null ? '' : rateClass(annualRate)}>
            {annualRate == null ? '—' : fmtSignedPct(annualRate)}
          </dd>
        </div>
        <div>
          <dt>最差浮盈亏</dt>
          <dd className={styles.neg}>{fmtSigned(summary.worstProfit)}</dd>
          <dd className={styles.summarySub}>最低时比例 {fmtPct(summary.worstProfitRate)}</dd>
        </div>
        <div>
          <dt>最长连续低于本金</dt>
          <dd>{summary.longestBelowPrincipalMonths} 个月</dd>
        </div>
      </dl>

      <div className={styles.compoundNote}>
        <span className={styles.compoundKicker}>{compoundCopy.kicker}</span>
        <p className={styles.compoundText}>{compoundCopy.content}</p>
      </div>

      <div className={styles.summaryActions}>
        <Link className={styles.primaryBtn} to={`/qdii?index=${selectedIndexKey}`}>
          查看当前可申购的 {assetLabel} QDII
        </Link>
      </div>
    </section>
  )
}
