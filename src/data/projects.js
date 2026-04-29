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
        title: '智能标签管理',
        description:
          '可视化管理所有标签页，支持分组、搜索、快速切换，告别标签页混乱。',
      },
      {
        title: 'AI 聚合搜索',
        description:
          '集成多种 AI 搜索引擎，一次输入，多源结果聚合展示，提升信息获取效率。',
      },
      {
        title: '快捷操作',
        description:
          '支持键盘快捷键操作，Tab 切换搜索模式，Command + E 快速导航。',
      },
      {
        title: '轻量极速',
        description: '极简设计，零学习成本，即装即用，不影响浏览器性能。',
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
    tags: ['实时预览', '零配置'],
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
