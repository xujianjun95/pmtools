# OSS 文章源

文章页面默认从你的公开 OSS 地址读取文章，也可以通过环境变量覆盖地址；远程请求失败时继续使用 `src/data/articles.js` 的本地兜底数据。

## 配置地址

默认地址是：

```text
https://pmtools27.oss-cn-beijing.aliyuncs.com/articles/articles.json
```

如需换成其他 OSS 或自定义域名，可在构建网站时设置：

```bash
VITE_ARTICLES_MANIFEST_URL=https://static.example.com/pmtools/articles/articles.json
```

该地址只需要配置一次。之后新增或修改文章时，更新 OSS 文件即可，不需要重新构建网站。

由于网站会用 `fetch` 读取 OSS 上的 JSON 和 Markdown，需要在 OSS 的 CORS 设置中允许网站域名发起 `GET`、`HEAD` 请求。生产环境至少加入 `https://www.pmtools.com.cn` 和 `https://pmtools.com.cn`；本地验证时再临时加入 `http://localhost:5173`。

## OSS 目录建议

```text
pmtools/articles/
├── articles.json
└── codex-install-guide/
    ├── article.md
    └── images/
        ├── 01.webp
        └── 02.webp
```

## `articles.json` 格式

```json
{
  "version": 1,
  "articles": [
    {
      "id": "codex-install-guide",
      "title": "不要再去花钱找人安装啦，手把手教你安装并使用 Codex",
      "date": "2026-08-13",
      "summary": "保姆级 Codex 安装教程。",
      "tags": ["Codex", "DeepSeek", "AI 工具"],
      "contentPath": "codex-install-guide/article.md",
      "cover": "codex-install-guide/images/01.webp"
    }
  ]
}
```

正文可以继续使用 Obsidian 的图片写法：

```markdown
![[截图文件.png]]
```

网站会按文章目录自动转换为 OSS 的 `images/截图文件.png` 地址。也支持普通 Markdown 图片写法；发布时建议使用不带临时签名参数的稳定 OSS 或自定义域名地址。

## 失败兜底

- 远程地址请求失败：显示现有本地文章，并在控制台记录原因。
- OSS 清单请求失败：显示现有本地文章，并在控制台记录原因。
- 清单中的单篇正文请求失败：跳过该条目，不影响其他已加载文章。

## 一键发布（本地）

项目已经提供本地发布脚本。它默认读取：

```text
~/Desktop/黑曜石/网站文章
```

脚本会自动完成以下工作：

1. 读取每个文章目录中的 Markdown 正文和 `images/` 图片。
2. 去掉 Obsidian 的 YAML 配置头，并把 `![[图片.png]]` 转成网站可读取的图片链接。
3. 根据文章信息重新生成 `articles.json`。
4. 先上传正文和图片，最后覆盖 OSS 根目录下的 `articles.json`。

首次使用需要在本机安装并配置阿里云官方 `ossutil`，配置文件只保存在本机，不要提交到 Git：

```bash
ossutil config
```

配置时使用北京地域的 Endpoint：

```text
https://oss-cn-beijing.aliyuncs.com
```

以后在项目目录执行：

```bash
npm run articles:publish
```

正式上传前可以先预览：

```bash
npm run articles:publish:dry
```

只发布某一篇文章：

```bash
npm run articles:publish -- --article ai-codex-guide
```

脚本只会新增或覆盖上传，不会自动删除 OSS 上的旧文件；这样可以避免误删仍被旧文章引用的图片。草稿可以在文章 frontmatter 中写 `draft: true`，脚本会跳过它。
