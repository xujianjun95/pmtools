import styles from './MockupDangAnalysis.module.css'

const QUERY = '帮我评估下紫金矿业的财报'

const SUGGESTIONS = [
  { icon: '↗', text: '贵州茅台当前估值合理吗' },
  { icon: '⌁', text: 'AI 产业链目前最值得看哪一环' },
  { icon: '▤', text: '如何搭建一套稳健的投资组合' },
  { icon: '◇', text: '自由现金流为什么比利润更重要' },
]

const THINKING_STEPS = [
  '正在思考…',
  '获取估值与研报：紫金矿业',
  '联网搜索：紫金矿业最新财报',
  '用方法论分析中…',
]

const SOURCE_LABELS = [
  '紫金矿业最新财报',
  '公司公告与研报',
]

function MockupDangAnalysis({ isActive = false }) {
  return (
    <div
      className={styles.demo}
      data-active={isActive ? 'true' : 'false'}
      role="img"
      aria-label="Dang Analysis 从首页输入投资问题、展示真实思考步骤、流式输出回答并在完成后显示参考来源的动态演示"
    >
      <div className={styles.camera} aria-hidden="true">
        <div className={styles.appShell}>
          <aside className={styles.sidebar}>
            <div className={styles.brand}>
              <strong>Dang Analysis</strong>
              <span>INVESTMENT RESEARCH</span>
            </div>

            <div className={styles.sideActions}>
              <div className={`${styles.sideItem} ${styles.sideItemActive}`}>
                <span className={styles.sideIcon}>＋</span>
                <span>新对话</span>
              </div>
              <div className={styles.sideItem}>
                <span className={styles.sideIcon}>◇</span>
                <span>知识库</span>
              </div>
            </div>

            <div className={styles.sideSection}>
              <span className={styles.sideLabel}>今天</span>
              <span className={`${styles.sideLine} ${styles.sideLinePlaceholder}`} />
              <span className={styles.sideConversation}>紫金矿业财报</span>
            </div>

            <div className={styles.userRow}>
              <span className={styles.userAvatar}>D</span>
              <span className={styles.userCopy}>
                <b>dang</b>
                <small>内测用户</small>
              </span>
              <span className={styles.userMenu}>···</span>
            </div>
          </aside>

          <main className={styles.mainPanel}>
            <div className={styles.topBar}>
              <span className={styles.topTitle}>紫金矿业财报</span>
              <span className={styles.topCount}>2</span>
            </div>

            <section className={styles.landingScene}>
              <div className={styles.heroCopy}>
                <span className={styles.eyebrow}>MR DANG · INVESTMENT RESEARCH</span>
                <strong>今天，想研究什么？</strong>
                <p>从行情、估值到历史文章，先找到依据，再形成判断。</p>
              </div>

              <div className={styles.composer}>
                <span className={styles.placeholder}>输入公司、行业、文章标题，或直接描述你的问题…</span>
                <span className={styles.typedQuery}>{QUERY}</span>
                <span className={styles.sendButton}>
                  ↑
                  <span className={`${styles.clickPulse} ${styles.sendClickPulse}`} />
                </span>
              </div>

              <div className={styles.suggestions}>
                {SUGGESTIONS.map((suggestion) => (
                  <span key={suggestion.text}>
                    <i aria-hidden="true">{suggestion.icon}</i>
                    <b>{suggestion.text}</b>
                  </span>
                ))}
              </div>
              <small className={styles.disclaimer}>回答仅供参考，不构成投资建议</small>
            </section>

            <section className={styles.answerScene}>
              <div className={styles.conversationTrack}>
                <div className={styles.questionBubble}>{QUERY}</div>

                <div className={styles.thinkingBlock}>
                  <div className={styles.thinkingPill}>
                    <span className={styles.thinkingOrb} />
                    <b>思考中…</b>
                    <span className={styles.thinkingElapsed}>2s</span>
                    <span className={styles.thinkingChevron}>⌄</span>
                  </div>

                  <div className={styles.thinkingSteps}>
                    {THINKING_STEPS.map((step, index) => (
                      <div
                        key={step}
                        className={`${styles.thinkingStep} ${index === THINKING_STEPS.length - 1 ? styles.thinkingStepActive : ''}`}
                      >
                        <span className={styles.stepMark} aria-hidden="true">
                          {index === THINKING_STEPS.length - 1 ? '···' : '✓'}
                        </span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.completedThinking}>
                  <span>已完成 3s</span>
                  <span className={styles.completedChevron}>⌄</span>
                </div>

                <article className={styles.answerStream}>
                  <h3>核心判断</h3>
                  <p className={`${styles.streamLine} ${styles.streamLineOne}`}>
                    我会先结合财报、估值与近期公开资料，拆开看盈利质量、行业周期和估值位置。
                  </p>
                  <p className={`${styles.streamLine} ${styles.streamLineTwo}`}>
                    再把关键依据逐条列出，区分已经确认的事实与仍需验证的判断。
                  </p>
                  <div className={styles.streamList}>
                    <span><b>盈利质量</b> 看利润与经营现金流是否同步。</span>
                    <span><b>周期位置</b> 结合行业数据与公司经营变化判断。</span>
                    <span><b>估值位置</b> 放回历史区间与风险边界中观察。</span>
                  </div>
                  <span className={styles.streamingCursor} />
                </article>

                <div className={styles.sourceBlock}>
                  <div className={styles.sourceHeading}>参考来源 · 2</div>
                  <div className={styles.sourceList}>
                    {SOURCE_LABELS.map((label, index) => (
                      <span key={label}>
                        [{index + 1}] {label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className={styles.feedbackRow}>
                  <span className={styles.feedbackButton}>♧</span>
                  <span className={styles.feedbackButton}>⌁</span>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

export default MockupDangAnalysis
