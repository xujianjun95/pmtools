import yessirIcon from '../../assets/mockups/yessir-icon.jpg'
import googleIcon from '../../assets/mockups/google.ico'
import appleIcon from '../../assets/mockups/apple.ico'
import microsoftIcon from '../../assets/mockups/microsoft.ico'
import githubIcon from '../../assets/mockups/github.ico'
import styles from './MockupYesSir.module.css'

const OPEN_TABS = [
  ['G', 'Google'],
  ['A', 'Apple'],
  ['M', 'Microsoft'],
  ['G', 'GitHub'],
  ['A', 'Amazon'],
  ['N', 'Netflix'],
  ['A', 'Adobe'],
  ['S', 'Slack'],
  ['F', 'Figma'],
  ['Y', 'YouTube'],
]

const TAB_GROUPS = [
  { label: '工作', count: 3, className: 'workGroup' },
  { label: '设计', count: 4, className: 'designGroup' },
  { label: '研究', count: 3, className: 'researchGroup' },
]

function MockupYesSir({ isActive = false }) {
  return (
    <div
      className={styles.demo}
      data-active={isActive ? 'true' : 'false'}
      role="img"
      aria-label="YesSir 将拥挤的浏览器标签页通过 AI 聚合整理成多个标签组的动态演示"
    >
      <div className={styles.backdrop} aria-hidden="true" />

      <div className={styles.browserWindow} aria-hidden="true">
        <div className={styles.browserTabsBar}>
          <div className={styles.windowControls}>
            <span />
            <span />
            <span />
          </div>

          <div className={styles.tabsStage}>
            <div className={styles.openTabs}>
              {OPEN_TABS.map(([icon, label], index) => (
                <div
                  key={`${label}-${index}`}
                  className={`${styles.browserTab}${index === 0 ? ` ${styles.activeBrowserTab}` : ''}`}
                >
                  <span className={styles.browserTabIcon}>{icon}</span>
                  <span className={styles.browserTabLabel}>{label}</span>
                  <span className={styles.browserTabClose}>×</span>
                </div>
              ))}
            </div>

            <div className={styles.groupedTabs}>
              {TAB_GROUPS.map((group) => (
                <div
                  key={group.label}
                  className={`${styles.browserTabGroup} ${styles[group.className]}`}
                >
                  <span className={styles.browserGroupLabel}>{group.label}</span>
                  <span className={styles.browserGroupCount}>{group.count}</span>
                  <span className={styles.groupTabDot} />
                  <span className={styles.groupTabDot} />
                  <span className={styles.groupTabDot} />
                </div>
              ))}
            </div>
          </div>

          <span className={styles.newTab}>+</span>
        </div>

        <div className={styles.browserToolbar}>
          <div className={styles.toolbarNav}>
            <span>‹</span>
            <span>›</span>
            <span>↻</span>
          </div>
          <div className={styles.addressBar}>
            <span className={styles.lockMark}>◇</span>
            <span>newtab</span>
          </div>
          <span className={styles.browserMenu}>⋮</span>
        </div>

        <div className={styles.pageCanvas}>
          <div className={styles.pageTopline}>
            <span className={styles.placeholderBrand} />
            <div className={styles.placeholderNavGroup}>
              <i />
              <i />
              <i />
            </div>
            <span className={styles.placeholderNavAction} />
          </div>
          <div className={styles.pageBody}>
            <section className={styles.placeholderHero}>
              <div className={styles.placeholderCopyStack}>
                <span className={styles.placeholderEyebrow} />
                <span className={styles.placeholderTitle} />
                <span className={styles.placeholderTitleShort} />
                <span className={styles.placeholderCopy} />
                <span className={styles.placeholderButton} />
              </div>
              <span className={styles.placeholderVisual} />
            </section>

            <div className={styles.pageCards}>
              {[1, 2, 3].map((item) => (
                <div key={item}>
                  <i />
                  <span />
                  <small />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.groupCompleteBadge}>
          <span>✓</span>
          已创建 3 个标签组
        </div>
      </div>

      <div className={styles.panel} aria-hidden="true">
        <header className={styles.header}>
          <div className={styles.topLine}>
            <div className={styles.brand}>
              <img className={styles.brandIcon} src={yessirIcon} alt="" />
              <strong>YesSir</strong>
              <span className={styles.brandProduct}>标签页管理</span>
            </div>

            <div className={styles.actions}>
              <span className={styles.aiButton}>
                🤖 <b>AI 聚合</b>
                <span className={styles.clickPulse} aria-hidden="true" />
              </span>
              <span className={styles.iconButton}>💊</span>
              <span className={styles.iconButton}>⚙️</span>
            </div>
          </div>

          <div className={styles.searchBar}>
            <span className={styles.searchIcon} />
            <span className={styles.queryText}>搜索标题、URL 或域名...</span>
            <span className={styles.searchHint}>
              按 Tab 切换 <b>网页搜索模式</b>
            </span>
          </div>

          <div className={styles.categoryBar}>
            <span className={`${styles.pill} ${styles.allPill}`}>全部·15</span>
            <span className={styles.pill}>⌕ 搜索与办公·4</span>
            <span className={styles.pill}>◈ 设计工具·3</span>
            <span className={styles.pill}>⌘ 开发平台·4</span>
            <span className={styles.pill}>其他·4</span>
          </div>
        </header>

        <div className={styles.listViewport}>
          <div className={styles.listTrack}>
            <section className={styles.tabGroup}>
              <div className={styles.groupTitle}>常用网站</div>
              <div className={styles.tabRow}>
                <img className={styles.companyIcon} src={googleIcon} alt="" />
                <span className={styles.tabName}>Google</span>
                <span className={styles.aiSummaryTag}>搜索引擎</span>
              </div>
              <div className={styles.tabRow}>
                <img className={styles.companyIcon} src={appleIcon} alt="" />
                <span className={styles.tabName}>Apple</span>
                <span className={styles.aiSummaryTag}>品牌官网</span>
              </div>
            </section>

            <section className={styles.tabGroup}>
              <div className={styles.groupTitle}>工作与开发</div>
              <div className={`${styles.tabRow} ${styles.companyActiveRow}`}>
                <img className={styles.companyIcon} src={microsoftIcon} alt="" />
                <span className={styles.tabName}>Microsoft 365</span>
                <span className={styles.aiSummaryTag}>办公套件</span>
                <span className={styles.activeDot} />
              </div>
              <div className={styles.tabRow}>
                <img className={styles.companyIcon} src={githubIcon} alt="" />
                <span className={styles.tabName}>GitHub</span>
                <span className={styles.aiSummaryTag}>开发平台</span>
              </div>
            </section>
          </div>
        </div>

        <footer className={styles.footer}>
          <div className={styles.previousTab}>
            <span>上一个标签页：</span>
            <img className={styles.footerCompanyIcon} src={githubIcon} alt="" />
            <strong>GitHub</strong>
          </div>
          <span className={styles.quickSwitch}>Command + E 快速切回</span>
        </footer>

      </div>

      <div className={styles.processingToast} aria-hidden="true">
        <span className={styles.toastEmojiSlot}>
          <span className={`${styles.toastEmoji} ${styles.toastEmojiOne}`}>🫡</span>
          <span className={`${styles.toastEmoji} ${styles.toastEmojiTwo}`}>🔍</span>
          <span className={`${styles.toastEmoji} ${styles.toastEmojiThree}`}>🧩</span>
        </span>
        <strong>YesSir，正在整理 15 个标签页，请稍作等待…</strong>
      </div>
    </div>
  )
}

export default MockupYesSir
