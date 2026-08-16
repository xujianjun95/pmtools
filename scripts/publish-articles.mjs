import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const DEFAULT_SOURCE_DIR = path.join(os.homedir(), 'Desktop/黑曜石/网站文章')
const DEFAULT_BUCKET = 'pmtools27'
const DEFAULT_PREFIX = 'articles'
const DEFAULT_OSSUTIL = 'ossutil'
const IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.gif',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp',
])
const OBSIDIAN_IMAGE_RE = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g

function printHelp() {
  console.log(`用法：
  npm run articles:publish
  npm run articles:publish -- --dry-run
  npm run articles:publish -- --article codex-install-guide

可选环境变量：
  ARTICLES_SOURCE_DIR       黑曜石“网站文章”目录
  OSS_BUCKET                OSS Bucket，默认 pmtools27
  OSS_PREFIX                OSS 前缀，默认 articles
  OSSUTIL_BIN               ossutil 可执行文件路径
  OSSUTIL_CONFIG_FILE       ossutil 配置文件路径
`)
}

function parseArgs(argv) {
  const options = {
    article: '',
    dryRun: false,
    sourceDir: process.env.ARTICLES_SOURCE_DIR || DEFAULT_SOURCE_DIR,
    bucket: process.env.OSS_BUCKET || DEFAULT_BUCKET,
    prefix: process.env.OSS_PREFIX || DEFAULT_PREFIX,
    ossutil: process.env.OSSUTIL_BIN || DEFAULT_OSSUTIL,
    configFile: process.env.OSSUTIL_CONFIG_FILE || '',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') {
      printHelp()
      process.exit(0)
    }
    if (argument === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (argument === '--article') {
      options.article = argv[index + 1] || ''
      index += 1
      continue
    }
    if (argument === '--source') {
      options.sourceDir = argv[index + 1] || ''
      index += 1
      continue
    }
    throw new Error(`无法识别的参数：${argument}`)
  }

  return options
}

function normalizeScalar(value) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  return trimmed
}

function parseListValue(value) {
  const trimmed = value.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => normalizeScalar(item))
      .filter(Boolean)
  }
  return [normalizeScalar(trimmed)].filter(Boolean)
}

function parseFrontmatter(content) {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) {
    return { attributes: {}, body: normalized }
  }

  const endMarker = normalized.indexOf('\n---', 4)
  if (endMarker === -1) {
    return { attributes: {}, body: normalized }
  }

  const header = normalized.slice(4, endMarker).split('\n')
  const attributes = {}
  let activeListKey = ''

  for (const line of header) {
    const listItem = /^\s*-\s+(.+)$/.exec(line)
    if (listItem && activeListKey) {
      if (!Array.isArray(attributes[activeListKey])) attributes[activeListKey] = []
      attributes[activeListKey].push(normalizeScalar(listItem[1]))
      continue
    }

    const field = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line)
    if (!field) continue
    const [, key, rawValue] = field
    if (!rawValue.trim()) {
      attributes[key] = []
      activeListKey = key
      continue
    }
    attributes[key] = key === 'tags' ? parseListValue(rawValue) : normalizeScalar(rawValue)
    activeListKey = ''
  }

  const body = normalized.slice(endMarker + '\n---'.length).replace(/^\n+/, '')
  return { attributes, body }
}

function toDateString(value, fallbackDate) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim()
  }
  return fallbackDate
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fileNameFromResource(resource) {
  return path.posix.basename(resource.trim().replace(/\\/g, '/'))
}

function encodeImagePath(fileName) {
  return `images/${encodeURIComponent(fileName)}`
}

function normalizeBody(body) {
  const obsidianBody = body.replace(OBSIDIAN_IMAGE_RE, (_match, resource, alt) => {
    const fileName = fileNameFromResource(resource)
    if (!fileName) return _match
    return `![${alt || fileName}](${encodeImagePath(fileName)})`
  })

  return obsidianBody.replace(MARKDOWN_IMAGE_RE, (_match, alt, resource) => {
    if (/^(?:https?:|data:|\/\/|\/)/i.test(resource)) return _match
    const normalizedResource = resource.replace(/\\/g, '/')
    const fileName = fileNameFromResource(normalizedResource)
    if (!fileName || normalizedResource.startsWith('images/')) return _match
    return `![${alt}](${encodeImagePath(fileName)})`
  })
}

