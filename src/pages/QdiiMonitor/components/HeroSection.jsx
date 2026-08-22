import StatCard from './StatCard'
import styles from './HeroSection.module.css'

export default function HeroSection({ metaLine, stats }) {
  return (
    <section className={styles.hero}>
      <div className={`${styles.meta} fi d1`}>数据来源：天天基金 · {metaLine}</div>
      <div className={`${styles.stats} fi d2`}>
        {stats.map((s) => (
          <StatCard key={s.label} num={s.num} label={s.label} dotClass={s.cls} />
        ))}
      </div>
    </section>
  )
}
