import TechTag from './TechTag'
import pc from './ProjectCard.module.css'
import styles from './PlaceholderProjectCard.module.css'

/** 与同页 ProjectCard 同骨架的「下一款」占位，非链接、不可跳转 */
function PlaceholderProjectCard({ delayClassName = '' }) {
  return (
    <div
      className={`${pc.card} ${styles.teaser} ${delayClassName}`.trim()}
      aria-label="占位卡片：Backlog 待排期"
    >
      <div className={pc.mockupWrap}>
        <div className={`${pc.mockupInner} ${styles.mockInner}`}>
          <div className={styles.mockPlate} aria-hidden>
            <span className={styles.mockGlyph}>⋯</span>
            <span className={styles.mockHint}>Soon</span>
          </div>
        </div>
      </div>

      <div className={pc.content}>
        <div className={pc.header}>
          <span className={pc.num}>03</span>
          <span className={styles.marker} aria-hidden>
            ◇
          </span>
        </div>
        <h3 className={pc.name}>
          Next<span className={styles.cursor}>_</span>
        </h3>
        <p className={pc.tagline}>Backlog · 待办</p>
        <p className={pc.desc}>
          日常工作里积攒的吐槽都扔进需求池了，等哪天有空了，就捞一个出来做。
        </p>
        <div className={pc.tags}>
          <TechTag className={pc.cardTag}>排期中</TechTag>
        </div>
        <span className={styles.teaserFoot}>敬请期待</span>
      </div>
    </div>
  )
}

export default PlaceholderProjectCard
