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
    id: 'kada',
    number: '02',
    title: '咔哒 · SnapBuild',
    tagline: '轻量级在线 HTML 编辑工具',
    description: '让灵感即刻落地的在线编辑器。编辑代码，瞬间转化为真实的交互界面。',
    detailDescription:
      '让灵感即刻落地的在线 HTML 编辑器。编辑代码，瞬间转化为真实的交互界面，告别臃肿的本地开发环境。',
    tags: ['实时预览', '零配置', '草图模式'],
    techStack: ['HTML / CSS / JS', '实时渲染引擎', '代码格式化', '离线导出', '响应式设计'],
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
    links: {
      project: 'https://pmtools.com.cn/kada/',
      source: '#',
    },
    mockupType: 'kada',
  },
]

export function getProjectById(id) {
  return projects.find((project) => project.id === id)
}
