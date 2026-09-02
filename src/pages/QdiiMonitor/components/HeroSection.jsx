import StatCard from './StatCard'
import SubscribeButton from './SubscribeButton'
import styles from './HeroSection.module.css'

export default function HeroSection({ metaLine, stats }) {
  return (
    <section className={styles.hero}>
      <span className={`section-label fi d1`}>QDII Fund Purchase Limit Monitor</span>
      <h2 className={`fi d2`}>
        <span className={styles.titleAccent}>纳斯达克 100 指数 · 标普 500 指数</span>
        <br />
        QDII 型基金申购限额监控
      </h2>
      <p className={`fi d3`}>
        追踪场外基金市场跟踪纳斯达克100指数与标普500指数的全部 QDII 型基金申购状态与单日累计购买上限，每日扫描更新。
      </p>
      <div className={`${styles.meta} fi d3`}>数据来源：天天基金 · {metaLine}</div>
      <div className={`${styles.action} fi d4`}>
        <SubscribeButton />
        <span className={styles.actionHint}>申购状态或额度变动时邮件通知</span>
      </div>
      <div className={`${styles.stats} fi d4`}>
        {stats.map((s) => (
          <StatCard key={s.label} num={s.num} label={s.label} dotClass={s.cls} />
        ))}
      </div>
    </section>
  )
}
