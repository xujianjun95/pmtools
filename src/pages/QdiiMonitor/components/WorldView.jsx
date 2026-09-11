import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import filterStyles from './FilterBar.module.css'
import tableStyles from './FundTable.module.css'
import { FundDetails, HistoryTimeline } from './FundTable'
import SortableTh from './SortableTh'
import styles from './WorldView.module.css'
import qdiiStyles from '../QdiiMonitor.module.css'
import { statusClass, statusLabel } from '../utils'
import {
  CROSS_MARKET,
  OTHER_MARKET_COUNTRIES,
  WORLD_SNAPSHOT_DATE,
  countryById,
} from '../worldFunds'

const fmtY1 = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(2)}%`)

// 类型筛选顺序固定，scanner 新增类型时自动追加到末尾
const KIND_ORDER = ['主动', '被动联接', '被动FOF']

// 天天基金以 1e11 标记开放式无限额，直接展示会变成“1000 亿/日”
const UNLIMITED_LIMIT = 1e11

// 限额格式与外层 FundTable 的 limitCell 一致：暂停无意义、亿级省略、其余千分位
function LimitCell({ fund }) {
  if (String(fund.status).includes('暂停'))
    return (
      <span className={tableStyles.unit} title="暂停申购，无限额信息">
        —
      </span>
    )
  const n = Number(fund.limit_amount)
  if (Number.isFinite(n) && n >= UNLIMITED_LIMIT)
    return <span className={tableStyles.limitCell}>无限额</span>
  if (!n || n <= 0) return <span className={tableStyles.unit}>—</span>
  const txt = n >= 1e8 ? `${(n / 1e8).toFixed(0)} 亿` : n.toLocaleString('zh-CN')
  return (
    <>
      {txt} <span className={tableStyles.unit}>元/日</span>
    </>
  )
}

function FundRow({ fund, isOpen, onToggle }) {
  const fullName = fund.note ? `${fund.name} · ${fund.note}` : fund.name
  const detailsFund = {
    ...fund,
    return_1y: fund.return_1y ?? fund.y1,
    history: fund.history?.length
      ? fund.history
      : [
          {
            date: WORLD_SNAPSHOT_DATE,
            status: fund.status,
            // 无限额标记归零，共享时间线会显示为“无限额”而非巨额数字
            limit_amount:
              Number(fund.limit_amount) >= UNLIMITED_LIMIT ? 0 : fund.limit_amount,
            redeem: fund.redeem,
          },
        ],
  }

  return (
    <>
      <tr
        className={`${styles.frow} ${tableStyles.fundRow} ${isOpen ? tableStyles.expanded : ''}`}
        onClick={onToggle}
      >
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
        <td className={tableStyles.tchev}>
          <button
            type="button"
            className={styles.detailToggle}
            aria-label={`${isOpen ? '收起' : '展开'}${fund.name}详情`}
            aria-expanded={isOpen}
            onClick={(event) => {
              event.stopPropagation()
              onToggle()
            }}
          >
            <span className={`${tableStyles.chev} ${isOpen ? tableStyles.chevOpen : ''}`}>▶</span>
          </button>
        </td>
      </tr>
      <tr className={tableStyles.historyRow}>
        <td colSpan={9}>
          <div className={`${tableStyles.historyInner} ${isOpen ? tableStyles.open : ''}`}>
            <div className={tableStyles.historyClip}>
              <FundDetails fund={detailsFund} />
              <HistoryTimeline fund={detailsFund} />
            </div>
          </div>
        </td>
      </tr>
    </>
  )
}

function FundTable({ groups, sortConfig, onSort, expandedKey, onToggle }) {
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
          <th aria-label="详情" />
        </tr>
      </thead>
      <tbody>
        {groups.flatMap((group) =>
          group.funds.map((fund) => {
            const rowKey = `${group.key}-${fund.code}`
            return (
              <FundRow
                key={rowKey}
                fund={fund}
                isOpen={expandedKey === rowKey}
                onToggle={() => onToggle(rowKey)}
              />
            )
          })
        )}
      </tbody>
    </table>
  )
}

function CountryTableSection({ group, sortConfig, onSort, expandedKey, onToggle }) {
  const headingId = `country-table-${group.key}`

  return (
    <section className={styles.countryTableSection} aria-labelledby={headingId}>
      <div className={styles.countrySectionHead}>
        <h3 id={headingId}>
          <span className={styles.countryFlag} aria-hidden="true">{group.head.flag}</span>
          {group.head.zh} <span className={styles.en}>{group.head.en}</span>
        </h3>
        <span className={styles.fundCount}>{group.funds.length} 只</span>
      </div>
      <FundTable
        groups={[{ key: group.key, funds: group.funds }]}
        sortConfig={sortConfig}
        onSort={onSort}
        expandedKey={expandedKey}
        onToggle={onToggle}
      />
    </section>
  )
}

export default function WorldView({ initialSelectedId = 'all' }) {
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [fallbackName, setFallbackName] = useState('')
  const [keyword, setKeyword] = useState('')
  const [kind, setKind] = useState('all')
  const [sortConfig, setSortConfig] = useState({ key: 'limit_amount', direction: 'desc' })
  const [expandedKey, setExpandedKey] = useState(null)
  const sectionRef = useRef(null)

  const selected = selectedId === 'all' ? null : countryById(selectedId)
  const totalCount = useMemo(
    () => OTHER_MARKET_COUNTRIES.reduce((n, c) => n + c.funds.length, 0),
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
  }, [selectedId, keyword])

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

  // 搜索仅匹配代码 / 名称（MVP），防御空值
  const matchKeyword = (fund) => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return true
    return (
      String(fund.code || '').toLowerCase().includes(kw) ||
      String(fund.name || '').toLowerCase().includes(kw)
    )
  }
  const matchKind = (fund) => kind === 'all' || fund.kind === kind

  // 类型选项随快照数据动态生成，顺序固定：主动 → 被动联接 → 被动FOF → 其他
  const kindOptions = useMemo(() => {
    const counts = {}
    for (const c of OTHER_MARKET_COUNTRIES) {
      for (const f of c.funds) counts[f.kind] = (counts[f.kind] || 0) + 1
    }
    for (const f of CROSS_MARKET.funds) counts[f.kind] = (counts[f.kind] || 0) + 1
    const order = (k) => {
      const i = KIND_ORDER.indexOf(k)
      return i === -1 ? KIND_ORDER.length : i
    }
    return Object.keys(counts)
      .sort((a, b) => order(a) - order(b))
      .map((k) => ({ key: k, count: counts[k] }))
  }, [])

  const groups = selectedId === 'all'
    ? OTHER_MARKET_COUNTRIES.map((c) => ({ key: c.id, head: c, funds: sortFunds(c.funds.filter(matchKeyword).filter(matchKind)) })).filter(
        (g) => g.funds.length > 0
      )
    : selected
      ? [{ key: selected.id, funds: sortFunds(selected.funds.filter(matchKeyword).filter(matchKind)) }]
      : []

  const crossFunds = sortFunds(CROSS_MARKET.funds.filter(matchKeyword).filter(matchKind))

  const handleSelect = (id, englishName) => {
    setSelectedId(id)
    setExpandedKey(null)
    if (!countryById(id)) setFallbackName(englishName)
  }

  // 输入搜索词 / 切换类型时收起已展开的详情
  const changeKeyword = (value) => {
    setKeyword(value)
    setExpandedKey(null)
  }
  const pickKind = (key) => {
    setKind(key)
    setExpandedKey(null)
  }

  const handleToggle = (rowKey) => {
    setExpandedKey((current) => (current === rowKey ? null : rowKey))
  }

  return (
    <section className={`${styles.world} fi d8`} ref={sectionRef}>
      <Link to="/qdii" className={styles.backLink}>
        ← 返回 QDII 监控
      </Link>
      <div className={styles.titleRow}>
        <h2 className="section-title">其他市场</h2>
      </div>

      <div className={filterStyles.filters} style={{ margin: '0 0 14px' }}>
        <div className={filterStyles.filterGroup}>
          <span className={filterStyles.glabel}>国家</span>
          <button
            className={`${filterStyles.pill} ${selectedId === 'all' ? filterStyles.active : ''}`}
            onClick={() => handleSelect('all', 'All')}
          >
            全部
            <span className={filterStyles.count}>{totalCount}</span>
          </button>
          {OTHER_MARKET_COUNTRIES.map((c) => (
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
      </div>
      <div className={filterStyles.filters} style={{ margin: '0 0 14px' }}>
        <div className={filterStyles.filterGroup}>
        <span className={filterStyles.glabel}>类型</span>
        <button
          className={`${filterStyles.pill} ${kind === 'all' ? filterStyles.active : ''}`}
          onClick={() => pickKind('all')}
        >
          全部
        </button>
        {kindOptions.map((opt) => (
          <button
            key={opt.key}
            className={`${filterStyles.pill} ${kind === opt.key ? filterStyles.active : ''}`}
            onClick={() => pickKind(opt.key)}
          >
            {opt.key}
            <span className={filterStyles.count}>{opt.count}</span>
          </button>
        ))}
        </div>
        <input
          className={qdiiStyles.search}
          type="search"
          placeholder="搜索代码 / 名称…"
          aria-label="搜索其他市场基金代码或名称"
          value={keyword}
          onChange={(e) => changeKeyword(e.target.value)}
        />
      </div>

      {selectedId === 'all' ? (
        <div className={tableStyles.tableCard}>
          <div className={styles.fundHead}>
            <strong>其他市场</strong>
            <span className={styles.fundCount}>{totalCount} 只</span>
          </div>
          {!groups.length && <div className={styles.empty}>没有符合条件的基金</div>}
          {groups.map((group) => (
            <CountryTableSection
              key={group.key}
              group={group}
              sortConfig={sortConfig}
              onSort={handleSort}
              expandedKey={expandedKey}
              onToggle={handleToggle}
            />
          ))}
        </div>
      ) : selected ? (
        <div className={tableStyles.tableCard}>
          <div className={styles.fundHead}>
            <strong>
              <span className={styles.countryFlag} aria-hidden="true">{selected.flag}</span>
              {selected.zh} <span className={styles.en}>{selected.en}</span>
            </strong>
            <span className={styles.fundCount}>{selected.funds.length} 只</span>
          </div>
          {!groups[0]?.funds.length ? (
            <div className={styles.empty}>没有符合条件的基金</div>
          ) : (
            <FundTable
              groups={groups}
              sortConfig={sortConfig}
              onSort={handleSort}
              expandedKey={expandedKey}
              onToggle={handleToggle}
            />
          )}
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
            <span className={styles.countryFlag} aria-hidden="true">{CROSS_MARKET.flag}</span>
            {CROSS_MARKET.zh} <span className={styles.en}>{CROSS_MARKET.en}</span>
          </strong>
          <span className={styles.fundCount}>{CROSS_MARKET.funds.length} 只</span>
        </div>
        {!crossFunds.length ? (
          <div className={styles.empty}>没有符合条件的基金</div>
        ) : (
          <FundTable
            groups={[{ key: CROSS_MARKET.id, funds: crossFunds }]}
            sortConfig={sortConfig}
            onSort={handleSort}
            expandedKey={expandedKey}
            onToggle={handleToggle}
          />
        )}
        <p className={styles.footnote}>
          快照日期 {WORLD_SNAPSHOT_DATE} · 年化跟踪误差与近 1 年收益为快照值，实时申购限额以天天基金页面为准。
        </p>
      </div>
    </section>
  )
}
