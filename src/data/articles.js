/**
 * 文章数据
 * 新增文章：在 articles 数组里追加一个对象即可，列表/详情/上一篇下一篇循环均自动适配。
 * content 为 Markdown 字符串，由 utils/markdown.js 解析渲染。
 */

export const articles = [
  {
    id: 'codex-install-guide',
    title: '不要再去花钱找人安装啦，手把手教你安装并使用 Codex',
    date: '2026-08-13',
    summary:
      '保姆级 Codex 安装教程，会详细介绍 Codex 的安装过程及接入国内大模型的方法。',
    tags: ['Codex', 'DeepSeek', 'AI 工具'],
    cover:
      'https://ros-preview.xhscdn.com/spectrum/eYBUAj1nPwHIBYaxAbbCI2SzRCiF5PWC5bGYUYzcGzE4Tz8?sign=15e6da80b6959767a68508e8a8e6f169&t=1786780989',
    content: `本文为一篇**保姆级** Codex 安装教程，会详细介绍 Codex 的安装过程及接入**国内大模型**的方法。

首先，我们需要下载 Codex，可直接在 **OpenAI 的官网**进行下载，此处附上地址：https://openai.com/zh-Hant/codex/

（注：==此链接需要科学上网，科学上网的问题需要自行解决。==）

![Codex 官网下载页](https://ros-preview.xhscdn.com/spectrum/eYBUAj1nPwHIBYaxAbbCI2SzRCiF5PWC5bGYUYzcGzE4Tz8?sign=15e6da80b6959767a68508e8a8e6f169&t=1786780989)

Codex 到底是干什么的？

你可以先把 Codex 理解成一个**"能帮你动手干活的 AI 助手"**。

普通聊天机器人更多是在对话框里告诉你代码该怎么写；**Codex 除了回答问题，还能在你允许的范围内读取文件、修改代码、运行命令、检查结果**。

## 一、下载并安装 Codex

我们以 **Mac** 版本为例，在此处点击下载按钮后，会自动下载 **.dmg 文件**，下载好后直接打开安装即可。

安装完成后，双击打开软件，会出现下方页面。

![Codex 启动页](https://ros-preview.xhscdn.com/spectrum/5rFna3hbUwBgv6BbydXF8emqBnBk-PaCZEb8spsd0g9Wmf4?sign=268904641a3cd8dfaa2ff918c46426dc&t=1786781230)

我们有两种方式来使用 Codex：

### 方式一：使用官方套餐

- 如果你已经有了 ChatGPT 账号，可以直接在这里点击「**继续登录**」，浏览器会自动弹出登录窗口，输入账号密码登录即可。
- 如果你没有 ChatGPT 账号，则需要点击下方的**注册按钮**，在弹出的页面选择一个方式进行注册。这里需要注意，理论上 OpenAI **暂不接受大陆用户**进行注册，所以如果你选择电话号码方式进行登录，你大概率是无法找到 **+86（中国）**的，即使你选择用其他方式登录，你也可能会遇到绑定手机号的情况，此时你需要用其他的方式来解决这个问题（比如找国外的朋友帮忙：）、接码平台等）。

![Codex 登录注册页](https://ros-preview.xhscdn.com/spectrum/ZabJE5Dk_IoBT_r3vdenAnw1a5dMYhYaNmVlxGOtrcw7Zm8?sign=a119bb1d1d2e262872c958cdceedc5cf&t=1786781852)

这里先附上 Codex 的定价表及套餐说明：

![Codex 套餐定价表](https://ros-preview.xhscdn.com/spectrum/lbGWy1jZh0M-BpqmNE_WgukAPmfT_QEH2V6PdqZTx3RphPw?sign=2c6e0cecd51966f83db28989039b4034&t=1786782289)

1. **免费版**：只能使用 5.6 Luna 的轻度推理模型。每个月固定额度，配额极少，**无 5 小时额度和周额度重置**，基本问几个问题就消耗光了。什么？你问我额度消耗光了怎么办？充值解决一切问题。
2. **Go 版**：只能使用 5.6 Luna 的轻度推理模型。比免费版稍多的额度，**有 5 小时额度和周额度重置**，但基本还是不够用。
3. **Plus 版**：可以使用所有高级模型，这个版本的额度勉强可以让正常用户安心使用，**有 5 小时额度及周额度限制**。
4. **Pro 版**：这个就不说了，根据价格分为 **5x 配额和 20x 配额**，对应的是 **100 刀和 200 刀**每月，量大管饱。如果这个还是不够用那就走 API 按量付费吧。

### 方式二：接入第三方 API 使用

此处以 DeepSeek 为例，让我们打开 DeepSeek 的官网，选择 **API 开放平台**。

![DeepSeek 官网](https://ros-preview.xhscdn.com/spectrum/DdT7ORrancwYd7UvaXTluYfbqm5PgFirMXA5HFfSaHqirfw?sign=47105c76cb8acbc894883608ba73c42b&t=1786784217)

下面就到了充值时间，朋友！让我们给梁老师交一些学费吧！

![DeepSeek 充值页](https://ros-preview.xhscdn.com/spectrum/peSVvW2I30I2Qcr-bkPBJWKIbMYqbMa977D02FUg4raOoT0?sign=fde3ec42dd97cb68ebd3a48971f3ad0b&t=1786784323)

充值完成后，点击「**API keys**」，然后点击「**创建 API key**」，随便填个名称，点击「**创建**」按钮。

![DeepSeek 创建 API key](https://ros-preview.xhscdn.com/spectrum/2Blo5mSzOWVR_Yybsmm3Vi7OTAbDn9iHcMkXvZcqOERqoG4?sign=0602bd3c1efb993c60c3a4849ad6463a&t=1786784446)

![DeepSeek API key 列表](https://ros-preview.xhscdn.com/spectrum/F7WBlTuMk-13n7YF66sS40luKJ1X1v7yBq2ixm2GpPKoEzQ?sign=13abeaf2dd87e2a2cac017958f1b17c0&t=1786784516)

点击「创建」按钮后，会弹出一个弹窗，弹窗中会**明文展示**你本次创建的 API key。

==注意：请不要将 API key 共享出去，这就是钱啊朋友。==在弹窗中复制 API key，然后先**粘贴到一个文档里保存**。

![复制 API key](https://ros-preview.xhscdn.com/spectrum/ZFgQ9X7YO83z8w0UfLpgaSs13U751Fqfq7HuhUt8NUmC3zE?sign=b14d96a93f79d8f056b6d88c30e1a64e&t=1786784599)

## 二、安装 CC Switch

照例此处附上下载链接：https://cc-switch.cc/ ，在这里点击「**立即下载**」按钮，选择合适的版本下载即可。

![CC Switch 官网](https://ros-preview.xhscdn.com/spectrum/QTseaLmfLszASd9vXITDvhM5fGGL5VPlJWFp1DYHiQif1h0?sign=541c9907cc43b079fe5bb9b9ee3e5927&t=1786783886)

![CC Switch 下载页](https://ros-preview.xhscdn.com/spectrum/zCv2Rj0ymOaSmu9c2wR9I2ltKGUnjLfPQi7ILTTH6RqoyNw?sign=01ada739b1af944f5ced0ebc18748aee&t=1786783921)

## 三、在 CC Switch 中添加 DeepSeek

下载完成后让我们安装并打开 CC Switch。

![CC Switch 首页](https://ros-preview.xhscdn.com/spectrum/A5P3cjp4AZkRNvdLDl6FwqvSP3lGnen6hzaVTZCIMRO5bls?sign=b97702418a2126f99967cb327d562c6b&t=1786783994)

让我们在上方导航栏找到 Codex，点击**右上角的加号**。

![CC Switch 添加配置](https://ros-preview.xhscdn.com/spectrum/ZjDFvL-cqQFhdf6wCW7xwaeWBkDuD0N4-eIoPBq617jNGso?sign=798515a9206941e92b46bf8829d18f63&t=1786784032)

在这里，我们找到对应的服务提供商，此处依然以 DeepSeek 为例。选中后，向下滑动。

![选择服务提供商](https://ros-preview.xhscdn.com/spectrum/y4ZE8kGKx0e9yvxhXuFEcM1DqBG5O0RGI0v3de6QyeXhlfk?sign=605655a3ebc468e3cffee982e3cc5647&t=1786784103)

在这里，我们把刚才保存好的 API key 填写进去，其余的字段不用修改，然后点击右下角的「**添加**」按钮。

![填写 API key](https://ros-preview.xhscdn.com/spectrum/C8EkBSj85wy7pYt21RYx14t_d63vVpANaXHJ112LKba-KQQ?sign=666aec02fbe6f904dda45b9d0a559975&t=1786784864)

回到 CC Switch 首页，找到我们刚刚添加的 DeepSeek，点击「**启用**」。

![启用 DeepSeek](https://ros-preview.xhscdn.com/spectrum/-YHSTK9mW7iZ_N6_SycasT4W_LhZoBQ8Xs_pLzBhDGoW2hI?sign=804830a38a7baba28c489f1ab61d9482&t=1786784961)

然后，让我们重新启动一下 Codex，这时你会发现，Codex 不需要我们登录，可以**正常使用**咯。

![Codex 正常使用](https://ros-preview.xhscdn.com/spectrum/U_CRCWGmTqSWaymGsKOFEhZvdnnT1cpiqCPYL8OvFXcmsQ8?sign=547b5560361df7c429d4aa57a24caec3&t=1786785119)`,
  },
]

/** 按日期倒序，便于列表展示 */
export function getArticles() {
  return [...articles].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  )
}

/** 取指定 id 的文章，并附带上一篇/下一篇（循环） */
export function getArticleWithNeighbors(id) {
  const list = getArticles()
  const index = list.findIndex((a) => a.id === id)
  if (index === -1) return null
  const len = list.length
  return {
    current: list[index],
    prev: list[(index - 1 + len) % len],
    next: list[(index + 1) % len],
  }
}
