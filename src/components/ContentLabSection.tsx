'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

type LabItem = {
  id: string
  type: 'article' | 'social'
  title: string
  concept: string
  status: 'pending' | 'generated'
  platform?: string | null
  word_count?: number | null
  keywords?: string[]
  generated_content?: string | null
  created_at: string
}

type SubTab = 'articles' | 'social'

const DEFAULT_KEYWORDS = ['AI', 'Agentic AI', 'Enterprise AI', 'Intellina AI', 'EdTech', 'Machine Learning', 'Automation']
const PLATFORMS = ['LinkedIn', 'Instagram', 'YouTube'] as const
const PLATFORM_ICONS: Record<string, string> = { LinkedIn: '💼', Instagram: '📸', YouTube: '▶️' }

// ─── Tiptap editor for generated content ─────────────────────────────────────

function RichEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => {
    if (editor && content && editor.getHTML() !== content) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  if (!editor) return null

  return (
    <div className="flex flex-col h-full">
      {/* Mini toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[#E3E0D8] bg-[#FAF9F6] flex-shrink-0 flex-wrap">
        {[
          { label: 'B', title: 'Bold', action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
          { label: 'I', title: 'Italic', action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
          { label: 'H2', title: 'Heading 2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
          { label: 'H3', title: 'Heading 3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
          { label: '• List', title: 'Bullet list', action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
          { label: '1. List', title: 'Ordered list', action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
          { label: '❝', title: 'Blockquote', action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
        ].map(({ label, title, action, active }) => (
          <button
            key={title}
            onMouseDown={(e) => { e.preventDefault(); action() }}
            title={title}
            className={`text-xs px-2 py-1 rounded transition-colors ${active ? 'bg-[#D4622A] text-white' : 'text-[#6B6B6B] hover:bg-[#ECEAE3]'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <EditorContent
        editor={editor}
        className="flex-1 overflow-y-auto px-6 py-5 prose prose-sm max-w-none focus:outline-none
          prose-headings:text-[#1A1A1A] prose-headings:font-semibold
          prose-p:text-[#374151] prose-p:leading-relaxed
          prose-strong:text-[#1A1A1A] prose-li:text-[#374151]
          [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-full"
      />
    </div>
  )
}

// ─── Content panel (right side) ───────────────────────────────────────────────

function ContentPanel({
  item,
  streaming,
  streamContent,
  onClose,
  onRegenerate,
  onSaved,
}: {
  item: LabItem
  streaming: boolean
  streamContent: string
  onClose: () => void
  onRegenerate: (opts: { wordCount?: number; keywords?: string[]; platform?: string }) => void
  onSaved: () => void
}) {
  // Settings state (pre-generate)
  const [wordCount, setWordCount] = useState(item.word_count ?? 800)
  const [keywords, setKeywords] = useState<string[]>(item.keywords?.length ? item.keywords : DEFAULT_KEYWORDS)
  const [kwInput, setKwInput] = useState('')
  const [platform, setPlatform] = useState<string>(item.platform ?? 'LinkedIn')

  // Editor content (post-generate)
  const [editedContent, setEditedContent] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const hasContent = !!(item.generated_content || streamContent)
  const displayContent = streaming ? streamContent : (editedContent || item.generated_content || '')

  // When item loads with existing content, init editor
  useEffect(() => {
    if (item.generated_content && !editedContent) {
      setEditedContent(item.generated_content)
    }
  }, [item.generated_content])

  // When stream finishes, set editor content
  useEffect(() => {
    if (!streaming && streamContent) {
      setEditedContent(streamContent)
    }
  }, [streaming, streamContent])

  const saveEdits = async () => {
    if (!editedContent) return
    setSaving(true)
    await fetch(`/api/content-lab/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generated_content: editedContent, status: 'generated' }),
    }).catch(() => {})
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved()
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/share/content/${item.id}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const downloadPDF = async () => {
    const { default: html2canvas } = await import('html2canvas')
    const { default: jsPDF } = await import('jspdf')
    const el = document.getElementById('content-lab-panel-body')
    if (!el) return
    const clone = el.cloneNode(true) as HTMLElement
    clone.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:760px;padding:48px;background:white;color:#111827;font-family:Georgia,serif;font-size:14px;line-height:1.8;'
    document.body.appendChild(clone)
    try {
      const canvas = await html2canvas(clone, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 30
      const imgW = pageW - margin * 2
      const imgH = (canvas.height * imgW) / canvas.width
      const contentH = pageH - margin * 2
      const pages = Math.ceil(imgH / contentH)
      for (let i = 0; i < pages; i++) {
        if (i > 0) pdf.addPage()
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin - i * contentH, imgW, imgH)
      }
      pdf.save(`${item.title.slice(0, 40)}.pdf`)
    } finally {
      document.body.removeChild(clone)
    }
  }

  const removeKw = (kw: string) => setKeywords((prev) => prev.filter((k) => k !== kw))
  const addKw = () => {
    const v = kwInput.trim()
    if (v && !keywords.includes(v)) setKeywords((prev) => [...prev, v])
    setKwInput('')
  }

  return (
    <div className="flex flex-col h-full border-l border-[#E3E0D8] bg-white min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#E3E0D8] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {streaming ? (
            <span className="w-3 h-3 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin flex-shrink-0" />
          ) : (
            <span className="text-base flex-shrink-0">{item.type === 'article' ? '📝' : '📣'}</span>
          )}
          <span className="text-sm font-semibold text-[#1A1A1A] truncate">{item.title}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {hasContent && !streaming && (
            <>
              <button
                onClick={saveEdits}
                disabled={saving}
                className={`flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg transition-colors ${
                  saved ? 'bg-green-50 text-green-700 border-green-200' : 'text-[#6B6B6B] bg-[#F5F3EE] border-[#E3E0D8] hover:text-[#1A1A1A]'
                }`}
              >
                {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
              </button>
              <button
                onClick={() => onRegenerate(item.type === 'article' ? { wordCount, keywords } : { platform })}
                className="flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-[#D4622A] bg-[#F5F3EE] hover:bg-[#FEF3EC] border border-[#E3E0D8] hover:border-[#D4622A]/30 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
                </svg>
                Re-generate
              </button>
              <button
                onClick={copyLink}
                className={`flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg transition-colors ${
                  linkCopied ? 'text-green-700 bg-green-50 border-green-200' : 'text-[#6B6B6B] bg-[#F5F3EE] border-[#E3E0D8] hover:text-[#1A1A1A]'
                }`}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                {linkCopied ? 'Copied!' : 'Share'}
              </button>
              <button
                onClick={downloadPDF}
                className="flex items-center gap-1.5 text-xs text-[#6B6B6B] bg-[#F5F3EE] border border-[#E3E0D8] px-2.5 py-1.5 rounded-lg hover:text-[#1A1A1A] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                PDF
              </button>
            </>
          )}
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#1A1A1A] p-1 transition-colors ml-1">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex flex-col" id="content-lab-panel-body">
        {/* If no content yet — show settings */}
        {!hasContent && !streaming && (
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            <div>
              <p className="text-xs text-[#9CA3AF] mb-4 leading-relaxed">{item.concept}</p>
            </div>

            {item.type === 'article' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-2">Number of Words</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min={300} max={2000} step={100} value={wordCount}
                      onChange={(e) => setWordCount(Number(e.target.value))}
                      className="flex-1 accent-[#D4622A]"
                    />
                    <span className="text-sm font-medium text-[#1A1A1A] w-20 text-right">{wordCount} words</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-2">Preferred Keywords</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {keywords.map((kw) => (
                      <span key={kw} className="flex items-center gap-1 text-xs bg-[#FEF3EC] text-[#D4622A] border border-[#F5D3BC] px-2 py-1 rounded-full">
                        {kw}
                        <button onClick={() => removeKw(kw)} className="hover:text-red-500 ml-0.5 leading-none">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={kwInput}
                      onChange={(e) => setKwInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKw() } }}
                      placeholder="Add keyword…"
                      className="flex-1 text-sm border border-[#E3E0D8] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#D4622A] bg-[#FAF9F6]"
                    />
                    <button onClick={addKw} className="text-xs bg-[#F5F3EE] border border-[#E3E0D8] px-3 py-1.5 rounded-lg hover:bg-[#ECEAE3]">Add</button>
                  </div>
                </div>
              </>
            )}

            {item.type === 'social' && (
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-3">Select Platform</label>
                <div className="grid grid-cols-3 gap-3">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all ${
                        platform === p ? 'border-[#D4622A] bg-[#FEF3EC]' : 'border-[#E3E0D8] hover:border-[#D4622A]/40 hover:bg-[#FAF9F6]'
                      }`}
                    >
                      <span className="text-2xl">{PLATFORM_ICONS[p]}</span>
                      <span className="text-sm font-medium text-[#1A1A1A]">{p}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => onRegenerate(item.type === 'article' ? { wordCount, keywords } : { platform })}
              className="w-full bg-[#D4622A] hover:bg-[#C05520] text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              {item.type === 'article' ? 'Generate Article' : `Generate for ${platform}`}
            </button>
          </div>
        )}

        {/* Streaming placeholder */}
        {streaming && (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="prose prose-sm max-w-none prose-headings:text-[#1A1A1A] prose-p:text-[#374151] prose-p:leading-relaxed prose-li:text-[#374151]">
              <div dangerouslySetInnerHTML={{ __html: streamContent.replace(/\n/g, '<br/>') }} />
              <span className="inline-block w-2 h-4 bg-[#D4622A] animate-pulse ml-1 align-middle rounded-sm" />
            </div>
          </div>
        )}

        {/* Rich text editor — shown when content exists and not streaming */}
        {hasContent && !streaming && (
          <RichEditor
            content={displayContent}
            onChange={setEditedContent}
          />
        )}
      </div>
    </div>
  )
}

// ─── Main section ─────────────────────────────────────────────────────────────

export default function ContentLabSection() {
  const [subTab, setSubTab] = useState<SubTab>('articles')
  const [items, setItems] = useState<LabItem[]>([])
  const [loading, setLoading] = useState(true)
  const [panelItem, setPanelItem] = useState<LabItem | null>(null)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [streamContent, setStreamContent] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/content-lab')
    const data = await res.json()
    setItems(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Keep panelItem synced after reload
  useEffect(() => {
    if (panelItem && !streamingId) {
      const updated = items.find((i) => i.id === panelItem.id)
      if (updated) setPanelItem(updated)
    }
  }, [items, panelItem, streamingId])

  const closePanel = () => {
    abortRef.current?.abort()
    setPanelItem(null)
    setStreamingId(null)
    setStreamContent('')
  }

  const openItem = (item: LabItem) => {
    setPanelItem(item)
    setStreamContent('')
    setStreamingId(null)
  }

  const generate = async (item: LabItem, opts: { wordCount?: number; keywords?: string[]; platform?: string }) => {
    // Patch settings first
    const patchBody: Record<string, unknown> = {}
    if (opts.wordCount !== undefined) patchBody.word_count = opts.wordCount
    if (opts.keywords !== undefined) patchBody.keywords = opts.keywords
    if (opts.platform !== undefined) patchBody.platform = opts.platform
    if (Object.keys(patchBody).length) {
      await fetch(`/api/content-lab/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      }).catch(() => {})
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setPanelItem(item)
    setStreamContent('')
    setStreamingId(item.id)

    try {
      const res = await fetch(`/api/content-lab/${item.id}/generate`, {
        method: 'POST',
        signal: controller.signal,
      })
      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setStreamContent(acc)
      }
      await load()
      setStreamingId(null)
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        setStreamingId(null)
      }
    }
  }

  const deleteItem = async (id: string) => {
    if (panelItem?.id === id) closePanel()
    await fetch(`/api/content-lab/${id}`, { method: 'DELETE' })
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const articles = items.filter((i) => i.type === 'article')
  const socialPosts = items.filter((i) => i.type === 'social')
  const current = subTab === 'articles' ? articles : socialPosts

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: item list ── */}
      <div className={`flex flex-col overflow-hidden bg-[#FAF9F6] transition-all duration-300 ${panelItem ? 'w-1/2' : 'w-full'}`}>
        {/* Sub-tab bar */}
        <div className="border-b border-[#E3E0D8] bg-[#F5F3EE] px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
          {([['articles', '📝 Articles'], ['social', '📣 Social Posts']] as [SubTab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                subTab === id ? 'bg-white text-[#1A1A1A] border border-[#E3E0D8] shadow-sm' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-[#1A1A1A]">
              {subTab === 'articles' ? '📝 Articles' : '📣 Social Posts'}
            </h1>
            <span className="text-xs text-[#9CA3AF]">{current.length} item{current.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <span className="w-5 h-5 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : current.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">{subTab === 'articles' ? '📝' : '📣'}</div>
              <h2 className="text-base font-semibold text-[#1A1A1A] mb-1">No {subTab === 'articles' ? 'articles' : 'social posts'} yet</h2>
              <p className="text-[#9CA3AF] text-xs max-w-xs mx-auto">
                Open a daily report, scroll to &quot;Content Lab Suggestions&quot;, and click &quot;Add to Lab&quot; to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {current.map((item) => {
                const isActive = panelItem?.id === item.id
                const isStreaming = streamingId === item.id
                return (
                  <div
                    key={item.id}
                    className={`bg-white border rounded-xl p-4 transition-all group ${
                      isActive ? 'border-[#D4622A]/40 shadow-sm' : 'border-[#E3E0D8] hover:border-[#D4622A]/30 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#FEF3EC] flex items-center justify-center flex-shrink-0 text-sm">
                        {item.type === 'article' ? '📝' : '📣'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#1A1A1A] leading-snug truncate">{item.title}</p>
                            {item.platform && <span className="text-xs text-[#9CA3AF]">{item.platform}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {item.status === 'generated' && (
                              <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">Generated</span>
                            )}
                            <button
                              onClick={() => isActive ? generate(item, {}) : openItem(item)}
                              disabled={isStreaming}
                              className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
                                isActive && !isStreaming
                                  ? 'text-[#D4622A] border-[#D4622A]/40 bg-[#FEF3EC]'
                                  : 'text-[#6B6B6B] border-[#E3E0D8] hover:text-[#D4622A] hover:border-[#D4622A]/40 hover:bg-[#FEF3EC]'
                              }`}
                            >
                              {isStreaming ? (
                                <><span className="w-3 h-3 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin" />Generating…</>
                              ) : item.status === 'generated' ? (
                                <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>View</>
                              ) : (
                                <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>Generate</>
                              )}
                            </button>
                            <button
                              onClick={() => { if (window.confirm('Delete this item?')) deleteItem(item.id) }}
                              className="opacity-0 group-hover:opacity-100 text-[#C4BFB5] hover:text-red-500 transition-all text-xs p-1 rounded"
                            >✕</button>
                          </div>
                        </div>
                        <p className="text-xs text-[#9CA3AF] mt-1 line-clamp-2 leading-relaxed">{item.concept}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: content panel ── */}
      {panelItem && (
        <div className="w-1/2 flex-shrink-0 h-full">
          <ContentPanel
            item={panelItem}
            streaming={streamingId === panelItem.id}
            streamContent={streamContent}
            onClose={closePanel}
            onRegenerate={(opts) => generate(panelItem, opts)}
            onSaved={load}
          />
        </div>
      )}
    </div>
  )
}
