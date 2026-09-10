import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import filterStyles from './FilterBar.module.css'
import tableStyles from './FundTable.module.css'
import SortableTh from './SortableTh'
import styles from './WorldView.module.css'
import { statusClass, statusLabel } from '../utils'
import {
  CROSS_MARKET,
  WORLD_COUNTRIES,
  WORLD_SNAPSHOT_DATE,
  countryById,
} from '../worldFunds'

const COLUMN_COUNT = 8

const fmtY1 = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(2)}%`)

// 限额格式与外层 FundTable 的 limitCell 一致：暂停无意义、亿级省略、其余千分位
function LimitCell({ fund }) {
  if (String(fund.status).includes('暂停'))
    return (
      <span className={tableStyles.unit} title="暂停申购，无限额信息">
        —
      </span>
    )
  const n = Number(fund.limit_amount)
  if (!n || n <= 0) return <span className={tableStyles.unit}>—</span>
  const txt = n >= 1e8 ? `${(n / 1e8).toFixed(0)} 亿` : n.toLocaleString('zh-CN')
  return (
    <>
      {txt} <span className={tableStyles.unit}>元/日</span>
    </>
  )
}

function FundRow({ fund }) {
  const fullName = fund.note ? `${fund.name} · ${fund.note}` : fund.name
  return (
    <tr className={styles.frow}>
      <td className={tableStyles.fcode} data-label="代码">{fund.code}</td>
      <td className={tableStyles.tname} data-label="基金简称">
        <span className={tableStyles.fname} data-fullname={fullName}>
          <span className={tableStyles.txt}>
            {fund.name}
            {fund.note && <span className={styles.fnote}> · {fund.note}</span>}
          </span>
        </span>
      </td>
      <td className={tableStyles.tindex} data-label="类型">
        <span className={tableStyles.idxTag}>{fund.kind}</span>
      </td>
      <td className={tableStyles.tstatus} data-label="申购状态">
        <span className={`${tableStyles.statusBadge} ${tableStyles[statusClass(fund.status)]}`}>
          {statusLabel(fund.status)}
        </span>
      </td>
      <td className={tableStyles.tlimit} data-label="日累计限额（代销）">
        <span className={tableStyles.limitCell}>
          <LimitCell fund={fund} />
        </span>
      </td>
      <td className={tableStyles.tte} data-label="年化跟踪误差">
        <span className={tableStyles.limitCell}>
          {fund.tracking_error != null ? (
            <>
              {Number(fund.tracking_error).toFixed(2)}
              <span className={tableStyles.unit}>%</span>
            </>
          ) : (
            <span className={tableStyles.unit} title="天天基金暂未提供该基金的跟踪误差（主动基金 / FOF）">
              —
            </span>
          )}
        </span>
      </td>
      <td className={tableStyles.tfee} data-label="手续费">
        <span className={tableStyles.limitCell}>
          {fund.fee > 0 ? (
            <>
              {Number(fund.fee).toFixed(2)}
              <span className={tableStyles.unit}>%</span>
            </>
          ) : fund.fee === 0 ? (
            '免'
          ) : (
            <span className={tableStyles.unit}>—</span>
          )}
        </span>
      </td>
      <td className={styles.ty1} data-label="近1年收益">
        {fund.y1 == null ? (
          <span className={tableStyles.unit}>—</span>
        ) : (
          <span className={fund.y1 >= 0 ? styles.up : styles.down}>{fmtY1(fund.y1)}</span>
        )}
      </td>
    </tr>
  )
}

function FundTable({ groups, sortConfig, onSort }) {
  return (
    <table className={styles.wtable}>
      <thead>
        <tr>
          <th>代码</th>
          <th>基金简称</th>
          <th>类型</th>
          <th>申购状态</th>
          <SortableTh
            label="日累计限额（代销）"
            active={sortConfig.key === 'limit_amount'}
            direction={sortConfig.direction}
            onSort={() => onSort('limit_amount')}
          />
          <SortableTh
            label="年化跟踪误差"
            active={sortConfig.key === 'tracking_error'}
            direction={sortConfig.direction}
            onSort={() => onSort('tracking_error')}
          />
          <SortableTh
            label="手续费"
            active={sortConfig.key === 'fee'}
            direction={sortConfig.direction}
            onSort={() => onSort('fee')}
          />
          <th>近1年收益</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <Fragment key={g.key}>
            {g.head && (
              <tr className={styles.countryRow}>
                <td colSpan={COLUMN_COUNT}>
                  <div className={styles.countryHead}>
                    <strong>
                      {g.head.zh} <span className={styles.en}>{g.head.en}</span>
                    </strong>
                    <span className={styles.fundCount}>{g.funds.length} 只</span>
                  </div>
                </td>
              </tr>
            )}
            {g.funds.map((f) => (
              <FundRow key={f.code} fund={f} />
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  )
}

export default function WorldView({ initialSelectedId = '840' }) {
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [fallbackName, setFallbackName] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'limit_amount', direction: 'desc' })
  const sectionRef = useRef(null)

  const selected = selectedId === 'all' ? null : countryById(selectedId)
  const totalCount = useMemo(
    () => WORLD_COUNTRIES.reduce((n, c) => n + c.funds.length, 0),
    []
  )

  // 名称溢出时悬停显示全称（与外层 FundTable 的 trunc tooltip 一致）
  useEffect(() => {
    const check = () => {
      sectionRef.current?.querySelectorAll('span[data-fullname]').forEach((el) => {
        const txt = el.firstElementChild
        if (txt) el.classList.toggle('trunc', txt.scrollWidth > txt.clientWidth)
      })
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [selectedId])

  const handleSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }))
  }

  // 排序规则与外层 FundTable 一致：可申购的在前，无有效值的沉底，组内排序
  const purchasePriority = (status) =>
    status === '开放申购' || status === '限大额' ? 0 : 1

  const sortValue = (fund) => {
    if (sortConfig.key === 'limit_amount') {
      if (String(fund.status).includes('暂停')) return null
      const limit = Number(fund.limit_amount)
      return limit > 0 ? limit : null
    }
    if (sortConfig.key === 'tracking_error') {
      return fund.tracking_error == null ? null : Number(fund.tracking_error)
    }
    return Number(fund.fee)
  }

  const sortFunds = (funds) =>
    [...funds].sort((a, b) => {
      const priorityDiff = purchasePriority(a.status) - purchasePriority(b.status)
      if (priorityDiff !== 0) return priorityDiff

      const aValue = sortValue(a)
      const bValue = sortValue(b)
      if (aValue == null && bValue != null) return 1
      if (aValue != null && bValue == null) return -1
      if (aValue != null && bValue != null && aValue !== bValue) {
        return sortConfig.direction === 'desc' ? bValue - aValue : aValue - bValue
      }
      return 0
    })

  const groups = selectedId === 'all'
    ? WORLD_COUNTRIES.map((c) => ({ key: c.id, head: c, funds: sortFunds(c.funds) }))
    : selected
      ? [{ key: selected.id, funds: sortFunds(selected.funds) }]
      : []

  const handleSelect = (id, englishName) => {
    setSelectedId(id)
    if (!countryById(id)) setFallbackName(englishName)
  }

  return (
    <section className={`${styles.world} fi d8`} ref={sectionRef}>
      <Link to="/qdii" className={styles.backLink}>
        ← 返回 QDII 监控
      </Link>
      <div className={styles.titleRow}>
        <h2 className="section-title">世界</h2>
        <span className={styles.snapshot}>基金快照 {WORLD_SNAPSHOT_DATE} · 点击国家切换</span>
      </div>

      <div className={filterStyles.filterGroup} style={{ margin: '0 0 14px' }}>
        <span className={filterStyles.glabel}>国家</span>
        <button
          className={`${filterStyles.pill} ${selectedId === 'all' ? filterStyles.active : ''}`}
          onClick={() => handleSelect('all', 'All')}
        >
          全部
          <span className={filterStyles.count}>{totalCount}</span>
        </button>
        {WORLD_COUNTRIES.map((c) => (
          <button
            key={c.id}
            className={`${filterStyles.pill} ${selectedId === c.id ? filterStyles.active : ''}`}
            onClick={() => handleSelect(c.id, c.en)}
          >
            {c.flag} {c.zh}
            <span className={filterStyles.count}>{c.funds.length}</span>
          </button>
        ))}
      </div>

      {selectedId === 'all' || selected ? (
        <div className={tableStyles.tableCard}>
          <div className={styles.fundHead}>
            {selectedId === 'all' ? (
              <strong>全部国家</strong>
            ) : (
              <strong>
                {selected.zh} <span className={styles.en}>{selected.en}</span>
              </strong>
            )}
            <span className={styles.fundCount}>
              {selectedId === 'all' ? totalCount : selected.funds.length} 只
            </span>
          </div>
          <FundTable groups={groups} sortConfig={sortConfig} onSort={handleSort} />
        </div>
      ) : (
        <div className={tableStyles.tableCard}>
          <div className={styles.fundHead}>
            <strong>{fallbackName || '该国'}</strong>
            <span className={styles.fundCount}>0 只</span>
          </div>
          <div className={styles.empty}>
            <strong>{fallbackName || '该国'}暂无覆盖的主动 / 联接基金</strong>
            <p>当前快照只覆盖 9 国。点上方国家 pill 快速切换，或等后续 scanner 接入更多市场。</p>
          </div>
        </div>
      )}

      <div className={`${tableStyles.tableCard} ${styles.crossCard}`}>
        <div className={styles.fundHead}>
          <strong>
            {CROSS_MARKET.zh} <span className={styles.en}>{CROSS_MARKET.en}</span>
          </strong>
          <span className={styles.fundCount}>{CROSS_MARKET.funds.length} 只</span>
        </div>
        <FundTable
          groups={[{ key: CROSS_MARKET.id, funds: sortFunds(CROSS_MARKET.funds) }]}
          sortConfig={sortConfig}
          onSort={handleSort}
        />
        <p className={styles.footnote}>
          快照日期 {WORLD_SNAPSHOT_DATE} · 年化跟踪误差与近 1 年收益为快照值，实时申购限额以天天基金页面为准。
        </p>
      </div>
    </section>
  )
}
