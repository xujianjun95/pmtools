import styles from '../ProjectDetail.module.css'

function DetailLinks({ project }) {
  return (
    <section className={`${styles.detailLinks} fi`}>
      <div className={styles.buttonsRow}>
        <a
          href={project.links.project}
          className={`${styles.dlBtn} ${styles.primary}`}
          target="_blank"
          rel="noreferrer"
        >
          访问项目 <span className={styles.linkArrow}>↗</span>
        </a>
        <a
          href={project.links.source}
          className={`${styles.dlBtn} ${styles.secondary}`}
          target="_blank"
          rel="noreferrer"
        >
          源代码 <span className={styles.linkArrow}>↗</span>
        </a>
      </div>

      {project.id === 'yessir' && (
        <div className={styles.sciNote}>#访问本工具项目详情页需科学上网</div>
      )}
    </section>
  )
}

export default DetailLinks