function isImageFile(fileName) {
  return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase())
}

async function readDirectoryEntries(directory) {
  return fs.readdir(directory, { withFileTypes: true })
}

async function findArticleFile(articleDir) {
  const entries = await readDirectoryEntries(articleDir)
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))

  if (markdownFiles.length === 0) return ''
  if (markdownFiles.length > 1) {
    throw new Error(
      `文章目录 ${articleDir} 有多个 Markdown 文件，请每个文章目录只保留一个正文文件。`
    )
  }
  return path.join(articleDir, markdownFiles[0])
}

function validateSlug(slug, articleDir) {
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) {
    throw new Error(
      `文章目录 ${articleDir} 的 slug “${slug || '(空)'}” 不符合规则，请使用英文、数字和短横线，例如 ai-codex-guide。`
    )
  }
}

async function collectImages(articleDir) {
  const imagesDir = path.join(articleDir, 'images')
  let entries
  try {
    entries = await readDirectoryEntries(imagesDir)
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }

  return entries
    .filter((entry) => entry.isFile() && isImageFile(entry.name))
    .map((entry) => ({
      fileName: entry.name,
      localPath: path.join(imagesDir, entry.name),
    }))
    .sort((a, b) => a.fileName.localeCompare(b.fileName, 'en'))
}

function findReferencedImageNames(body) {
  const names = new Set()
  for (const match of body.matchAll(OBSIDIAN_IMAGE_RE)) {
    const fileName = fileNameFromResource(match[1])
    if (fileName) names.add(fileName)
  }
  return names
}

function chooseCover(attributes, images, referencedImageNames) {
  const coverValue = typeof attributes.cover === 'string' ? attributes.cover : ''
  const coverName = coverValue ? fileNameFromResource(coverValue) : ''
  if (coverName && images.some((image) => image.fileName === coverName)) return coverName

  const firstReferenced = images.find((image) => referencedImageNames.has(image.fileName))
  return firstReferenced?.fileName || images[0]?.fileName || ''
}

async function collectArticles(sourceDir) {
  const entries = await readDirectoryEntries(sourceDir)
  const articleDirs = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => path.join(sourceDir, entry.name))
    .sort((a, b) => a.localeCompare(b, 'en'))

  const articles = []
  for (const articleDir of articleDirs) {
    const articleFile = await findArticleFile(articleDir)
    if (!articleFile) {
      console.warn(`跳过 ${articleDir}：目录中没有 Markdown 正文。`)
      continue
    }

    const rawContent = await fs.readFile(articleFile, 'utf8')
    const { attributes, body } = parseFrontmatter(rawContent)
    const slug = String(attributes.slug || path.basename(articleDir)).trim()
    validateSlug(slug, articleDir)

    if (attributes.draft === true) {
      console.log(`跳过草稿：${slug}`)
      continue
    }

    const stat = await fs.stat(articleFile)
    const images = await collectImages(articleDir)
    const referencedImageNames = findReferencedImageNames(body)
    const missingImages = [...referencedImageNames].filter(
      (fileName) => !images.some((image) => image.fileName === fileName)
    )
    if (missingImages.length) {
      throw new Error(`文章 ${slug} 缺少图片：${missingImages.join('、')}`)
    }

    const title = String(attributes.title || path.basename(articleFile, path.extname(articleFile)))
    const coverName = chooseCover(attributes, images, referencedImageNames)
    const contentFileName = path.basename(articleFile)
    const content = `${normalizeBody(body).trim()}\n`

    articles.push({
      slug,
      title,
      date: toDateString(attributes.date, formatDate(stat.mtime)),
      summary: String(attributes.summary || '').trim(),
      tags: Array.isArray(attributes.tags) ? attributes.tags.map(String).filter(Boolean) : [],
      published: attributes.published !== false,
      coverName,
      contentFileName,
      content,
      images,
    })
  }

  return articles.sort((a, b) => new Date(b.date) - new Date(a.date))
}

