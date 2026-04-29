import styles from './Mockups.module.css'

function Line({ className }) {
  return (
    <div className={styles.line}>
      <span className={`${styles.lineNumber} ${className || ''}`.trim()} />
    </div>
  )
}

function MockupKada() {
  return (
    <div className={styles.mockKada}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarItem}>结构</span>
        <span className={styles.toolbarItem}>布局</span>
        <span className={styles.toolbarItem}>文本</span>
        <span className={styles.separator} />
        <span className={styles.toolbarItem}>导出</span>
        <span className={styles.toolbarRight}>100%</span>
      </div>
      <div className={styles.panes}>
        <div className={styles.code}>
          <Line />
          <Line />
          <Line className={styles.indent1} />
          <Line className={styles.indent1} />
          <Line className={styles.indent1} />
          <Line className={styles.indent2} />
          <Line className={styles.indent1} />
          <Line />
        </div>
        <div className={styles.preview}>
          <div className={`${styles.previewBlock} ${styles.w60} ${styles.accentBlock}`} />
          <div className={`${styles.previewBlock} ${styles.w80}`} />
          <div className={`${styles.previewBlock} ${styles.w40}`} />
          <div className={styles.previewBox} />
          <div className={`${styles.previewBlock} ${styles.w60}`} />
        </div>
      </div>
    </div>
  )
}

export default MockupKada
