export const projects = [
  {
    id: 'yessir',
    number: '01',
    title: 'YesSir',
    tagline: 'Chrome 标签页管理 · AI 聚合搜索',
    description:
      'Chrome 浏览器插件，重新定义标签页管理体验。集成 AI 聚合搜索能力，让信息获取更高效。',
    detailDescription:
      '一款 Chrome 浏览器插件，重新定义标签页管理体验。集成 AI 聚合搜索能力，让信息获取更高效、更智能。',
    tags: ['Chrome Extension', 'AI', '标签页管理'],
    techStack: [
      'Chrome Extension API',
      'Manifest V3',
      'JavaScript',
      'HTML / CSS',
      'AI Search',
    ],
    stats: [
      { value: 'Chrome', label: 'Extension' },
      { value: 'AI', label: '聚合搜索' },
      { value: '标签页', label: '管理工具' },
    ],
    features: [
      {
        title: '🧠 AI 跨窗口智能分组',
        description:
          '一键自动梳理堆叠的标签页。AI 引擎可跨越多个 Chrome 窗口，将散落各处的同类网页（如研发工具、邮件通讯）智能聚合归类。',
      },
      {
        title: '🔍 模糊意图语义检索',
        description:
          '记不清网页标题？只需输入模糊意图（如“昨天打开的报表”），即可在全量窗口中精准匹配。支持 Cmd/Ctrl + E 极速切换对比最近标签。',
      },
      {
        title: '⚡ 极客级指尖微操',
        description:
          '彻底告别寻找标签栏“小叉号”的繁琐。双击修饰键呼出面板，或按住修饰键双击页面任意空白处秒关网页，回归最纯粹的跟手效率。',
      },
      {
        title: '✨ 沉浸体验与防呆机制',
        description:
          '全景高级感毛玻璃（Glassmorphism）UI。内置「💊 后悔药」一键还原误关网页，辅以 5 日效率可视化看板，数字生活轨迹一目了然。',
      },
    ],
    links: {
      project:
        'https://chromewebstore.google.com/detail/%E6%A0%87%E7%AD%BE%E9%A1%B5ai%E8%87%AA%E5%8A%A8%E5%88%86%E7%BB%84%E8%B7%A8%E7%AA%97%E5%8F%A3%E7%AE%A1%E7%90%86%E5%BF%AB%E9%80%9F%E5%88%87%E6%8D%A2%E5%8F%8C%E5%87%BB%E5%85%B3%E9%97%AD%E6%99%BA%E8%83%BD%E8%AF%AD/ggdplmigmgopdecjadbgakofifnonacb?authuser=0&hl=zh-CN',
      source: '#',
    },
    mockupType: 'yessir',
  },
  {
    id: 'dang-analysis',
    number: '02',
    title: 'Dang Analysis',
    tagline: 'Mr Dang 投资分析智能体',
    description: '以 Mr Dang 的视角分析 A 股投资机会。输入任意问题，系统自动调取实时行情、机构研报与知识库，输出符合 Dang 老师风格的投资判断。',
    detailDescription: '以 Mr Dang 的视角分析 A 股投资机会。Agentic Loop 两阶段决策引擎自动调取实时行情、机构研报、热点题材与 213 篇原创知识库，用 Dang 老师的语气和框架输出投资判断。',
    tags: ['Agentic AI', '投资分析', '知识库 RAG'],
    techStack: ['DeepSeek Chat', 'LangChain Tool Calling', 'ChromaDB + BM25', 'FastAPI', 'React + TypeScript', 'Siliconflow Embedding'],
    stats: [
      { value: '200+', label: '原创文章' },
      { value: '两阶段', label: 'Agentic Loop' },
      { value: '实时', label: 'A股行情' },
    ],
    features: [
      {
        title: '🤖 两阶段 Agentic Loop',
        description: 'Phase 1 规则驱动自动采集：识别股票代码/名称调实时估值研报，识别热点词调同花顺强势股，识别 Dang 相关词调知识库。Phase 2 LLM 二次决策补充联网搜索，全程无需手动切换。',
      },
      {
        title: '📚 Dang 原创知识库 RAG',
        description: '基于 200+ 篇 Mr Dang 原创文章构建向量索引，BM25 + 语义双路检索 RRF 融合排序，确保财经早餐、功法系列、行情点评等内容精准命中。',
      },
      {
        title: '📈 A 股实时数据接入',
        description: '腾讯财经提供实时行情与 PE/PB/市值，东方财富聚合机构研报与 EPS 预测，同花顺捕捉当日热点题材，akshare 提供机构 EPS 一致预期与 PEG 计算。',
      },
      {
        title: '🗣️ Mr Dang 人格输出',
        description: '完整复现 Dang 老师的表达风格与分析框架——直接、坦率，强调安全边际与赔率，拒绝模棱两可。所有回答以知识库内容为锚点，有据可查。',
      },
    ],
    links: {
      project: 'https://pmtools.com.cn/dang-analysis/',
      source: '#',
    },
    origin: {
      title: '💡 开发初衷',
      paras: [
        '我长期跟踪 Mr Dang 的投资文章，他的分析框架——强调赔率、安全边际、反共识——对我影响很深。但随着文章积累越来越多，想快速找到"他对某只股票怎么看"或"地阶功法第几卷讲了什么"变得很麻烦。',
        '同时，我发现自己在做投资决策时，总要在多个地方切换：行情 App 看估值，东财看研报，然后再回忆 Dang 老师的观点。信息是碎片化的，决策过程是割裂的。',
      ],
      emphasis: '我想要一个能把这些全部整合的入口——问一个问题，系统自动把数据、研报和 Dang 的原创观点都给我聚合好，再用他的语气输出。',
      ending: '这就是 Dang Analysis 的起点。不是要替代 Dang 老师，而是把他的思考方式和积累的内容，变成一个随时可以调用的分析助手。',
    },
    ctaLabel: '开始提问',
    mockupType: 'dang-analysis',
  },
  {
    id: 'kada',
    number: '03',
    title: '咔哒 · SnapBuild',
    tagline: '轻量级在线 HTML 编辑工具',
    description: '专为极速验证与原型沟通打造的轻量级工作台。无需配置繁琐的本地环境，敲击代码，瞬间生成真实可交互的页面结构，让每一个想法都即刻可见。',
    detailDescription:
      '专为极速验证与原型沟通打造的轻量级工作台。无需配置繁琐的本地环境，敲击代码，瞬间生成真实可交互的页面结构，让每一个想法都即刻可见。',
    tags: ['实时预览', '零配置', '草图模式'],
    techStack: ['HTML / CSS / JS', 'CodeMirror Editor', 'Prettier', 'Blob API', 'CSS3 Media Queries'],
    stats: [
      { value: '实时', label: '预览' },
      { value: '离线', label: '可用' },
      { value: '零配置', label: '即开即用' },
    ],
    features: [
      {
        title: '极速预览',
        description: '编辑代码，右侧即时渲染交互效果，所见即所得的开发体验。',
      },
      {
        title: '轻量编辑',
        description:
          '告别臃肿的本地环境，用快捷标签像搭积木一样创造，结构、布局、表单一键插入。',
      },
      {
        title: '草图模式',
        description: '一键切换线框图视图，褪去视觉干扰，专注于业务逻辑和页面结构。',
      },
      {
        title: '高效沟通',
        description: '支持代码美化、高清截图与离线导出为 HTML 文件，告别需求拉扯。',
      },
    ],
    useCases: [
      {
        icon: '📋',
        role: '产品经理',
        scenario: 'PM',
        description:
          '一键生成真实交互，告别线框图解释成本，需求评审更直观。',
      },
      {
        icon: '💻',
        role: '前端开发',
        scenario: 'FE',
        description:
          '随时随地快速验证代码片段，无需启动臃肿的本地 IDE 环境。',
      },
      {
        icon: '📢',
        role: '运营 / 市场',
        scenario: 'Op',
        description:
          '快速搭建营销活动页草图，所见即所得，沟通无障碍。',
      },
      {
        icon: '🚀',
        role: '独立开发者',
        scenario: 'Indie',
        description:
          '捕捉稍纵即逝的灵感。',
      },
    ],
    links: {
      project: 'https://pmtools.com.cn/kada/',
      source: '#',
    },
    ctaLabel: '体验一下',
    mockupType: 'kada',
  },
]

export function getProjectById(id) {
  return projects.find((project) => project.id === id)
}