async function writeStagingFiles(articles, selectedArticle, stagingDir) {
  const selected = selectedArticle
    ? articles.filter((article) => article.slug === selectedArticle)
    : articles
  if (selectedArticle && selected.length === 0) {
    throw new Error(`找不到文章 slug：${selectedArticle}`)
  }

  const filesToUpload = []
  for (const article of selected) {
    const articleStagingDir = path.join(stagingDir, article.slug)
    const imagesStagingDir = path.join(articleStagingDir, 'images')
    await fs.mkdir(imagesStagingDir, { recursive: true })

    const contentPath = path.join(articleStagingDir, article.contentFileName)
    await fs.writeFile(contentPath, article.content, 'utf8')
    filesToUpload.push({
      localPath: contentPath,
      remotePath: `${article.slug}/${article.contentFileName}`,
      label: `${article.slug}/${article.contentFileName}`,
    })

    for (const image of article.images) {
      const imagePath = path.join(imagesStagingDir, image.fileName)
      await fs.copyFile(image.localPath, imagePath)
      filesToUpload.push({
        localPath: imagePath,
        remotePath: `${article.slug}/images/${image.fileName}`,
        label: `${article.slug}/images/${image.fileName}`,
      })
    }
  }

  const manifestPath = path.join(stagingDir, 'articles.json')
  const manifest = {
    version: 1,
    articles: articles.map((article) => ({
      id: article.slug,
      title: article.title,
      date: article.date,
      summary: article.summary,
      tags: article.tags,
      contentPath: `${article.slug}/${article.contentFileName}`,
      cover: article.coverName ? `${article.slug}/images/${article.coverName}` : '',
      published: true,
    })),
  }
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  return { manifest, manifestPath, filesToUpload }
}

function buildOssUrl(bucket, prefix, relativePath) {
  return `oss://${bucket}/${prefix}/${relativePath}`
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${command} 执行失败，退出码：${code}`))
    })
  })
}

async function uploadPreparedFiles(options, filesToUpload, manifestPath) {
  const globalArgs = options.configFile ? ['-c', options.configFile] : []
  for (const file of filesToUpload) {
    const remoteUrl = buildOssUrl(options.bucket, options.prefix, file.remotePath)
    console.log(`上传 ${file.label}`)
    if (options.dryRun) continue
    await runCommand(options.ossutil, [
      ...globalArgs,
      'cp',
      file.localPath,
      remoteUrl,
      '--force',
    ])
  }

  const manifestUrl = buildOssUrl(options.bucket, options.prefix, 'articles.json')
  console.log('最后更新 articles.json')
  if (!options.dryRun) {
    await runCommand(options.ossutil, [
      ...globalArgs,
      'cp',
      manifestPath,
      manifestUrl,
      '--force',
    ])
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const sourceDir = path.resolve(options.sourceDir)
  const stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pmtools-articles-'))

  try {
    await fs.access(sourceDir)
    const articles = await collectArticles(sourceDir)
    if (!articles.length) throw new Error(`没有找到可发布的文章：${sourceDir}`)

    const { manifest, manifestPath, filesToUpload } = await writeStagingFiles(
      articles,
      options.article,
      stagingDir
    )

    console.log(`发现 ${manifest.articles.length} 篇文章，准备上传 ${filesToUpload.length} 个正文/图片文件。`)
    if (options.dryRun) console.log('当前为预览模式，不会真正上传。')
    await uploadPreparedFiles(options, filesToUpload, manifestPath)
    console.log(
      options.dryRun
        ? '预览完成。确认无误后运行 npm run articles:publish。'
        : '发布完成。刷新网站即可看到最新内容。'
    )
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(`发布失败：${error.message}`)
  process.exitCode = 1
})
