import { useEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { compactHistory, statusClass, statusLabel } from '../utils'
import styles from './FundTable.module.css'

gsap.registerPlugin(useGSAP)

const formatPercentage = (value) => {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return `${Number(value).toFixed(2)}%`
}

function FundDetails({ fund }) {
  const details = [
    { label: '近 1 月收益率', value: formatPercentage(fund.return_1m) },
    { label: '近 6 月收益率', value: formatPercentage(fund.return_6m) },
    { label: '近 1 年收益率', value: formatPercentage(fund.return_1y) },
    { label: '成立以来收益率', value: formatPercentage(fund.return_since) },
    { label: '成立日', value: fund.inception_date || '—' },
    {
      label: '基金规模',
      value:
        fund.fund_size == null || !Number.isFinite(Number(fund.fund_size))
          ? '—'
          : `${Number(fund.fund_size).toFixed(2)} 亿元`,
      meta: fund.fund_size_date ? `截至 ${fund.fund_size_date}` : null,
    },
  ]

  return (
    <div className={styles.details}>
      <div className={styles.detailsTitle}>OVERVIEW · 基金概况</div>
      <dl className={styles.detailsGrid}>
        {details.map((item) => (
          <div key={item.label} className={styles.detailItem}>
            <dt>{item.label}</dt>
            <dd>
              <span className={styles.detailValue}>{item.value}</span>
              {item.meta && <span className={styles.detailMeta}>{item.meta}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

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
          <span className={styles.tlStatus}>{statusLabel(h.status)}</span>
          <span className={styles.tlLimit}>{limitTextIfOpen(h)}</span>
          {i === 0 ? (
            items.length === 1 ? <span className={styles.tlTag}>首日监控</span> : <span className={styles.tlTag}>当前</span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function SortDirectionIcon({ direction }) {
  return (
    <svg
      className={`${styles.sortIcon} ${direction === 'desc' ? styles.sortIconDown : ''}`}
      viewBox="0 0 1024 1024"
      aria-hidden="true"
    >
      <path
        d="M547.328 296.661333l207.786667 200.448a17.578667 17.578667 0 0 0 24.405333 0l25.941333-25.173333a17.066667 17.066667 0 0 0 0-24.576l-281.258666-271.786667a17.578667 17.578667 0 0 0-24.405334 0l-281.258666 271.786667a17.066667 17.066667 0 0 0 0 24.576l25.941333 25.173333a17.578667 17.578667 0 0 0 24.448 0l207.786667-200.448v539.434667c0 9.514667 7.765333 17.237333 17.408 17.237333h35.754666c9.642667 0 17.450667-7.68 17.450667-17.237333V296.661333z"
        stroke="currentColor"
        strokeWidth="44"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SortIdleIcon() {
  return (
    <svg className={styles.sortIconIdle} viewBox="0 0 1024 1024" aria-hidden="true">
      <path d="M407.568 154.019c-11.952-11.925-26.904-17.894-41.853-17.894-5.972 0-11.952 2.984-17.929 2.984h-2.992c-8.964 5.961-14.94 11.941-20.921 17.902L81.77 398.634c-23.912 23.862-23.912 59.669 0 80.551 11.956 11.929 26.901 17.894 41.841 17.894 14.948 0 29.896-5.965 41.845-17.894l146.459-146.177v495.198c0 32.815 26.908 56.677 56.797 56.677 29.892 0 56.789-26.854 56.789-56.677V198.775c-0.001-14.925-5.973-32.819-17.933-44.756zM942.59 541.831c-11.956-11.941-26.904-17.905-41.849-17.905-14.944 0-29.889 5.965-41.845 17.905L709.45 690.977V195.791c0-32.819-26.901-56.681-56.785-56.681-29.892 0-56.797 26.85-56.797 56.681v635.391c0 32.811 26.904 56.693 56.797 56.693 14.944 0 29.885-5.98 41.841-17.905l245.097-244.615c26.896-23.859 26.896-59.658 2.987-83.524z" />
    </svg>
  )
}

export default function FundTable({ funds, filterVersion }) {
  const [expanded, setExpanded] = useState(null)
  const [sortConfig, setSortConfig] = useState({ key: 'limit_amount', direction: 'desc' })
  const tableRef = useRef(null)

  const handleSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }))
  }

  // 筛选切换后：收起展开行，并让新行逐行淡入
  useGSAP(
    () => {
      if (!filterVersion) return
      setExpanded(null)
      const rows = tableRef.current?.querySelectorAll(`.${styles.fundRow}`)
      if (rows?.length) {
        gsap.from(rows, {
          opacity: 0,
          y: 12,
          duration: 0.4,
          stagger: 0.015,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
        })
      }
    },
    { dependencies: [filterVersion], scope: tableRef }
  )

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

  // 公司名 = 名称开头连续中文去掉「纳斯达克/纳指/标普」后缀，如「广发纳斯达克…」→「广发」
  const companyOf = (name) =>
    (name.match(/^([\u4e00-\u9fa5]+)/)?.[1] || '').replace(
      /(纳斯达克|纳指|标普)/g,
      ''
    )

  const sortValue = (fund) => {
    if (sortConfig.key === 'limit_amount') {
      // 暂停申购或无有效限额时页面显示为“—”，排序时固定沉底
      if (String(fund.status).includes('暂停')) return null
      const limit = Number(fund.limit_amount)
      return limit > 0 ? limit : null
    }
    if (sortConfig.key === 'tracking_error') {
      return fund.tracking_error == null ? null : Number(fund.tracking_error)
    }
    return Number(fund.fee)
  }

  const purchasePriority = (status) =>
    status === '开放申购' || status === '限大额' ? 0 : 1

  const sorted = [...funds].sort((a, b) => {
    // 先按是否可申购分组：开放申购/限大额在前，暂停申购/封闭期等在后
    const priorityDiff = purchasePriority(a.status) - purchasePriority(b.status)
    if (priorityDiff !== 0) return priorityDiff

    const aValue = sortValue(a)
    const bValue = sortValue(b)

    // 无有效值的项目无论升降序都固定在末尾
    if (aValue == null && bValue != null) return 1
    if (aValue != null && bValue == null) return -1
    if (aValue != null && bValue != null && aValue !== bValue) {
      return sortConfig.direction === 'desc' ? bValue - aValue : aValue - bValue
    }

    // 同值时：先纳斯达克再标普
    if (a.index_key !== b.index_key) return a.index_key === 'nasdaq100' ? -1 : 1
    // 同一基金公司的放一块（公司名字母序）
    const ca = companyOf(a.name)
    const cb = companyOf(b.name)
    if (ca !== cb) return ca.localeCompare(cb, 'zh-CN')
    return a.name.localeCompare(b.name, 'zh-CN')
  })

  const sortHeader = (key, label) => {
    const active = sortConfig.key === key
    const ascending = active && sortConfig.direction === 'asc'
    const nextDirection = active && sortConfig.direction === 'desc' ? '从低到高' : '从高到低'

    return (
      <th aria-sort={active ? (ascending ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          className={`${styles.sortButton} ${active ? styles.sortButtonActive : ''}`}
          onClick={() => handleSort(key)}
          aria-label={`${label}，点击按${nextDirection}排序`}
        >
          <span>{label}</span>
          {active ? (
            <SortDirectionIcon direction={sortConfig.direction} />
          ) : (
            <SortIdleIcon />
          )}
        </button>
      </th>
    )
  }

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
            {sortHeader('limit_amount', '日累计限额')}
            {sortHeader('tracking_error', '年化跟踪误差')}
            {sortHeader('fee', '手续费')}
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
                  <td className={styles.tindex} data-label="跟踪指数">
                    <span className={styles.idxTag}>
                      {f.index_key === 'nasdaq100' ? 'NASDAQ 100' : 'S&P 500'}
                    </span>
                  </td>
                  <td className={styles.tstatus} data-label="申购状态">
                    <span className={`${styles.statusBadge} ${styles[statusClass(f.status)]}`}>
                      {statusLabel(f.status)}
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
                <tr key={`${f.code}-hist`} className={styles.historyRow}>
                  <td colSpan={8}>
                    <div className={`${styles.historyInner} ${isOpen ? styles.open : ''}`}>
                      <div className={styles.historyClip}>
                        <FundDetails fund={f} />
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
    </div>
  )
}
