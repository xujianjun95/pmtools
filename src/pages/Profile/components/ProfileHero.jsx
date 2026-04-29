import styles from '../Profile.module.css'

function ProfileHero() {
  return (
    <section className={styles.profileHero}>
      <span className="section-label fi">About</span>
      <h1 className={`${styles.profileName} fi d1`}>徐健钧</h1>
      <p className={`${styles.profileTitle} fi d2`}>独立开发者 · 产品工程师</p>
      <div className={`${styles.profileBio} fi d3`}>
        <p>
          独立完成从 0 到 1 的产品设计与开发，专注于构建实用、精致的工具类产品。擅长将复杂需求转化为简洁优雅的解决方案。
        </p>
        <p>
          目前专注于浏览器扩展和 Web 工具类产品开发，持续探索技术与产品设计的交叉地带。
        </p>
      </div>
    </section>
  )
}

export default ProfileHero
