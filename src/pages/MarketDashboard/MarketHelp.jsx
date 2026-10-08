import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './MarketDashboard.module.css'

/** @typedef {'indices' | 'environment' | 'vix' | 'treasury' | 'dollar' | 'usdcny'} HelpTopic */
const LABELS = { indices: '主要指数', environment: '风险与资金环境', vix: 'VIX 恐慌指数', treasury: '美国 10 年期国债收益率', dollar: '美元指数', usdcny: '美元兑人民币' }
const HelpContext = createContext(null)

function Explanation({ topic }) {
  if (topic === 'indices') return <>
    <p>把股票指数想成一个市场的“成绩单”：它把一组股票的表现汇总成一个数字，让你快速看出这个市场整体在涨还是在跌。</p>
    <h5>这几张卡片怎么看？</h5>
    <p>道琼斯、纳斯达克综合和标普 500 观察美国市场；恒生观察香港市场；富时 100、DAX、日经 225、CAC 40 分别观察英国、德国、日本和法国市场。每个指数选的股票和计算方法不同，不能代表当地所有股票。</p>
    <h5>重点看涨跌比例，不比点位大小</h5>
    <p>例如 +1% 表示相对前一交易日收盘上涨约 1%。指数有不同的起点和计算规则，30,000 点并不比 8,000 点“更好”或“更贵”。不同市场的交易时间也不同，请结合卡片的行情时间来看。</p>
    <p className={styles.infoSummary}>下方小图是最近 30 个交易日的日线走势。当天未收盘时，最后一个点还可能变化。它帮你看趋势，但不能单独预测接下来会涨还是跌。</p>
    <a className={styles.infoSource} href="https://www.investor.gov/introduction-investing/investing-basics/investment-products/mutual-funds-and-exchange-traded-4" target="_blank" rel="noopener noreferrer">参考：Investor.gov 指数说明 ↗</a>
  </>
  if (topic === 'environment') return <>
    <p>看市场，除了关注指数涨跌，也需要了解它所处的环境。这组指标从波动预期、长期利率和汇率三个角度，帮助你观察市场情绪与资金条件的变化。</p>
    <h5>为什么放在一起看？</h5>
    <p>同样的指数涨跌，可能发生在不同的市场环境中。把这些指标放在一起观察，可以为价格走势补充背景，避免只凭一张涨跌图判断市场。</p>
    <h5>先看变化，再看是否持续</h5>
    <p>比起孤立地判断某个数值“高不高”，更有用的是观察它相对过去怎么变、变化是否持续，以及其他指标有没有同步变化。它们也可能给出不同信号，这时需要更多信息，不能强行归纳成一个结论。</p>
    <h5>结合时间和持仓理解</h5>
    <p>各市场的交易时间不同，卡片上的报价不一定来自同一时刻，比较前先看行情时间。对海外投资，还要结合实际持有的资产、计价币种和投资期限，理解这些变化与自己的关系。</p>
    <p className={styles.infoSummary}>这组指标提供观察市场的背景，不直接给出买卖答案。想了解某一项的具体含义和读法，可以点击卡片上带虚线的标题。</p>
  </>
  if (topic === 'treasury') return <>
    <p>你可以把它理解为美国长期利率的一把“尺子”：市场以当前价格买入美国 10 年期国债时，对应的年化收益率是多少。</p>
    <h5>收益率和利息是一回事吗？</h5>
    <p>不是。票面利率决定债券按约定支付的利息；收益率还会考虑买入价格、剩余期限和到期偿还金额。卡片上的百分比不等于每年收到同样比例的现金，也不代表债券基金未来的收益。</p>
    <h5>上涨和下跌应该怎么看？</h5>
    <p>对同一只固定利率债券，其他条件相同时，价格下跌会使收益率上升，价格上涨则使收益率下降。因此，收益率卡片上涨，不等于持有国债的人当天赚了钱。</p>
    <h5>涨跌里的 bp 是什么？</h5>
    <p>bp 是“基点”，1 bp 等于 0.01 个百分点。正数表示收益率比前一交易日上升，负数表示下降。这里展示的是收益率的差值，不是债券价格的涨跌百分比。</p>
    <p className={styles.infoSummary}>它反映长期利率环境，不是美联储直接设定的政策利率。查看时结合行情时间，避免把单次升降直接当作股票或债券的买卖信号。</p>
    <a className={styles.infoSource} href="https://www.treasurydirect.gov/marketable-securities/understanding-pricing/" target="_blank" rel="noopener noreferrer">参考：TreasuryDirect 债券价格与收益率说明 ↗</a>
  </>
  if (topic === 'dollar') return <>
    <p>美元指数像美元的一张“综合成绩单”，观察美元相对一篮子货币的整体强弱，而不是只看它与某一种货币的兑换关系。</p>
    <h5>这篮子货币有哪些？</h5>
    <p>包括欧元、日元、英镑、加拿大元、瑞典克朗和瑞士法郎，各自按固定权重参与计算。人民币不在这篮子里，所以美元指数和美元兑人民币不一定同方向变化。</p>
    <h5>数值和涨跌应该怎么理解？</h5>
    <p>它是以历史基期为参考计算的指数点位，不是汇率，也不是百分比。指数上升表示美元相对这篮子货币整体走强，下降表示整体走弱。卡片的涨跌百分比表示指数相对前一交易日的变化。</p>
    <h5>为什么不能只看这个数值？</h5>
    <p>它没有包含所有货币，也不意味着美元对篮子里每一种货币都同时上涨或下跌。判断某一对货币的兑换变化，仍要查看对应汇率。</p>
    <p className={styles.infoSummary}>把它作为美元整体强弱的参考，与美元兑人民币分别观察，不能直接用指数涨跌推算人民币汇率或基金收益。</p>
    <a className={styles.infoSource} href="https://www.ice.com/forex/usdx" target="_blank" rel="noopener noreferrer">参考：ICE 美元指数说明 ↗</a>
  </>
  if (topic === 'usdcny') return <>
    <p>这个数值表示 1 美元可以兑换多少人民币。可以把它理解为用人民币购买 1 美元的“价格”。</p>
    <h5>上涨和下跌分别意味着什么？</h5>
    <p>数值上升，表示购买同样的美元需要更多人民币，即美元相对人民币升值、人民币相对美元贬值；数值下降则相反。卡片的涨跌百分比表示这项报价相对前一交易日的变化。</p>
    <h5>对海外投资有什么影响？</h5>
    <p>在美元资产价格不变、没有汇率对冲且不考虑费用时，美元相对人民币升值，会提高这项资产折算成人民币后的价值；反过来则会降低。实际基金还受到资产涨跌、币种构成、对冲安排和费用等因素影响。</p>
    <h5>这是银行实际兑换价格吗？</h5>
    <p>不是。这张卡片使用 Yahoo Finance 的 USD/CNY 参考行情，不是银行买入价、卖出价或人民币汇率中间价，也不是离岸人民币 USD/CNH。实际兑换请以交易机构当时的报价和费用为准。</p>
    <p className={styles.infoSummary}>先看清报价方向，再看行情时间。美元指数观察一篮子货币，美元兑人民币只观察这两种货币，不能互相替代。</p>
    <a className={styles.infoSource} href="https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/foreign" target="_blank" rel="noopener noreferrer">参考：Investor.gov 外汇报价说明 ↗</a>
  </>
  return <>
        <p>你可以把股市想成海面：指数涨跌告诉你船往哪走，VIX 则告诉你，市场预计接下来会有多大的风浪。数值越高，预期的上下波动越大；越低，预期越平稳。</p>
        <h5>它到底衡量什么？</h5>
        <p>VIX 由 Cboe 编制，根据标普 500 指数期权的价格，估算未来约 30 天的预期波动，并用年化数值表达。它反映的是市场对未来的判断，并不是过去一个月已经发生的涨跌。</p>
        <h5>为什么叫“恐慌指数”？</h5>
        <p>期权可以用来为持仓买“保险”。当投资者担心市场剧烈波动，愿意为保护付出更高价格时，VIX 往往会上升。因此，它常被用来观察市场的紧张程度。不过，“恐慌”是通俗叫法，VIX 并没有统计有多少人害怕。</p>
        <h5>VIX 数值应该怎么理解？</h5>
        <p>VIX 的数值表示市场预期的年化波动率。数值越高，意味着市场预计未来约 30 天的价格起伏越大；越低，则预计起伏较小。它不是预计下跌的百分比，也不是下跌的概率，上涨和下跌都可能发生。虽然它观察的是未来约 30 天，但数值按年化口径表达，不能直接当作一个月的涨跌幅。这只是市场预期，实际波动可能与预期不同。</p>
        <h5>怎么看高低和变化？</h5>
        <p>先和它自己过去的水平比较：低位通常说明市场预期较平稳，突然升高说明对波动的担忧增加。还要看持续时间：短暂跳升与连续多天维持高位，含义不同。没有一条固定分界线能保证市场安全或危险。</p>
        <h5>最容易误解的两点</h5>
        <p>VIX 上升不等于股票一定下跌，下降也不等于股票一定上涨；它主要衡量波动幅度，不预测方向。高 VIX 不代表马上见底，低 VIX 也不代表马上见顶，不能单凭它决定买卖。</p>
        <p className={styles.infoSummary}>在这个看板里，把它当作“市场紧张程度”的参考，与指数走势一起观察即可。卡片的涨跌百分比表示 VIX 自身相对前一交易日的变化，不是标普 500 的涨跌。</p>
        <a className={styles.infoSource} href="https://www.cboe.com/insights/posts/what-the-vix-and-vix-1-d-indices-attempt-to-measure-and-how-they-differ" target="_blank" rel="noopener noreferrer">定义来源：Cboe 官方说明 ↗</a>
  </>
}

