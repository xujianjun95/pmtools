import { useEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { compactHistory, fmtLimit, getChannelLimit, limitText, statusClass, statusLabel } from '../utils'
import { getDirectChannel } from '../fundCompanies'
import SortableTh from './SortableTh'
import HorizontalScroll from './HorizontalScroll'
import styles from './FundTable.module.css'

gsap.registerPlugin(useGSAP)

export function LimitValue({ amount }) {
  if (!(amount > 0)) return <span className={styles.unit}>—</span>
  if (amount >= 1e11) return <span className={styles.limitCell}>无限额</span>
  return <>{fmtLimit(amount)} <span className={styles.unit}>元/日</span></>
}

const formatPercentage = (value) => {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return `${Number(value).toFixed(2)}%`
}

// 收益率涨跌着色：红涨绿跌（A 股惯例）；0 / 缺失不着色
const returnTone = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return null
  return n > 0 ? 'up' : 'down'
}

export function FundDetails({ fund }) {
  const direct = getDirectChannel(fund.name, fund.code)
  const details = [
    {
      label: '近 1 月收益率',
      value: formatPercentage(fund.return_1m),
      tone: returnTone(fund.return_1m),
    },
    {
      label: '近 6 月收益率',
      value: formatPercentage(fund.return_6m),
      tone: returnTone(fund.return_6m),
    },
    {
      label: '近 1 年收益率',
      value: formatPercentage(fund.return_1y),
      tone: returnTone(fund.return_1y),
    },
    {
      label: '近 3 年收益率',
      value: formatPercentage(fund.return_3y),
      tone: returnTone(fund.return_3y),
    },
    {
      label: '成立以来收益率',
      value: formatPercentage(fund.return_since),
      tone: returnTone(fund.return_since),
    },
    { label: '成立日', value: fund.inception_date || '—' },
    {
      label: '基金规模',
      value:
        fund.fund_size == null || !Number.isFinite(Number(fund.fund_size))
          ? '—'
          : `${Number(fund.fund_size).toFixed(2)} 亿元`,
      meta: fund.fund_size_date ? `截至 ${fund.fund_size_date}` : null,
    },
    {
      label: '管理费率 / 年',
      value: formatPercentage(fund.management_fee_rate),
    },
    {
      label: '托管费率 / 年',
      value: formatPercentage(fund.custody_fee_rate),
    },
    {
      label: '代销渠道',
      // 代销 = 第三方销售平台，监控的额度数据本身即代销口径
      value: '天天基金、支付宝等第三方平台',
    },
    {
      label: '直销渠道',
      // 直销 = 基金公司自有平台（官网/APP），限购时额度通常高于代销渠道。
      // 有已验证的产品详情页模板时直达该基金页面，否则落到官网首页
      value: direct ? `${direct.company}官网/APP` : '基金公司官方平台',
      href: direct?.detailUrl || direct?.url,
    },
    {
      label: '持仓明细',
      // 天天基金 F10 持仓页（股票/债券持仓分布），按基金代码直达
      value: '基金持仓分布',
      href: `https://fundf10.eastmoney.com/ccmx_${fund.code}.html`,
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
              {item.href ? (
                <a
                  className={styles.detailLink}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  title={`前往 ${item.value}`}
                >
                  <span className={styles.detailValue}>{item.value}</span>
                  <span className={styles.linkArrow} aria-hidden="true">
                    ↗
                  </span>
                </a>
              ) : (
                <span
                  className={
                    item.tone ? `${styles.detailValue} ${styles[item.tone]}` : styles.detailValue
                  }
                >
                  {item.value}
                </span>
              )}
              {item.meta && (
                <span className={styles.detailMeta} title={item.meta}>
                  {item.meta}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function HistoryTimeline({ fund }) {
  const pts = compactHistory(fund.history)
  // 倒序展示，最新在上；仅一个点时标注首日监控
  const items = [...pts].reverse()


  // 与列表保持一致：暂停时隐藏额度，直销缺数时显示代销额度
  const limitTextIfOpen = (h, field) =>
    limitText(getChannelLimit(h, field))

  return (
    <div className={styles.timeline}>
      <div className={styles.tlTitle}>HISTORY · 变化节点</div>
      <div className={styles.tlHeader}>
        <span>日期</span>
        <span>申购状态</span>
        <span>代销额度</span>
        <span>直销额度</span>
      </div>
      {items.map((h, i) => (
        <div key={h.date} className={`${styles.tlItem} ${i === 0 ? styles.latest : ''}`}>
          <span className={styles.tlDate}>{h.date}</span>
          <span className={styles.tlStatus}>{statusLabel(h.status)}</span>
          <span className={styles.tlLimit}>
            <span className={styles.tlMobileLabel}>代销额度</span>
            {limitTextIfOpen(h, 'limit_amount')}
          </span>
          <span className={styles.tlLimit}>
            <span className={styles.tlMobileLabel}>直销额度</span>
            {limitTextIfOpen(h, 'direct_limit_amount')}
          </span>
          {i === 0 ? (
            items.length === 1 ? <span className={styles.tlTag}>首日监控</span> : <span className={styles.tlTag}>当前</span>
          ) : null}
        </div>
      ))}
    </div>
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
  }, [funds, sortConfig, expanded])

  // 公司名 = 名称开头连续中文去掉「纳斯达克/纳指/标普」后缀，如「广发纳斯达克…」→「广发」
  const companyOf = (name) =>
    (name.match(/^([\u4e00-\u9fa5]+)/)?.[1] || '').replace(
      /(纳斯达克|纳指|标普)/g,
      ''
    )

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

  const limitCell = (fund) => <LimitValue amount={getChannelLimit(fund)} />
  const directLimitCell = (fund) => <LimitValue amount={getChannelLimit(fund, 'direct_limit_amount')} />

  return (
    <div className={styles.tableCard} ref={tableRef}>
      <HorizontalScroll>
      <table>
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
              onSort={() => handleSort('limit_amount')}
            />
            <SortableTh
              label="日累计限额（直销）"
              active={sortConfig.key === 'direct_limit_amount'}
              direction={sortConfig.direction}
              onSort={() => handleSort('direct_limit_amount')}
            />
            <SortableTh
              label="年化跟踪误差"
              active={sortConfig.key === 'tracking_error'}
              direction={sortConfig.direction}
              onSort={() => handleSort('tracking_error')}
            />
            <SortableTh
              label="手续费"
              active={sortConfig.key === 'fee'}
              direction={sortConfig.direction}
              onSort={() => handleSort('fee')}
            />
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
                  <td className={styles.tindex} data-label="跟踪标的">
                    <span className={styles.idxTag}>
                      {/* 主表仅纳指100/标普500 两类，统一标准写法（等权重/S&P 等变体归一） */}
                      {f.index_key === 'nasdaq100' ? '纳斯达克 100 指数' : '标普 500 指数'}
                    </span>
                  </td>
                  <td className={styles.tstatus} data-label="申购状态">
                    <span className={`${styles.statusBadge} ${styles[statusClass(f.status)]}`}>
                      {statusLabel(f.status)}
                    </span>
                  </td>
                  <td className={styles.tlimit} data-label="日累计限额（代销）">
                    <span className={styles.limitCell}>{limitCell(f)}</span>
                  </td>
                  <td className={styles.tdirect} data-label="日累计限额（直销）">
                    <span className={styles.limitCell} title={f.direct_as_of ? `直销数据日期 ${f.direct_as_of} · ${f.direct_source || ''}` : undefined}>{directLimitCell(f)}</span>
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
                  <td colSpan={9}>
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
      </HorizontalScroll>
      {!sorted.length && <div className={styles.noResult}>没有符合条件的基金</div>}
    </div>
  )
}
