import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './MarketDashboard.module.css'

/** @typedef {'indices' | 'environment' | 'vix'} HelpTopic */
const LABELS = { indices: '主要指数', environment: '风险与资金环境', vix: 'VIX 恐慌指数' }
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
    <p>如果指数告诉你市场“往哪走”，这组指标帮你看周围的“天气”：市场紧不紧张、利率处在什么水平，以及美元和人民币怎么变化。</p>
    <h5>VIX：预期的风浪有多大</h5>
    <p>衡量市场对标普 500 未来约 30 天波动的预期。越高，预期波动越大；它不直接预测上涨或下跌。想了解细节，可以点 VIX 卡片旁的问号。</p>
    <h5>美国 10 年期国债收益率：长期利率的参考</h5>
    <p>例如 4% 表示以当前价格衡量的年化到期收益率，不代表每年一定拿到 4% 现金。通常，债券价格上涨时收益率下降，价格下跌时收益率上升。变动用 bp（基点）表示：1 bp = 0.01 个百分点，+10 bp 就是从 4.00% 升到 4.10%。</p>
    <h5>美元指数：美元相对一篮子货币的强弱</h5>
    <p>指数上升，表示美元相对这组货币整体走强；下降则表示整体走弱。它并不是美元兑人民币的汇率，两者不一定同方向变化。</p>
    <h5>美元兑人民币：1 美元能换多少人民币</h5>
    <p>例如 6.70 表示 1 美元约兑换 6.70 元人民币。升到 6.80，意味着兑换同样的美元需要更多人民币；降到 6.60 则需要更少。这是参考行情，实际银行兑换价格可能不同。</p>
    <p className={styles.infoSummary}>这些指标可以一起观察，但没有一个数值能单独给出“该买还是该卖”的答案。先理解变化，再结合行情时间和其他信息判断。</p>
    <a className={styles.infoSource} href="https://www.cboe.com/tradable-products/vix" target="_blank" rel="noopener noreferrer">参考：Cboe VIX 定义 ↗</a>
  </>
  return <>
        <p>你可以把股市想成海面：指数涨跌告诉你船往哪走，VIX 则告诉你，市场预计接下来会有多大的风浪。数值越高，预期的上下波动越大；越低，预期越平稳。</p>
        <h5>它到底衡量什么？</h5>
        <p>VIX 由 Cboe 编制，根据标普 500 指数期权的价格，估算未来约 30 天的预期波动，并用年化数值表达。它反映的是市场对未来的判断，并不是过去一个月已经发生的涨跌。</p>
        <h5>为什么叫“恐慌指数”？</h5>
        <p>期权可以用来为持仓买“保险”。当投资者担心市场剧烈波动，愿意为保护付出更高价格时，VIX 往往会上升。因此，它常被用来观察市场的紧张程度。不过，“恐慌”是通俗叫法，VIX 并没有统计有多少人害怕。</p>
        <h5>看到 16，应该怎么理解？</h5>
        <p>它表示约 16% 的年化预期波动率，不是“未来一个月会跌 16%”，也不是“有 16% 的概率下跌”。按常见的时间换算，16 ÷ √12 ≈ 4.6%，可粗略理解为未来一个月约 4.6% 的波动尺度；上涨和下跌都可能发生。这只是模型估计，实际波动可能更大。</p>
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

/** @param {{topic: HelpTopic}} props */
export default function MarketHelpButton({ topic }) {
  const help = useContext(HelpContext)
  return <span className={styles.infoWrapper}>
    <button type="button" className={styles.infoButton} aria-label={`了解 ${LABELS[topic]}`} aria-expanded={help?.open && help.topic === topic || false} aria-controls="market-explanation" onClick={(event) => help?.toggle(topic, event.currentTarget)}><span aria-hidden="true">?</span></button>
  </span>
}
