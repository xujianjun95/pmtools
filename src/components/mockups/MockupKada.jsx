import styles from './MockupKada.module.css'

const CODE_LINES = [
  [
    ['tag', '<main'],
    ['attr', ' class'],
    ['plain', '='],
    ['string', '"hero"'],
    ['tag', '>'],
  ],
  [
    ['tag', '  <span'],
    ['attr', ' class'],
    ['plain', '='],
    ['string', '"eyebrow"'],
    ['tag', '>'],
    ['plain', 'SNAPBUILD'],
    ['tag', '</span>'],
  ],
  [
    ['tag', '  <h1>'],
    ['plain', 'Build ideas faster.'],
    ['tag', '</h1>'],
  ],
  [
    ['tag', '  <p>'],
    ['plain', 'From code to a live page in seconds.'],
    ['tag', '</p>'],
  ],
  [
    ['tag', '  <button>'],
    ['plain', 'Start building'],
    ['tag', '</button>'],
  ],
  [['tag', '</main>']],
  [
    ['selector', '.hero'],
    ['plain', ' { '],
    ['attr', 'padding'],
    ['plain', ': '],
    ['number', '72px'],
    ['plain', '; }'],
  ],
]

function PreviewPage({ compact = false }) {
  return (
    <div className={`${styles.previewPage}${compact ? ` ${styles.compactPreview}` : ''}`}>
      <div className={styles.previewHero}>
        <span className={`${styles.previewPart} ${styles.previewEyebrow}`} style={{ '--part': 0 }}>
          LIGHTWEIGHT WORKSPACE
        </span>
        <strong className={`${styles.previewPart} ${styles.previewTitle}`} style={{ '--part': 1 }}>
          Build ideas faster.
        </strong>
        <p className={`${styles.previewPart} ${styles.previewCopy}`} style={{ '--part': 2 }}>
          From code to a live page in seconds.
        </p>
        <span className={`${styles.previewPart} ${styles.previewButton}`} style={{ '--part': 3 }}>
          Start building <b>→</b>
        </span>
      </div>
      <div className={styles.previewCards}>
        <span className={styles.previewPart} style={{ '--part': 4 }} />
        <span className={styles.previewPart} style={{ '--part': 5 }} />
        <span className={styles.previewPart} style={{ '--part': 6 }} />
      </div>
    </div>
  )
}

function MockupKada({ isActive = false }) {
  return (
    <div
      className={styles.demo}
      data-active={isActive ? 'true' : 'false'}
      role="img"
      aria-label="咔哒从代码输入、实时预览到生成分享链接并在浏览器打开的动态演示"
    >
      <div className={styles.workspace} aria-hidden="true">
        <section className={styles.editorPanel}>
          <header className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <span className={styles.codeMark}>&lt;/&gt;</span>
              <strong>代码编辑器</strong>
            </div>
            <div className={styles.editorActions}>
              <span>清空代码</span>
              <span className={styles.formatAction}>格式化代码</span>
              <span className={styles.splitAction}>分割代码</span>
              <span className={styles.exportAction}>导入&amp;导出</span>
            </div>
          </header>

          <div className={styles.editorBody}>
            <aside className={styles.editorSidebar}>
              <span className={styles.activeTool}>&lt;/&gt;</span>
              <span>□</span>
              <span>T</span>
              <span>↗</span>
              <span>⌁</span>
            </aside>
            <div className={styles.codeViewport}>
              <div className={styles.codeGuide}>输入 HTML，右侧即可实时预览</div>
              <div className={styles.codeLines}>
                {CODE_LINES.map((tokens, lineIndex) => (
                  <div
                    key={`line-${lineIndex}`}
                    className={styles.codeLine}
                    style={{ '--line': lineIndex }}
                  >
                    <span className={styles.lineNumber}>{lineIndex + 1}</span>
                    <code>
                      {tokens.map(([type, value], tokenIndex) => (
                        <span key={`${lineIndex}-${tokenIndex}`} className={styles[type]}>
                          {value}
                        </span>
                      ))}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <span className={styles.resizer} />

        <section className={styles.previewPanel}>
          <header className={`${styles.panelHeader} ${styles.previewHeader}`}>
            <div className={styles.panelTitle}>
              <span className={styles.previewMark}>◇</span>
              <strong>实时预览</strong>
            </div>
            <div className={styles.previewActions}>
              <span>工具栏</span>
              <span>草图</span>
              <span>截图</span>
              <span>全屏</span>
            </div>
          </header>
          <PreviewPage />
          <span className={styles.shareButton}>
            ↗&nbsp; 分享
            <span className={styles.shareClickPulse} aria-hidden="true" />
          </span>
        </section>
      </div>

      <div className={styles.shareBackdrop} aria-hidden="true" />
      <div className={styles.shareModal} aria-hidden="true">
        <div className={styles.shareModalHeader}>
          <strong>分享</strong>
          <span>×</span>
        </div>
        <div className={styles.shareModalCopy}>
          <span />
          <span />
        </div>
        <div className={styles.shareModalHint}>
          <i />
          <span />
        </div>
        <div className={styles.shareModalUrl}>
          <span />
          <span />
        </div>
        <div className={styles.shareModalActions}>
          <span />
          <span className={styles.openShareLinkButton}>
            打开分享链接
            <i className={styles.openLinkClickPulse} />
          </span>
        </div>
      </div>

      <div className={styles.sharedBrowser} aria-hidden="true">
        <div className={styles.browserChrome}>
          <div className={styles.windowDots}><span /><span /><span /></div>
          <div className={styles.browserAddress}>
            <span>◇</span>
            pmtools.com.cn/kada/view/8f2a
          </div>
          <span className={styles.browserOpen}>↗</span>
        </div>
        <div className={styles.browserCanvas}>
          <PreviewPage compact />
        </div>
      </div>
    </div>
  )
}

export default MockupKada
