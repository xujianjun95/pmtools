import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import filterStyles from './FilterBar.module.css'
import tableStyles from './FundTable.module.css'
import { FundDetails, HistoryTimeline, LimitValue } from './FundTable'
import SortableTh from './SortableTh'
import HorizontalScroll from './HorizontalScroll'
import Disclaimer from './Disclaimer'
import styles from './WorldView.module.css'
import qdiiStyles from '../QdiiMonitor.module.css'
import { statusClass, statusLabel, getChannelLimit } from '../utils'
import {
  CROSS_MARKET,
  OTHER_MARKET_COUNTRIES,
  WORLD_SNAPSHOT_DATE,
  countryById,
} from '../worldFunds'

// 类型筛选顺序固定，scanner 新增类型时自动追加到末尾
const KIND_ORDER = ['主动', '被动联接', '被动FOF']

// 天天基金「跟踪标的」官方全名含交易所前缀较长（如「中证韩交所中韩半导体指数」），
// 展示用简写；数据保留全名，未命中映射显示原值
const TRACK_TARGET_ABBR = {
  中证韩交所中韩半导体指数: '中韩半导体',
  恒生科技指数: '恒生科技',
  纳斯达克100指数: '纳斯达克100',
  标准普尔500指数: '标普500',
  伦敦富时100指数: '富时100',
  法兰克福DAX指数: '德国DAX',
  法国CAC40指数: '法国CAC40',
  东京日经225指数: '日经225',
  富时亚太低碳精选指数: '亚太低碳精选',
  新交所泛东南亚科技指数: '泛东南亚科技',
}

const abbrTrackTarget = (v) => TRACK_TARGET_ABBR[v] || v

function LimitCell({ fund }) {
  return <LimitValue amount={getChannelLimit(fund)} />
}

function DirectLimitCell({ fund }) {
  return <LimitValue amount={getChannelLimit(fund, 'direct_limit_amount')} />
}

function FundRow({ fund, isOpen, onToggle }) {
  const fullName = fund.name
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
              fund.limit_amount,
            direct_limit_amount: fund.direct_limit_amount,
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
            </span>
          </span>
        </td>
        <td className={tableStyles.tindex} data-label="跟踪标的">
          <span className={`${tableStyles.idxTag} ${styles.trackTag}`}>
            {/* 被动基金显示天天基金「跟踪标的」字段（快照注入的 track_target），
                主动基金 / FOF 无跟踪标的直接标注类型 */}
            {abbrTrackTarget(fund.track_target) || (fund.kind === '主动' ? '主动基金' : fund.kind)}
          </span>
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
        <td className={tableStyles.tdirect} data-label="日累计限额（直销）">
          <span className={tableStyles.limitCell} title={fund.direct_as_of ? `直销数据日期 ${fund.direct_as_of} · ${fund.direct_source || ''}` : undefined}>
            <DirectLimitCell fund={fund} />
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
    <HorizontalScroll>
    <table className={styles.wtable}>
      <thead>
        <tr>
          <th>代码</th>
          <th>基金简称</th>
          <th>跟踪标的</th>
          <th>申购状态</th>
          <SortableTh
            label="日累计限额（代销）"
            active={sortConfig.key === 'limit_amount'}
            direction={sortConfig.direction}
            onSort={() => onSort('limit_amount')}
          />
          <SortableTh
            label="日累计限额（直销）"
            active={sortConfig.key === 'direct_limit_amount'}
            direction={sortConfig.direction}
            onSort={() => onSort('direct_limit_amount')}
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
    </HorizontalScroll>
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
  const [liveData, setLiveData] = useState(null)
  const sectionRef = useRef(null)

  // scanner 每日扫描的世界页数据；文件缺失（未部署/首次运行前）整体回退静态快照
  useEffect(() => {
    let cancelled = false
    fetch('/qdii/worldpage-data.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        if (!cancelled) setLiveData(json)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // 动态字段合并：申购状态/限额/详情数据（跟踪误差、收益率、规模、费率）以
  // 每日扫描为准；fee 是申购费口径（scanner 的费率列口径不同）不覆盖，
  // 直销档位缺失时保留静态值，避免扫描未覆盖时开天窗
  const liveByCode = useMemo(() => {
    const map = new Map()
    for (const f of liveData?.funds ?? []) map.set(f.code, f)
    return map
  }, [liveData])

  const LIVE_FIELDS = [
    'track_target',
    'direct_as_of',
    'direct_source',
    'direct_source_url',
    'tracking_error',
    'return_1m',
    'return_6m',
    'return_1y',
    'return_3y',
    'return_since',
    'inception_date',
    'fund_size',
    'fund_size_date',
    'management_fee_rate',
    'custody_fee_rate',
  ]

  const mergeFund = (fund) => {
    const live = liveByCode.get(fund.code)
    if (!live) return fund
    const merged = { ...fund }
    for (const key of LIVE_FIELDS) {
      if (live[key] != null) merged[key] = live[key]
    }
    merged.status = live.status
    merged.redeem = live.redeem
    merged.limit_amount = live.limit_amount
    if (live.direct_limit_amount != null) {
      merged.direct_limit_amount = live.direct_limit_amount
    }
    if (live.history?.length) merged.history = live.history
    return merged
  }

  // URL 参数直达某地区（hero 地图跳入 / 前进后退）；非法 id 回落到「全部」
  const [prevInitialId, setPrevInitialId] = useState(initialSelectedId)
  if (prevInitialId !== initialSelectedId) {
    setPrevInitialId(initialSelectedId)
    setSelectedId(
      initialSelectedId === 'all' || countryById(initialSelectedId) ? initialSelectedId : 'all'
    )
    setExpandedKey(null)
  }

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
    // web 字体加载完成会改变文本实测宽度，必须补测一次，否则部分行漏加 trunc
    let cancelled = false
    document.fonts.ready
      .then(() => {
        if (!cancelled) check()
      })
      .catch(() => {})
    window.addEventListener('resize', check)
    return () => {
      cancelled = true
      window.removeEventListener('resize', check)
    }
  }, [selectedId, keyword, kind, sortConfig, expandedKey, liveData])

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
    if (sortConfig.key === 'limit_amount' || sortConfig.key === 'direct_limit_amount') {
      const amount = getChannelLimit(fund, sortConfig.key)
      return amount > 0 ? amount : null
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
    ? OTHER_MARKET_COUNTRIES.map((c) => ({ key: c.id, head: c, funds: sortFunds(c.funds.map(mergeFund).filter(matchKeyword).filter(matchKind)) })).filter(
        (g) => g.funds.length > 0
      )
    : selected
      ? [{ key: selected.id, funds: sortFunds(selected.funds.map(mergeFund).filter(matchKeyword).filter(matchKind)) }]
      : []

  const crossFunds = sortFunds(CROSS_MARKET.funds.map(mergeFund).filter(matchKeyword).filter(matchKind))

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
        !groups.length ? (
          <div className={tableStyles.tableCard}>
            <div className={styles.empty}>没有符合条件的基金</div>
          </div>
        ) : (
          groups.map((group) => (
            <div className={`${tableStyles.tableCard} ${styles.groupCard}`} key={group.key}>
              <CountryTableSection
                group={group}
                sortConfig={sortConfig}
                onSort={handleSort}
                expandedKey={expandedKey}
                onToggle={handleToggle}
              />
            </div>
          ))
        )
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
            <p>当前快照只覆盖 10 个市场。点上方国家 pill 快速切换，或等后续 scanner 接入更多市场。</p>
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
      </div>
      <Disclaimer />
    </section>
  )
}
