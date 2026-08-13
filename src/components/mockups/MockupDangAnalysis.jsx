import styles from './MockupDangAnalysis.module.css'

const QUERY = '帮我评估下紫金矿业的财报'

const METRICS = [
  { label: '成长性', value: '盈利扩张', tone: 'positive' },
  { label: '现金流', value: '质量改善', tone: 'positive' },
  { label: '估值', value: '中性区间', tone: 'neutral' },
]

function MockupDangAnalysis({ isActive = false }) {
  return (
    <div
      className={styles.demo}
      data-active={isActive ? 'true' : 'false'}
      role="img"
      aria-label="Dang Analysis 从输入紫金矿业财报问题、调用资料分析，到给出结构化投资判断的动态演示"
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
              <span className={styles.sideLine} />
              <span className={`${styles.sideLine} ${styles.sideLineShort}`} />
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
              <span className={styles.topStatus}>智能投资研究工作台</span>
              <span className={styles.onlineDot} />
            </div>

            <section className={styles.landingScene}>
              <div className={styles.heroCopy}>
                <span className={styles.eyebrow}>MR DANG · INVESTMENT RESEARCH</span>
                <strong>今天，想研究什么？</strong>
                <p>从行情、估值到历史文章，先找到依据，再形成判断。</p>
              </div>

              <div className={styles.composer}>
                <span className={styles.placeholder}>输入投资问题…</span>
                <span className={styles.typedQuery}>{QUERY}</span>
                <span className={styles.sendButton}>
                  ↑
                  <span className={`${styles.clickPulse} ${styles.sendClickPulse}`} aria-hidden="true" />
                </span>
              </div>

              <div className={styles.suggestions}>
                <span>紫金矿业的周期位置怎么看</span>
                <span>如何识别利润的真实质量</span>
                <span>当前市场最大的风险是什么</span>
              </div>
              <small className={styles.disclaimer}>回答仅供参考，不构成投资建议</small>
            </section>

            <section className={styles.answerScene}>
              <div className={styles.conversationTrack}>
                <div className={styles.questionBubble}>{QUERY}</div>

                <div className={styles.agentHeader}>
                  <span className={styles.agentMark}>D</span>
                  <span>
                    <b>Dang Analysis</b>
                    <small>正在综合财报、行情与历史研究</small>
                  </span>
                </div>

                <div className={styles.thinkingCard}>
                  <div className={styles.thinkingTitle}>
                    <span className={styles.thinkingOrb} />
                    <b>正在交叉核验</b>
                    <span className={styles.thinkingDots}><i /><i /><i /></span>
                  </div>
                  <div className={styles.thinkingSteps}>
                    <span>财报质量</span>
                    <span>行业周期</span>
                    <span>估值位置</span>
                  </div>
                </div>

                <article className={styles.answerCard}>
                  <div className={styles.answerTopline}>
                    <span className={styles.verdict}>基本面稳健 · 周期弹性仍在</span>
                    <span className={styles.demoLabel}>演示结论</span>
                  </div>

                  <h3>核心判断</h3>
                  <p>
                    盈利改善来自量价共振，但需要继续验证铜金价格持续性与海外项目兑现节奏。
                  </p>

                  <div className={styles.metrics}>
                    {METRICS.map((metric) => (
                      <div key={metric.label} className={styles.metric}>
                        <span>{metric.label}</span>
                        <b className={styles[metric.tone]}>{metric.value}</b>
                      </div>
                    ))}
                  </div>

                  <div className={styles.riskLine}>
                    <span>重点跟踪</span>
                    金铜价格 · 海外项目进度 · 资本开支
                  </div>

                  <div className={styles.sources}>
                    <span>年报摘要</span>
                    <span>机构一致预期</span>
                    <span>实时行情</span>
                  </div>
                </article>

                <div className={styles.reportReady}>
                  <span className={styles.reportIcon}>▤</span>
                  <span className={styles.reportReadyCopy}>
                    <b>紫金矿业财报评估报告</b>
                    <small>已完成 · 结构化研究报告</small>
                  </span>
                  <span className={styles.openReport}>
                    打开报告&nbsp; ↗
                    <span className={`${styles.clickPulse} ${styles.reportClickPulse}`} aria-hidden="true" />
                  </span>
                </div>
              </div>
            </section>

            <section className={styles.reportScene}>
              <div className={styles.reportToolbar}>
                <span>‹ 返回对话</span>
                <b>紫金矿业财报评估报告</b>
                <span className={styles.reportStatus}>报告已生成</span>
              </div>

              <div className={styles.reportPage}>
                <div className={styles.reportHeading}>
                  <span className={styles.skeletonEyebrow} />
                  <span className={styles.skeletonTitle} />
                  <span className={styles.skeletonMeta} />
                </div>

                <div className={styles.reportSummary}>
                  <div className={styles.summaryCopy}>
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className={styles.summaryScore} />
                </div>

                <div className={styles.reportKpis}>
                  {[0, 1, 2].map((item) => (
                    <div key={item} className={styles.reportKpi}>
                      <span />
                      <b />
                      <i />
                    </div>
                  ))}
                </div>

                <div className={styles.reportGrid}>
                  <div className={styles.chartCard}>
                    <div className={styles.chartHeader}><span /><i /></div>
                    <div className={styles.barChart}>
                      <i /><i /><i /><i /><i />
                    </div>
                  </div>
                  <div className={styles.reportTable}>
                    <div className={styles.tableHeader}><span /><span /><span /></div>
                    {[0, 1, 2].map((item) => (
                      <div key={item} className={styles.tableRow}>
                        <span /><span /><span />
                      </div>
                    ))}
                  </div>
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
