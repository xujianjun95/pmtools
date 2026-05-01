import { useState } from 'react'
import styles from '../ProjectDetail.module.css'

function YesSirPrivacySection({ project }) {
  const [language, setLanguage] = useState('zh')
  const [isExpanded, setIsExpanded] = useState(false)

  if (project.id !== 'yessir') return null
  const toggleLabel =
    language === 'zh'
      ? (isExpanded ? '收起完整政策 ↑' : '阅读完整政策 ↓')
      : (isExpanded ? 'Collapse full policy ↑' : 'Read full policy ↓')

  return (
    <section className={styles.detailPrivacy}>
      <span className="section-label fi">Privacy</span>
      <h2 className="section-title fi d1">隐私与数据安全政策</h2>

      <div className={`${styles.originCard} fi d3`}>
        <div className={styles.privacyLangSwitch} role="group" aria-label="选择语言">
          <div className={styles.privacySwitchTrack}>
            <span
              className={styles.privacySwitchThumb}
              style={{ transform: language === 'en' ? 'translateX(100%)' : 'translateX(0)' }}
              aria-hidden="true"
            />
            <button
              type="button"
              className={`${styles.privacyLangBtn} ${language === 'zh' ? styles.privacyLangBtnActive : ''}`}
              onClick={() => setLanguage('zh')}
            >
              中文
            </button>
            <button
              type="button"
              className={`${styles.privacyLangBtn} ${language === 'en' ? styles.privacyLangBtnActive : ''}`}
              onClick={() => setLanguage('en')}
            >
              English
            </button>
          </div>
        </div>


        {language === 'zh' ? (
          <>
            <div
              className={`${styles.privacyContentWrapper} ${
                isExpanded ? styles.expanded : styles.collapsed
              }`}
            >
            <p className={styles.originPara}>
          您好！我是「YesSir」的开发者。作为一款旨在降低浏览器认知负担、提升管理效率的工具，我们深知网页浏览记录是您极其私密的数据。因此，我们在设计之初就确立了「本地优先、最小化权限、透明传输」的核心原则。
            </p>
            <p className={styles.originPara}>
          本政策旨在向您清晰解释我们会接触到哪些数据，以及这些数据是如何流转的。
            </p>

            <div className={styles.privacySection}>
              <h3 className={styles.privacyH3}>📦 1. 数据存储：核心数据的本地化</h3>
              <p className={styles.originPara}>
                「Yes Sir」所产生的核心业务数据，均仅存储在您的浏览器本地（Local Storage），我们没有也不会建立任何中央数据库来收集您的具体浏览信息。这些本地数据包括：
              </p>
              <ul className={styles.privacyList}>
                <li>您的界面设置与偏好（如快捷键配置、悬浮窗开关等）。</li>
                <li>您配置的私人 DeepSeek API Key（如果您选择了自行配置）。</li>
                <li>近期被 AI 处理过的网页标签缓存（用于提升二次打开看板的加载速度）。</li>
              </ul>
            </div>
            <div className={styles.privacyHiddenContent}>
            <div className={styles.privacySection}>
          <h3 className={styles.privacyH3}>🤖 2. AI 功能与数据传输双轨制</h3>
          <p className={styles.originPara}>
            为了实现诸如「AI 聚合」、「语义搜索」和「页面标签提取」等高级功能，我们需要将相关的网页信息（仅限网页的标题 Title、网址 URL 和域名）发送给大语言模型（DeepSeek）。
          </p>
          <p className={styles.originPara}>根据您的配置情况，数据流向分为以下两种模式：</p>

          <div className={styles.originPoint}>
            <h4 className={styles.privacyModeTitle}>🔒 模式 A：直连模式（自带 API Key）</h4>
            <p className={styles.originPara}>
              如果您在插件设置中填入了您自己的 DeepSeek API Key，插件会直接与 api.deepseek.com 通信。这期间，您的请求数据不会经过作者的任何服务器，完全是您与模型提供商之间的点对点通信。
            </p>
          </div>

          <div className={styles.originPoint}>
            <h4 className={styles.privacyModeTitle}>☁️ 模式 B：中转模式（开箱即用免配置）</h4>
            <p className={styles.originPara}>
              为了让新用户无需配置即可体验 AI 功能，我们提供了一个官方中转服务。当您使用此模式时：
            </p>
            <ul className={styles.privacyList}>
              <li>
                <strong className={styles.privacyStrong}>防滥用限流：</strong>
                插件仅会在本地生成一个随机的设备标识（UUID）用于防滥用限流。
              </li>
              <li>
                <strong className={styles.privacyStrong}>数据阅后即焚：</strong>
                中转服务器仅负责透明转发请求。我们绝不持久化存储、不记录日志、不分析任何您发送的具体网页数据及模型返回的结果。
              </li>
            </ul>
          </div>
            </div>

            <div className={styles.privacySection}>
          <h3 className={styles.privacyH3}>📊 3. 数据收集与基础统计</h3>
          <p className={styles.originPara}>
            为了更好地了解扩展程序的使用情况并持续改进产品体验，Yes Sir 会收集极少量的匿名统计数据：
          </p>
          <ul className={styles.privacyList}>
            <li>
              <strong className={styles.privacyStrong}>我们收集什么：</strong>
              在您首次安装、更新或每日首次启动扩展时，会向我们的服务器发送一次包含随机匿名设备标识符 (UUID)、扩展版本号以及事件类型（如「安装」、「启动」）的 Ping 请求。
            </li>
            <li>
              <strong className={styles.privacyStrong}>数据用途：</strong>
              仅用于统计全局的插件新增安装量和每日独立活跃设备数。
            </li>
            <li>
              <strong className={styles.privacyStrong}>不持久化 IP：</strong>
              服务器在建立连接时会自动接收 IP 地址，但仅用于基础的防滥用保护，绝不会被持久化追踪或与您的 UUID 进行身份绑定。
            </li>
          </ul>
            </div>

            <div className={styles.privacySection}>
          <h3 className={styles.privacyH3}>🛡️ 4. 权限使用声明</h3>
          <p className={styles.originPara}>我们在 manifest.json 中申请的权限均有明确且克制的功能用途：</p>
          <ul className={styles.privacyPermList}>
            <li>
              <span className={styles.privacyPermName}>tabs / windows / tabGroups</span>
              <span className={styles.privacyPermDesc}>
                用于读取当前打开的标签页列表，执行跨窗口切换以及自动为您创建标签组。
              </span>
            </li>
            <li>
              <span className={styles.privacyPermName}>storage</span>
              <span className={styles.privacyPermDesc}>
                用于在本地保存您的快捷键、缓存数据、API Key 以及匿名 UUID。
              </span>
            </li>
            <li>
              <span className={styles.privacyPermName}>sessions</span>
              <span className={styles.privacyPermDesc}>用于实现「后悔药」功能，帮您一键恢复最近关闭的标签页。</span>
            </li>
            <li>
              <span className={styles.privacyPermName}>search</span>
              <span className={styles.privacyPermDesc}>用于在「网页搜索模式」下调用浏览器的默认搜索引擎。</span>
            </li>
            <li>
              <span className={styles.privacyPermName}>favicon</span>
              <span className={styles.privacyPermDesc}>用于在面板列表中获取并展示对应网站的图标。</span>
            </li>
            <li>
              <span className={styles.privacyPermName}>host_permissions</span>
              <span className={styles.privacyPermDesc}>
                仅允许与 DeepSeek 官方接口及我们的专属中转/统计服务器通信，防止数据外泄到其他未知节点。
              </span>
            </li>
          </ul>
            </div>

            <div className={styles.privacySection}>
          <h3 className={styles.privacyH3}>❌ 5. 我们坚决不做什么</h3>
          <ul className={styles.privacyList}>
            <li>
              <strong className={styles.privacyStrong}>不收集用户画像：</strong>
              UUID 绝对无法关联到您的真实身份、账号或个人信息，我们不知道您是谁。
            </li>
            <li>
              <strong className={styles.privacyStrong}>无第三方数据买卖：</strong>
              我们收集的匿名统计数据仅供内部决策优化，绝不向任何第三方出售、出租或交易。
            </li>
            <li>
              <strong className={styles.privacyStrong}>不收集页面正文内容：</strong>
              AI 识别仅依赖网页的标题（Title）和链接（URL），绝不会读取您正在浏览的网页正文、密码或聊天记录。
            </li>
          </ul>
            </div>

            <div className={styles.privacySection}>
          <h3 className={styles.privacyH3}>💬 6. 联系与反馈</h3>
          <p className={styles.originPara}>
            如果您对隐私保护有任何疑问、建议或发现了潜在问题，欢迎随时与我联系交流。
          </p>
          <p className={styles.privacyContact}>
            <span className={styles.privacyContactLabel}>👉 邮箱：</span>
            <a href="mailto:xujianjun1995@gmail.com" className={styles.privacyEmail}>
              xujianjun1995@gmail.com
            </a>
          </p>
            </div>
            </div>
            {!isExpanded && <div className={styles.fadeOverlay} aria-hidden="true" />}
            </div>
          </>
        ) : (
          <div className={styles.privacyEnBlock}>
            <div
              className={`${styles.privacyContentWrapper} ${
                isExpanded ? styles.expanded : styles.collapsed
              }`}
            >
            <p className={styles.originPara}>
            Hello! I am the developer of the "YesSir" extension. As a tool designed to reduce cognitive load and improve
            tab management efficiency, we deeply understand that your browsing history is highly private data. Therefore,
            from the very beginning, we established the core principles of "Local First, Minimal Permissions, and
            Transparent Transmission".
            </p>
            <p className={styles.originPara}>
            This policy aims to clearly explain what data we access and how this data flows.
            </p>

            <div className={styles.privacySection}>
            <h3 className={styles.privacyH3}>📦 1. Data Storage: Core Data Localization</h3>
            <p className={styles.originPara}>
              The core business data generated by "Yes Sir" is stored exclusively in your browser's Local Storage. We do
              not and will not build any centralized database to collect your specific browsing information. This local data
              includes:
            </p>
            <ul className={styles.privacyList}>
              <li>Your UI settings and preferences (e.g., shortcut configurations, floating widget toggle).</li>
              <li>Your personal DeepSeek API Key (if you choose to configure one yourself).</li>
              <li>Cached page labels and categorizations processed by AI.</li>
            </ul>
            </div>
            <div className={styles.privacyHiddenContent}>
            <div className={styles.privacySection}>
            <h3 className={styles.privacyH3}>🤖 2. AI Features & Data Transmission Dual-Track System</h3>
            <p className={styles.originPara}>
              To implement advanced features such as "AI Aggregation" and "Semantic Search," we need to send relevant web
              page information (strictly limited to Page Title, URL, and Domain) to a Large Language Model (DeepSeek).
            </p>
            <p className={styles.originPara}>Depending on your configuration, the data flow falls into two modes:</p>

            <div className={styles.originPoint}>
              <h4 className={styles.privacyModeTitle}>🔒 Mode A: Direct Connection (Bring Your Own API Key)</h4>
              <p className={styles.originPara}>
                If you enter your own DeepSeek API Key in the settings, the extension communicates directly with
                api.deepseek.com. Your request data will not pass through any of our servers.
              </p>
            </div>

            <div className={styles.originPoint}>
              <h4 className={styles.privacyModeTitle}>☁️ Mode B: Relay Mode (Out-of-the-box, No Configuration)</h4>
              <p className={styles.originPara}>
                To allow new users to experience AI features effortlessly, we provide an official relay service:
              </p>
              <ul className={styles.privacyList}>
                <li>
                  <strong className={styles.privacyStrong}>Abuse Prevention:</strong>
                  {' '}
                  The extension generates a random device identifier (UUID) locally solely for daily rate limits.
                </li>
                <li>
                  <strong className={styles.privacyStrong}>Burn-After-Reading:</strong>
                  {' '}
                  The relay server only acts as a transparent proxy. We absolutely do not persistently store, log, or
                  analyze any specific webpage data you send or the results returned by the model.
                </li>
              </ul>
            </div>
            </div>

            <div className={styles.privacySection}>
            <h3 className={styles.privacyH3}>📊 3. Data Collection and Basic Analytics</h3>
            <p className={styles.originPara}>
              To better understand extension usage and continuously improve product experience, Yes Sir collects a minimal
              amount of anonymous telemetry data:
            </p>
            <ul className={styles.privacyList}>
              <li>
                <strong className={styles.privacyStrong}>What we collect:</strong>
                {' '}
                When you first install, update, or launch the extension for the first time each day, it sends a single ping
                to our server containing a randomly generated anonymous device identifier (UUID), extension version, and
                event type (e.g., "install", "startup").
              </li>
              <li>
                <strong className={styles.privacyStrong}>Purpose:</strong>
                {' '}
                Strictly used for counting total new installations and daily active independent devices.
              </li>
              <li>
                <strong className={styles.privacyStrong}>No IP Persistence:</strong>
                {' '}
                IP addresses are received by the server during connection for basic security and abuse prevention, but they
                are never persistently tracked or tied to your UUID.
              </li>
            </ul>
            </div>

            <div className={styles.privacySection}>
            <h3 className={styles.privacyH3}>🛡️ 4. Permission Usage Declaration</h3>
            <p className={styles.originPara}>
              The permissions we request in manifest.json have explicit and restrained functional purposes:
            </p>
            <ul className={styles.privacyPermList}>
              <li>
                <span className={styles.privacyPermName}>tabs / windows / tabGroups</span>
                <span className={styles.privacyPermDesc}>
                  Used to read open tabs, execute cross-window switching, and automatically create tab groups.
                </span>
              </li>
              <li>
                <span className={styles.privacyPermName}>storage</span>
                <span className={styles.privacyPermDesc}>
                  Used to save your shortcuts, cached data, API Key, and anonymous UUID locally.
                </span>
              </li>
              <li>
                <span className={styles.privacyPermName}>sessions</span>
                <span className={styles.privacyPermDesc}>Used to implement the "Regret Pill" feature.</span>
              </li>
              <li>
                <span className={styles.privacyPermName}>search</span>
                <span className={styles.privacyPermDesc}>
                  Used to call your browser's default search engine in "Web Search Mode".
                </span>
              </li>
              <li>
                <span className={styles.privacyPermName}>favicon</span>
                <span className={styles.privacyPermDesc}>Used to fetch and display website icons in the dashboard list.</span>
              </li>
              <li>
                <span className={styles.privacyPermName}>host_permissions</span>
                <span className={styles.privacyPermDesc}>
                  Strictly limits communication to the official DeepSeek API and our relay/analytics server to prevent data
                  leakage.
                </span>
              </li>
            </ul>
            </div>

            <div className={styles.privacySection}>
            <h3 className={styles.privacyH3}>❌ 5. What We Strictly DO NOT Do</h3>
            <ul className={styles.privacyList}>
              <li>
                <strong className={styles.privacyStrong}>No User Profiling:</strong>
                {' '}
                The UUID cannot be linked to your real identity, accounts, or personal information. We do not know who you
                are.
              </li>
              <li>
                <strong className={styles.privacyStrong}>No Third-Party Data Selling:</strong>
                {' '}
                The anonymous statistics collected are strictly for internal decision-making and will never be sold, rented,
                or traded to any third party.
              </li>
              <li>
                <strong className={styles.privacyStrong}>No Page Content Collection:</strong>
                {' '}
                AI recognition relies solely on the page's Title and URL. It will never read the main content, passwords, or
                chat history of the pages you are browsing.
              </li>
            </ul>
            </div>

            <div className={styles.privacySection}>
            <h3 className={styles.privacyH3}>💬 6. Contact & Feedback</h3>
            <p className={styles.originPara}>
              If you have any questions, suggestions, or discover potential issues regarding privacy protection, please feel
              free to contact me at any time.
            </p>
            <p className={styles.privacyContact}>
              <span className={styles.privacyContactLabel}>👉 Email:</span>
              {' '}
              <a href="mailto:xujianjun1995@gmail.com" className={styles.privacyEmail}>
                xujianjun1995@gmail.com
              </a>
            </p>
            </div>
            </div>
            {!isExpanded && <div className={styles.fadeOverlay} aria-hidden="true" />}
            </div>
          </div>
        )}
        <div className={styles.privacyActionArea}>
          <button
            type="button"
            className={styles.privacyToggleButton}
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            {toggleLabel}
          </button>
        </div>
      </div>
    </section>
  )
}

export default YesSirPrivacySection
