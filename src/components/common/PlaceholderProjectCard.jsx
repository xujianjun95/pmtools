import TechTag from './TechTag'
import pc from './ProjectCard.module.css'
import styles from './PlaceholderProjectCard.module.css'

/** 需求池里待捞的点子：三张便签各写一条，随层叠动画轮流浮到最上面 */
const BACKLOG_IDEAS = ['Tiny Tools', 'Life Automation', 'Fun with AI']

/** 与同页 ProjectCard 同骨架的「下一款」占位，非链接、不可跳转 */
function PlaceholderProjectCard() {
  const sheetClasses = [
    styles.ideaSheetBack,
    styles.ideaSheetMiddle,
    styles.ideaSheetFront,
  ]

  return (
    <div
      className={`${pc.card} ${pc.reversed} ${styles.teaser}`}
      aria-label="占位卡片：Backlog 待排期"
    >
      <div className={pc.mockupWrap}>
        <div
          className={`${pc.mockupInner} ${styles.mockInner}`}
          data-project-preview
        >
          <div className={styles.ideaPool} aria-hidden>
            {BACKLOG_IDEAS.map((idea, index) => (
              <span
                key={idea}
                className={`${styles.ideaSheet} ${sheetClasses[index]}`}
              >
                <span className={styles.ideaTitle}>{idea}</span>
                <i />
                <i />
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={pc.content}>
        <div className={pc.header}>
          <span className={pc.num}>04</span>
          <span className={styles.marker} aria-hidden>
            ◇
          </span>
        </div>
        <h3 className={pc.name}>
          Next<span className={styles.cursor}>_</span>
        </h3>
        <p className={pc.tagline}>Backlog · 待办</p>
        <p className={pc.desc}>
          留白的结构，等灵光来填。
        </p>
        <div className={pc.tags}>
          <TechTag className={pc.cardTag}>排期中</TechTag>
        </div>
        <span className={styles.teaserFoot}>敬请期待 :)</span>
      </div>
    </div>
  )
}

export default PlaceholderProjectCard
