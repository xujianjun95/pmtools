import { useEffect, useRef, useState } from 'react'
import { compactHistory, statusClass, statusRank } from '../utils'
import styles from './FundTable.module.css'

function HistoryTimeline({ fund }) {
  const pts = compactHistory(fund.history)
  // 倒序展示，最新在上；仅一个点时标注首日监控
  const items = [...pts].reverse()

  const limitText = (v) => (v > 0 ? `${Number(v).toLocaleString('zh-CN')} 元/日` : '无限额')

  // 暂停申购时天天基金会残留旧限额值，展示无意义
  const limitTextIfOpen = (h) =>
    String(h.status).includes('暂停') ? '—' : limitText(h.limit_amount)

  return (
    <div className={styles.timeline}>
      <div className={styles.tlTitle}>HISTORY · 变化节点</div>
      {items.map((h, i) => (
        <div key={h.date} className={`${styles.tlItem} ${i === 0 ? styles.latest : ''}`}>
          <span className={styles.tlDate}>{h.date}</span>
          <span className={styles.tlStatus}>{h.status}</span>
          <span className={styles.tlLimit}>{limitTextIfOpen(h)}</span>
          {i === 0 ? (
            items.length === 1 ? <span className={styles.tlTag}>首日监控</span> : <span className={styles.tlTag}>当前</span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export default function FundTable({ funds, rules }) {
  const [expanded, setExpanded] = useState(null)
  const tableRef = useRef(null)

  // 检测名称是否被截断：只有截断的才加 truncated 类（显示 hover tooltip）
  useEffect(() => {
    const check = () => {
      if (!tableRef.current) return
      tableRef.current.querySelectorAll('span[data-fullname]').forEach((el) => {
        const txt = el.firstElementChild
        if (!txt) return
        el.classList.toggle('trunc', txt.scrollWidth > txt.clientWidth)
      })
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [funds])

  const sorted = [...funds].sort((a, b) => {
    const ra = statusRank(a.status)
    const rb = statusRank(b.status)
    if (ra !== rb) return ra - rb
    // 暂停申购的残留限额不参与排序
    const la = String(a.status).includes('暂停') ? Infinity : a.limit_amount || Infinity
    const lb = String(b.status).includes('暂停') ? Infinity : b.limit_amount || Infinity
    return la - lb
  })

  const limitCell = (f) => {
    if (String(f.status).includes('暂停'))
      return (
        <span className={styles.unit} title="暂停申购，无限额信息">
          —
        </span>
      )
    const n = Number(f.limit_amount)
    if (!n || n <= 0) return <span className={styles.unit}>—</span>
    const txt = n >= 1e8 ? `${(n / 1e8).toFixed(0)} 亿` : n.toLocaleString('zh-CN')
    return (
      <>
        {txt} <span className={styles.unit}>元/日</span>
      </>
    )
  }

  return (
    <div className={styles.tableCard} ref={tableRef}>
      <table>
        <thead>
          <tr>
            <th>代码</th>
            <th>基金简称</th>
            <th>跟踪指数</th>
            <th>申购状态</th>
            <th>日累计限额</th>
            <th>年化跟踪误差</th>
            <th>手续费</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sorted.map((f) => {
            const isOpen = expanded === f.code
            return (
              [
                <tr
                  key={f.code}
                  className={`${styles.fundRow} ${isOpen ? styles.expanded : ''}`}
                  onClick={() => setExpanded(isOpen ? null : f.code)}
                >
                  <td className={styles.fcode} data-label="CODE">{f.code}</td>
                  <td className={styles.tname} data-label="基金简称">
                    <span className={styles.fname} data-fullname={f.name}>
                      <span className={styles.txt}>{f.name}</span>
                    </span>
                  </td>
                  <td>
                    <span className={styles.idxTag}>
                      {f.index_key === 'nasdaq100' ? 'NASDAQ 100' : 'S&P 500'}
                    </span>
                  </td>
                  <td className={styles.tstatus} data-label="申购状态">
                    <span className={`${styles.statusBadge} ${styles[statusClass(f.status)]}`}>
                      {f.status}
                    </span>
                  </td>
                  <td className={styles.tlimit} data-label="日累计限额">
                    <span className={styles.limitCell}>{limitCell(f)}</span>
                  </td>
                  <td className={styles.tte} data-label="跟踪误差">
                    <span className={styles.limitCell}>
                      {f.tracking_error != null ? (
                        <>
                          {f.tracking_error.toFixed(2)}
                          <span className={styles.unit}>%</span>
                        </>
                      ) : (
                        <span className={styles.unit} title="天天基金暂未提供该基金的跟踪误差（如 FOF）">
                          —
                        </span>
                      )}
                    </span>
                  </td>
                  <td className={styles.tfee} data-label="手续费">
                    <span className={styles.limitCell}>
                      {f.fee > 0 ? (
                        <>
                          {f.fee.toFixed(2)}
                          <span className={styles.unit}>%</span>
                        </>
                      ) : (
                        '免'
                      )}
                    </span>
                  </td>
                  <td className={styles.tchev}>
                    <span className={`${styles.chev} ${isOpen ? styles.chevOpen : ''}`}>▶</span>
                  </td>
                </tr>,
                <tr key={`${f.code}-hist`} className={styles.historyRow} hidden={!isOpen}>
                  <td colSpan={8}>
                    <div className={`${styles.historyInner} ${isOpen ? styles.open : ''}`}>
                      <div className={styles.historyClip}>
                        <HistoryTimeline fund={f} />
                      </div>
                    </div>
                  </td>
                </tr>,
              ]
            )
          })}
        </tbody>
      </table>
      {!sorted.length && <div className={styles.noResult}>没有符合条件的基金</div>}
      {!!sorted.length && (
        <div className={styles.legend}>
          <span>— 暂停申购（无限额信息）或暂无数据</span>
          <span className={styles.legendSource}>数据来源：天天基金</span>
        </div>
      )}
    </div>
  )
}
