import styles from '../Profile.module.css'
import VibeCard from './VibeCard'

function ProfileHero() {
  return (
    <section className={styles.profileHero}>
      <span className="section-label fi">About</span>
      <div className={styles.profileHeroInner}>
        <div className={styles.profileHeroLeft}>
          <h1 className={`${styles.profileName} fi d1`}>健钧</h1>
          <p className={`${styles.profileTitle} fi d2`}>产品经理 · AI CODER · 独立开发者</p>
          <div className={`${styles.profileBio} fi d3`}>
            <p>
              8 年产品经理工作经验，做过一些国家级项目，大部分时间在给复杂系统做减法。
            </p>
            <p>
              工作之余自己 Vibe Coding 造一些东西。浏览器扩展、Web 应用、小程序等等——不立项、不排期，碰到问题自己动手，做完发上来。
            </p>
            <p>
              喜欢精简、顺手的东西。如果你也是，可能会对这里的东西感兴趣。
            </p>
          </div>
        </div>
        <div className={styles.profileHeroRight}>
          <VibeCard />
        </div>
      </div>
    </section>
  )
}

export default ProfileHero
