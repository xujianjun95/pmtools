export const projects = [
  {
    id: 'yessir',
    number: '01',
    title: 'YesSir',
    tagline: 'Chrome 标签页管理 · AI 聚合搜索',
    badge: '100+ 用户的选择',
    description:
      '一款优雅、简洁的Chrome 浏览器插件，重新定义标签页管理体验。集成 AI 聚合搜索能力，让信息获取更高效。',
    detailDescription:
      '一款优雅、简洁的 Chrome 浏览器插件，重新定义标签页管理体验。集成 AI 聚合搜索能力，让信息获取更高效、更智能。',
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
          '一键梳理所有窗口的标签页。AI 自动识别主题归类，支持拖拽手动调教——YesSir 会记住你的偏好，越用越懂你。',
      },
      {
        title: '📌 置顶槽·核心任务常驻',
        description:
          '拖动标签页越过面板边界，置顶槽伴随「雾化浮层」动画从侧边优雅浮现——三个固定位，把最重要的标签页拖进去，随时一键直达，再也不用在一堆标签里翻找。',
      },
      {
        title: '⚡ 指尖微操·告别鼠标寻叉',
        description:
          '双击修饰键呼出面板，按住修饰键双击页面空白处秒关当前标签，回归最纯粹的键鼠效率。',
      },
      {
        title: '🔍 模糊意图语义检索',
        description:
          '记不清网页标题？输入模糊意图即可全局精准匹配，支持 Cmd/Ctrl + E 极速切换最近标签。',
      },
    ],
    links: {
      project:
        'https://chromewebstore.google.com/detail/%E6%A0%87%E7%AD%BE%E9%A1%B5ai%E8%87%AA%E5%8A%A8%E5%88%86%E7%BB%84%E8%B7%A8%E7%AA%97%E5%8F%A3%E7%AE%A1%E7%90%86%E5%BF%AB%E9%80%9F%E5%88%87%E6%8D%A2%E5%8F%8C%E5%87%BB%E5%85%B3%E9%97%AD%E6%99%BA%E8%83%BD%E8%AF%AD/ggdplmigmgopdecjadbgakofifnonacb?authuser=0&hl=zh-CN',
      source: '#',
      download: '/YesSir-v1.5.2.zip',
    },
    mockupType: 'yessir',
  },
  {
    id: 'dang-analysis',
    number: '02',
    title: 'Dang Analysis',
    tagline: '投资分析智能体',
    description: 'AI 驱动 A 股投资洞察。Agentic Loop 双阶段决策引擎实时捕获市场数据、机构动向与热点题材，结合涵盖数百篇深度研报的专属知识库进行交叉验证，为您输出专业、体系化的投资策略。',
    detailDescription: 'AI 驱动 A 股投资洞察。Agentic Loop 双阶段决策引擎实时捕获市场数据、机构动向与热点题材，结合涵盖数百篇深度研报的专属知识库进行交叉验证，为您输出专业、体系化的投资策略。',
    tags: ['Agentic AI', '投资分析', '知识库 RAG'],
    techStack: ['DeepSeek Chat', 'LangChain Tool Calling', 'ChromaDB + BM25', 'FastAPI', 'React + TypeScript', 'Siliconflow Embedding'],
    stats: [
      { value: '200+', label: '原创文章' },
      { value: '两阶段', label: 'Agentic Loop' },
      { value: '实时', label: 'A股行情' },
    ],
    features: [
      {
        title: '🤖 双重智能决策引擎 (Agentic Loop)',
        description: '深度解析您的提问意图。系统自动识别股票代码并调取实时估值与研报，精准捕捉热点词汇并匹配强势股池。结合 LLM 的深度联网搜索与逻辑推演，全流程静默执行，为您免去繁琐的手动切屏与搜索。',
      },
      {
        title: '📚 财经大V 原创知识库 RAG',
        description: '基于百余篇财经大V 原创文章构建向量索引，BM25 + 语义双路检索 RRF 融合排序，确保核心内参被精准提取，为决策提供高价值的数据锚点。（持续更新知识库内容，保证回答与文章的时效性）',
      },
      {
        title: '📈 全景式 A 股实时数据',
        description: '深度打通各大主流财经数据库。秒级接入实时行情与核心财务指标（PE/PB/市值），无缝聚合机构研报、EPS 一致预期与 PEG 测算。动态捕捉当日热点题材，为您构建多维度的市场决策全景图。',
      },
      {
        title: '🗣️ 顶尖交易者分析框架',
        description: '完整复刻成熟稳健的机构级交易逻辑。输出风格直接坦率、拒绝模棱两可，核心聚焦"安全边际"与"盈亏比"。所有的策略推演均严格基于专属知识库与客观数据，结论有据可查，帮您穿透市场噪音。',
      },
    ],
    links: {
      project: 'https://pmtools.com.cn/dang-analysis/',
      source: '#',
    },
    origin: {
      title: '💡 开发初衷：重构被割裂的决策链路',
      quote: '在这个信息过载的市场里，我们从未缺乏过数据，缺乏的是穿透噪音的认知框架，以及将这种认知转化为执行力的系统。',
      sections: [
        {
          header: '迷失在碎片的工具与信息中',
          paras: [
            '回顾过去的交易复盘，我发现一个令人疲惫的常态：做一次深度的投资研判，往往是一场跨越多个工具的"体力活"。',
            '早盘看交易软件的异动，盘中盯财经平台的实时估值，盘后去研报网站翻找机构的一致预期。更糟糕的是，当面对剧烈波动的盘面时，那些原本烂熟于心的交易心法——关于"安全边际的计算"、关于"赔率与胜率的博弈"、关于"逆向反共识"的定力——极易被市场的短期情绪所淹没。',
            '信息是碎片的，工具是割裂的，这导致我们的决策常常在严谨的逻辑与盲目的感性之间反复横跳。',
          ],
        },
        {
          header: '让静态的经验，拥有流动的生命力',
          paras: [
            '我长期实践并笃信一套成熟、稳健的实战交易逻辑，并积累了数百篇深度的盘后复盘、策略推演与交易功法。但随着知识库越来越庞大，想要在瞬息万变的交易时段，快速检索并对齐"此时此地的这只股票，是否符合出手的底层逻辑"，变得极其困难。',
            '我意识到：再顶级的投资框架，如果只停留在静态的笔记里，就无法形成真正的战斗力。',
          ],
        },
        {
          header: '打造交易者的"数字外骨骼"',
          paras: [
            '这就催生了开发 Dang Analysis 的核心诉求。我不想要一个只会罗列资讯的通用 AI，我需要一个高度定制化的"智能决策中枢"。',
            '我希望它能像一位极其严谨的交易员一样工作：当你抛出一个标的或现象，它能在后台静默完成全流程的尽调。它必须同时连接"当下"与"历史"——左手秒级抓取实时行情与机构预期，右手在底层数据库中精准提取经过实战检验的交易心法。',
          ],
        },
        {
          header: '化繁为简，回归理性',
          paras: [
            '将流动的"市场数据"与静止的"投资逻辑"深度耦合，剔除模棱两可的分析，直接输出基于安全边际的冷峻研判。',
            '构建这个系统，本质上是为了重塑交易的秩序。把复杂的数据收集交由机器，把核心的决策时间留给人类，让每一次点击都有据可查，让每一次交易都回归理性。',
          ],
        },
      ],
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
