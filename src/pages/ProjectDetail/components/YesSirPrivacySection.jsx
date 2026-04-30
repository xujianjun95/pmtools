import styles from '../ProjectDetail.module.css'

function YesSirPrivacySection({ project }) {
  if (project.id !== 'yessir') return null

  return (
    <section className={styles.detailPrivacy}>
      <span className="section-label fi">Privacy</span>
      <h2 className="section-title fi d1">隐私与数据安全政策</h2>

      <div className={`${styles.originCard} fi d3`}>
        <p className={styles.originPara}>
          您好！我是「Yes Sir」的开发者。作为一款旨在降低浏览器认知负担、提升管理效率的工具，我们深知网页浏览记录是您极其私密的数据。因此，我们在设计之初就确立了「本地优先、最小化权限、透明传输」的核心原则。
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
    </section>
  )
}

export default YesSirPrivacySection
