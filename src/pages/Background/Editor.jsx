import { useEffect, useRef, useState } from 'react'
import { getAdminArticle, updateAdminArticle, uploadImage } from './api'
import { findUnreadyImages } from './articleValidation'
import {
  collectMarkdownImageReferences,
  convertObsidianImages,
  createImportFileIndex,
  parseMarkdownFile,
  replaceMarkdownImageUrls,
} from './importMarkdown'

const OBSIDIAN_IMAGE_RE = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

function parseTags(raw) {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string' && raw) {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

/** .md 导入对话框：预览 + 缺失图片清单，确认后上传图片并写入编辑器 */
function ImportDialog({ articleId, onClose, onApply }) {
  const [mdFile, setMdFile] = useState(null)
  const [imageFiles, setImageFiles] = useState([])
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleFiles = async (event) => {
    const files = [...(event.target.files || [])]
    const md = files.find((f) => /\.md$/i.test(f.name))
    if (!md) {
      setError('请选择一个 .md 文件（可同时多选配套图片）')
      return
    }
    setError('')
    setMdFile(md)
    const images = files.filter((f) => /^(image\/|\.png$|\.jpe?g$|\.webp$|\.gif$|\.avif$)/i.test(f.type) || /\.(png|jpe?g|webp|gif|avif)$/i.test(f.name))
    setImageFiles(images)
    const text = await md.text()
    const { meta, body, notes } = parseMarkdownFile(text)

    // Obsidian ![[x]] 先转标准写法，再统一收集引用
    const sizeNotes = []
    for (const [, resource, size] of body.matchAll(OBSIDIAN_IMAGE_RE)) {
      if (size) sizeNotes.push(`![[${resource}|${size}]] 的尺寸参数已忽略`)
    }
    const withStdImages = convertObsidianImages(body)
    const refs = [...new Map(collectMarkdownImageReferences(withStdImages).map((ref) => [ref.url, ref])).values()]
    const fileIndex = createImportFileIndex(images, md)
    const missing = []
    const ambiguous = []
    for (const { url } of refs) {
      if (/^(?:https?:|data:|\/\/|\/)/i.test(url)) continue
      const resolved = fileIndex.resolve(url)
      if (resolved.ambiguous) ambiguous.push(url)
      else if (!resolved.file) missing.push(url)
    }
    setPreview({
      meta,
      body: withStdImages,
      notes: [...notes, ...sizeNotes],
      refs,
      missing: [...new Set(missing)],
      ambiguous: [...new Set(ambiguous)],
      fileIndex,
    })
  }

  const handleConfirm = async () => {
    if (!preview) return
    setBusy(true)
    setError('')
    try {
      if (preview.missing.length > 0 || preview.ambiguous.length > 0) {
        throw new Error('存在缺失或重名图片，请先修正文件选择')
      }
      const uploads = new Map()
      for (const { url } of preview.refs) {
        if (/^(?:https?:|data:|\/\/|\/)/i.test(url) || uploads.has(url)) continue
        const resolved = preview.fileIndex.resolve(url)
        if (!resolved.file || resolved.ambiguous) throw new Error(`图片无法唯一匹配：${url}`)
        uploads.set(url, await uploadImage(articleId, resolved.file))
      }
      const content = replaceMarkdownImageUrls(preview.body, uploads)
      onApply({ content, meta: preview.meta })
      onClose()
    } catch (err) {
      setError(`导入失败：${err?.message || '未知错误'}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-dialogMask" onClick={onClose}>
      <div className="bg-dialog bg-dialogWide" onClick={(e) => e.stopPropagation()}>
        <h2 className="bg-dialogTitle">导入 .md</h2>
        <p className="bg-dialogHint">
          选择 .md 文件 + 配套图片（多选）。图片将上传 OSS 并改写链接；内部双链、Callout、脚注、表格不在一期支持范围。
        </p>
        <input
          type="file"
          multiple
          accept=".md,.png,.jpg,.jpeg,.webp,.gif,.avif"
          onChange={handleFiles}
        />
        {error ? <p className="bg-formError">{error}</p> : null}
        {preview ? (
          <div className="bg-importPreview">
            <p>
              <strong>{preview.meta.title || mdFile?.name}</strong>
              {preview.meta.date ? ` · ${preview.meta.date}` : ''}
              {preview.meta.tags ? ` · ${preview.meta.tags}` : ''}
            </p>
            <p className="bg-cellMuted">
              正文 {preview.body.length} 字符 · 引用图片 {preview.refs.length} 张
              {imageFiles.length ? ` · 已选配图 ${imageFiles.length} 张` : ''}
            </p>
            {preview.missing.length > 0 ? (
              <p className="bg-formError">
                缺失图片 {preview.missing.length} 张（正文中引用但未选择文件）：{preview.missing.slice(0, 3).join('、')}
                {preview.missing.length > 3 ? '…' : ''}
              </p>
            ) : preview.ambiguous.length > 0 ? (
              <p className="bg-formError">
                图片名称存在歧义，请使用子目录路径明确引用：{preview.ambiguous.slice(0, 3).join('、')}
                {preview.ambiguous.length > 3 ? '…' : ''}
              </p>
            ) : (
              <p className="bg-okLine">图片齐全，可以导入</p>
            )}
            {preview.notes.map((n) => (
              <p key={n} className="bg-cellMuted">
                提示：{n}
              </p>
            ))}
            <p className="bg-cellMuted">确认后将覆盖当前正文，并应用文件中提供的标题、摘要、标签和日期。</p>
          </div>
        ) : null}
        <div className="bg-dialogActions">
          <button type="button" className="bg-btnGhost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="bg-btnPrimary"
            disabled={!preview || busy || preview.missing.length > 0 || preview.ambiguous.length > 0}
            onClick={handleConfirm}
          >
            {busy ? '导入中…' : '确认导入'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Editor({ articleId, onBack }) {
  const editorHostRef = useRef(null)
  const vditorRef = useRef(null)
  const [article, setArticle] = useState(null)
  const [status, setStatus] = useState('loading') // loading | error | ready
  const [title, setTitle] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [summary, setSummary] = useState('')
  const [cover, setCover] = useState('')
  const [publishedAt, setPublishedAt] = useState('')
  const [contentMd, setContentMd] = useState('')
  const [editorReady, setEditorReady] = useState(false)
  const [editorFailed, setEditorFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveNote, setSaveNote] = useState('')
  const [formError, setFormError] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)
  const [bodyUploadCount, setBodyUploadCount] = useState(0)
  const bodyUploadCountRef = useRef(0)

  const updateBodyUploadCount = (delta) => {
    const next = Math.max(0, bodyUploadCountRef.current + delta)
    bodyUploadCountRef.current = next
    setBodyUploadCount(next)
  }

  // 加载文章
  useEffect(() => {
    let cancelled = false
    getAdminArticle(articleId)
      .then((a) => {
        if (cancelled) return
        setArticle(a)
        setTitle(a.title || '')
        setTagsText(parseTags(a.tags).join('，'))
        setSummary(a.summary || '')
        setCover(a.cover || '')
        setPublishedAt(a.published_at || '')
        setContentMd(a.content_md || '')
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [articleId])

  // 初始化 Vditor（dynamic import，不进主站首屏依赖）
  useEffect(() => {
    if (status !== 'ready' || !editorHostRef.current || vditorRef.current) return undefined
    let disposed = false
    let vditor = null
    async function init() {
      try {
        const [{ default: Vditor }] = await Promise.all([
          import('vditor'),
          import('vditor/dist/index.css'),
        ])
        if (disposed || !editorHostRef.current) return
        vditor = new Vditor(editorHostRef.current, {
          mode: 'wysiwyg',
          value: article?.content_md || '',
          cache: { enable: false },
          counter: { enable: false },
          // 正文状态与编辑器双向同步：门禁预检在 render 中读 state，不碰 ref
          input: (value) => setContentMd(value),
          toolbar: [
            'headings',
            'bold',
            'italic',
            'strike',
            '|',
            'line',
            'quote',
            'list',
            'ordered-list',
            'check',
            '|',
            'code',
            'inline-code',
            'link',
            'table',
            'upload',
            '|',
            'undo',
            'redo',
            'fullscreen',
          ],
          upload: {
            accept: 'image/*',
            // 自定义上传：自行上传并插入，成功返回 null；失败返回错误信息
            handler: async (files) => {
              const vd = vditorRef.current
              for (const file of files) {
                updateBodyUploadCount(1)
                try {
                  const url = await uploadImage(articleId, file)
                  vd?.insertValue(`![${file.name}](${url})\n`)
                } catch (err) {
                  return `图片 ${file.name} 上传失败：${err?.message || '未知错误'}`
                } finally {
                  updateBodyUploadCount(-1)
                }
              }
              return null
            },
          },
          after: () => {
            if (!disposed) setEditorReady(true)
          },
        })
        vditorRef.current = vditor
      } catch {
        if (!disposed) setEditorFailed(true)
      }
    }
    init()
    return () => {
      disposed = true
      try {
        vditor?.destroy()
      } catch {
        // 忽略销毁异常
      }
      vditorRef.current = null
    }
  }, [status, articleId]) // eslint-disable-line react-hooks/exhaustive-deps

  const collectInput = () => ({
    title: title.trim(),
    summary: summary.trim(),
    tags: tagsText
      .split(/[,，、]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10),
    cover: cover.trim(),
    published_at: publishedAt.trim() || undefined,
    content_md: contentMd,
  })

  const handleSave = async (nextStatus) => {
    const input = collectInput()
    if (!input.title) {
      setFormError('标题必填')
      return false
    }
    setSaving(true)
    setFormError('')
    try {
      const updated = await updateAdminArticle(articleId, { ...input, ...(nextStatus ? { status: nextStatus } : {}) })
      setArticle(updated)
      const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      setSaveNote(nextStatus === 'published' ? `已上架 · ${now}` : nextStatus === 'draft' ? `已下架 · ${now}` : `已保存 · ${now}`)
      return true
    } catch (err) {
      setFormError(err?.message || '保存失败')
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleCoverFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setCoverBusy(true)
    setFormError('')
    try {
      setCover(await uploadImage(articleId, file))
    } catch (err) {
      setFormError(`封面上传失败：${err?.message || '未知错误'}`)
    } finally {
      setCoverBusy(false)
    }
  }

  const handleImportApply = ({ content, meta }) => {
    vditorRef.current?.setValue(content)
    setContentMd(content)
    if (typeof meta.title === 'string' && meta.title.trim()) setTitle(meta.title)
    if (typeof meta.summary === 'string') setSummary(meta.summary)
    if (Array.isArray(meta.tags)) setTagsText(meta.tags.join('，'))
    if (typeof meta.date === 'string' && meta.date) setPublishedAt(meta.date)
  }

  if (status === 'loading') return <p className="bg-hint">正在加载文章…</p>
  if (status === 'error' || !article) {
    return (
      <div className="bg-stateBox">
        <p>文章加载失败</p>
        <button type="button" className="bg-btnGhost" onClick={onBack}>
          返回列表
        </button>
      </div>
    )
  }

  const unreadyImages = findUnreadyImages(contentMd, cover.trim())
  const isPublished = article.status === 'published'
  const uploadBusy = bodyUploadCount > 0 || coverBusy
  const saveDisabled = saving || !editorReady || uploadBusy

  return (
    <div>
      <header className="bg-pageHead">
        <button type="button" className="bg-backLink" onClick={onBack}>
          ← 返回文章列表
        </button>
        <div className="bg-editorActions">
          {/* 编辑器就绪前禁用保存：此时读不到正文，保存会写空（防呆） */}
          <button
            type="button"
            className="bg-btnGhost"
            disabled={saveDisabled}
            onClick={() => handleSave(isPublished ? 'published' : undefined)}
          >
            {saving ? '保存中…' : isPublished ? '更新已发布文章' : '保存草稿'}
          </button>
          {isPublished ? (
            <button
              type="button"
              className="bg-btnGhost"
              disabled={saveDisabled}
              onClick={() => handleSave('draft')}
            >
              下架
            </button>
          ) : (
            <button
              type="button"
              className="bg-btnPrimary"
              disabled={saveDisabled || unreadyImages.length > 0}
              title={
                unreadyImages.length > 0
                  ? '存在未就位的图片，无法上架'
                  : uploadBusy
                    ? '图片上传中，暂不能上架'
                    : '上架'
              }
              onClick={() => handleSave('published')}
            >
              上架
            </button>
          )}
        </div>
      </header>

      {unreadyImages.length > 0 && !isPublished ? (
        <p className="bg-formError">
          存在未就位的图片（{unreadyImages.length} 张），请先上传：{unreadyImages.slice(0, 3).join('、')}
          {unreadyImages.length > 3 ? '…' : ''}
        </p>
      ) : null}
      {formError ? <p className="bg-formError">{formError}</p> : null}
      {saveNote && !formError ? <p className="bg-okLine">{saveNote}</p> : null}

      <div className="bg-formGrid">
        <label className="bg-field">
          <span className="bg-fieldLabel">标题</span>
          <input className="bg-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="bg-formRow">
          <label className="bg-field">
            <span className="bg-fieldLabel">slug（创建后固定）</span>
            <input className="bg-input bg-mono" value={article.id} readOnly disabled />
          </label>
          <label className="bg-field">
            <span className="bg-fieldLabel">标签（逗号/顿号分隔，标签内可含空格，最多 10 个）</span>
            <input
              className="bg-input"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="如：Codex，AI 工具"
            />
          </label>
        </div>
        <label className="bg-field">
          <span className="bg-fieldLabel">摘要</span>
          <input
            className="bg-input"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="列表页展示的简介"
          />
        </label>
        <div className="bg-formRow">
          <label className="bg-field bg-fieldGrow">
            <span className="bg-fieldLabel">封面（OSS 图片地址）</span>
            <input
              className="bg-input bg-mono"
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              placeholder="粘贴地址或右侧上传"
            />
          </label>
          <label className="bg-btnGhost bg-fileBtn">
            {coverBusy ? '上传中…' : '上传封面'}
            <input type="file" accept="image/*" hidden onChange={handleCoverFile} />
          </label>
        </div>
        {cover ? (
          <img className="bg-coverPreview" src={cover} alt="封面预览" loading="lazy" />
        ) : null}
      </div>

      <div className="bg-editorToolbar">
        <span className="bg-fieldLabel">正文</span>
        <button type="button" className="bg-btnGhost" onClick={() => setShowImport(true)}>
          导入 .md
        </button>
      </div>
      {editorFailed ? (
        <p className="bg-formError">编辑器加载失败，请刷新重试</p>
      ) : (
        <div ref={editorHostRef} className="bg-vditor" />
      )}
      {!editorReady && !editorFailed ? <p className="bg-hint">正在加载编辑器…</p> : null}

      {showImport ? (
        <ImportDialog
          articleId={articleId}
          onClose={() => setShowImport(false)}
          onApply={handleImportApply}
        />
      ) : null}
    </div>
  )
}

export default Editor
