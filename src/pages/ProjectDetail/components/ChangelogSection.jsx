import { changelogByProjectId } from '../../../data/changelogs'
import styles from '../ProjectDetail.module.css'

function BulletList({ items }) {
  return (
    <ul className={styles.timelineList}>
      {items.map((b, i) => (
        <li key={i}>
          <strong>{b.lead}</strong>
          {b.text}
        </li>
      ))}
    </ul>
  )
}

function ChangelogSection({ project }) {
  const releases = changelogByProjectId[project.id]
  if (!releases?.length) return null

  return (
    <section className={styles.detailChangelog}>
      <span className="section-label fi">Changelog</span>
      <h2 className="section-title fi d1">更新日志</h2>

      <div className={`${styles.timeline} fi d2`}>
        {releases.map((release, index) => (
          <article key={index} className={styles.timelineItem}>
            <div className={styles.timelineDot} aria-hidden="true" />
            <div className={styles.timelineContent}>
              <time className={styles.timelineDate}>{release.date}</time>
              <h3 className={styles.timelineTitle}>{release.title}</h3>

              {release.intro ? (
                <p className={styles.timelineIntro}>{release.intro}</p>
              ) : null}

              {release.segments?.map((seg, si) => (
                <div key={si} className={styles.timelineSegment}>
                  <p className={styles.timelineSegmentLabel}>{seg.label}</p>
                  <BulletList items={seg.bullets} />
                </div>
              ))}

              {release.bullets?.length ? <BulletList items={release.bullets} /> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default ChangelogSection
