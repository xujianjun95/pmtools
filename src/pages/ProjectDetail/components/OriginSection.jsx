import styles from '../ProjectDetail.module.css'

function OriginSection({ project }) {
  if (project.id !== 'yessir') return null

  return (
    <section className={styles.detailOrigin}>
      <span className="section-label fi">Why I Built This</span>
      <h2 className="section-title fi d1">💡 开发初衷：被无数个微小的「不爽」逼出来的工具</h2>

      <div className={`${styles.originCard} fi d2`}>
        <p className={styles.originPara}>
          作为一名重度依赖浏览器工作的人，我的日常往往伴随着大量的产品设计和数据分析工作。不知不觉中，浏览器顶端就会挤满几十个密密麻麻的标签页。
        </p>
        <p className={styles.originPara}>在这个状态下，最打断心流的往往是两个瞬间：</p>

        <div className={styles.originPoint}>
          <h3 className={styles.originPointTitle}>“刚才那个网页去哪了？”</h3>
          <p className={styles.originPara}>
            当标签页多到连标题都完全隐藏，只剩下一个个微小的网站 Icon 时，想要找回半小时前打开的那份文档，就变成了一场极其痛苦的“点名游戏”。找一个网页，需要在几十个标签里反复切换确认。
          </p>
        </div>

        <div className={styles.originPoint}>
          <h3 className={styles.originPointTitle}>“这个叉号怎么这么难点！”</h3>
          <p className={styles.originPara}>
            当你想清理这些乱七八糟的网页时，必须把鼠标移动到屏幕最边缘，然后小心翼翼地瞄准那个只有几像素大小的 x 号。这种需要“狙击手级”精准度的反直觉操作，每天都在悄无声息地消耗着耐心。
          </p>
        </div>

        <p className={styles.originPara}>
          我试过市面上的各种标签管理插件，但它们大多只是生硬地塞给你一个复杂的侧边栏，依然没有解决“操作繁琐”的根本问题。
        </p>
        <p className={styles.originEmphasis}>既然找不到趁手的，那就自己造一个。</p>
        <p className={styles.originPara}>
          我希望有一款工具，能包容我的模糊记忆（找不到就用语义直接搜），能让我用最本能的肌肉记忆去操作（不用瞄准，鼠标双击空白处秒关），让“管理标签”这件烦心事，彻底退化成一种无意识的、跟手的享受。
        </p>
        <p className={styles.originEnding}>这就是 YesSir 诞生的起点。</p>
      </div>
    </section>
  )
}

export default OriginSection
