import styles from '../ProjectDetail.module.css'

function DetailLinks({ project }) {
  return (
    <section className={`${styles.detailLinks} fi`}>
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
    </section>
  )
}

export default DetailLinks