/** @param {{children: import('react').ReactNode}} props */
export function MarketHelpProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [present, setPresent] = useState(false)
  const [topic, setTopic] = useState('vix')
  const [portalTarget, setPortalTarget] = useState(null)
  const triggerRef = useRef(null)
  const bubbleRef = useRef(null)
  useEffect(() => {
    if (open || !present) return
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180
    const timer = window.setTimeout(() => setPresent(false), duration)
    return () => window.clearTimeout(timer)
  }, [open, present])
  const close = () => {
    triggerRef.current?.focus({ preventScroll: true })
    setOpen(false)
  }
  useEffect(() => {
    if (!open) return
    const dismiss = (event) => {
      if (!triggerRef.current?.contains(event.target) && !bubbleRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); triggerRef.current?.focus({ preventScroll: true }); setOpen(false) }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])
  const toggle = (nextTopic, trigger) => {
    if (open && topic === nextTopic) { setOpen(false); return }
    const target = document.getElementById('pmtools-companion-explanation')
    if (!target) return
    triggerRef.current = trigger
    setTopic(nextTopic)
    setPortalTarget(target)
    setPresent(true)
    setOpen(true)
    if (window.matchMedia('(max-width: 768px)').matches) target.parentElement?.scrollIntoView({ block: 'end', behavior: 'instant' })
  }
  return <HelpContext.Provider value={{ open, topic, toggle }}>
    {children}
    {present && portalTarget && createPortal(<div ref={bubbleRef} id="market-explanation" className={styles.infoPopover} data-state={open ? 'open' : 'closing'} inert={!open} aria-hidden={!open} role="region" aria-label={`${LABELS[topic]}说明`}>
      <div className={styles.infoPanel}>
        <div className={styles.infoHeading}><h4>我来讲讲{LABELS[topic]}</h4><button type="button" aria-label={`关闭${LABELS[topic]}说明`} onClick={close}>×</button></div>
        <Explanation topic={topic} />
      </div>
    </div>, portalTarget)}
  </HelpContext.Provider>
}

/** @param {{topic: HelpTopic, children?: import('react').ReactNode}} props */
export default function MarketHelpButton({ topic, children }) {
  const help = useContext(HelpContext)
  return <span className={styles.infoWrapper}>
    <button type="button" className={children ? styles.infoTextButton : styles.infoButton} aria-label={`了解 ${LABELS[topic]}`} aria-expanded={help?.open && help.topic === topic || false} aria-controls="market-explanation" onClick={(event) => help?.toggle(topic, event.currentTarget)}>{children || <span aria-hidden="true">?</span>}</button>
  </span>
}
