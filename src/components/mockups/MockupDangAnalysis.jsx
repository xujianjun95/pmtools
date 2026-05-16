import styles from './Mockups.module.css'

function MockupDangAnalysis() {
  return (
    <div className={styles.mockDang}>
      {/* Sidebar */}
      <div className={styles.dangSidebar}>
        <div className={styles.dangSidebarLogo} />
        {[1, 2, 3].map((i) => (
          <div key={i} className={styles.dangSidebarItem} />
        ))}
      </div>

      {/* Main chat area */}
      <div className={styles.dangMain}>
        {/* AI message */}
        <div className={styles.dangMsgRow}>
          <div className={styles.dangAvatar} />
          <div className={styles.dangBubble}>
            <div className={styles.dangLine} style={{ width: '80%' }} />
            <div className={styles.dangLine} style={{ width: '65%' }} />
            <div className={styles.dangLine} style={{ width: '55%' }} />
          </div>
        </div>

        {/* Source card */}
        <div className={styles.dangSources}>
          {['知识库', '行情', '研报'].map((label) => (
            <div key={label} className={styles.dangSourceChip}>{label}</div>
          ))}
        </div>

        {/* User message */}
        <div className={styles.dangMsgRowUser}>
          <div className={styles.dangBubbleUser}>
            <div className={styles.dangLine} style={{ width: '70%', background: 'rgba(255,255,255,0.35)' }} />
            <div className={styles.dangLine} style={{ width: '50%', background: 'rgba(255,255,255,0.25)' }} />
          </div>
        </div>

        {/* Input bar */}
        <div className={styles.dangInput}>
          <div className={styles.dangInputPlaceholder} />
          <div className={styles.dangInputSend} />
        </div>
      </div>
    </div>
  )
}

export default MockupDangAnalysis
