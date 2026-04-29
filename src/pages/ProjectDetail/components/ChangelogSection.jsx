import styles from '../ProjectDetail.module.css'

function ChangelogSection({ project }) {
  if (project.id !== 'yessir') return null

  return (
    <section className={styles.detailChangelog}>
      <span className="section-label fi">Changelog</span>
      <h2 className="section-title fi d1">更新日志</h2>

      <div className={`${styles.timeline} fi d2`}>
        <article className={styles.timelineItem}>
          <div className={styles.timelineDot} aria-hidden="true" />
          <div className={styles.timelineContent}>
            <time className={styles.timelineDate}>2026 年 4 月 22 日</time>
            <h3 className={styles.timelineTitle}>🎉 YesSir V1.5 焕新上线！</h3>
            <ul className={styles.timelineList}>
              <li>
                <strong>🔍 面板变身浏览器！</strong>
                新增「网页搜索模式」，只需在搜索框轻敲 Tab 键，输入内容即可直接发起全网搜索，效率再翻倍！
              </li>
              <li>
                <strong>🌗 暗黑模式来了！</strong>
                「明以察物，暗以观心。」无论白昼还是黑夜，为你提供最沉浸、舒适的光影体验。
              </li>
              <li>
                <strong>⚡ 细节疯狂打磨：</strong>
                大幅优化了性能响应速度，同时微调了多处提示文案，体验直接拉满，快来试试吧！
              </li>
            </ul>
          </div>
        </article>
      </div>
    </section>
  )
}

export default ChangelogSection
