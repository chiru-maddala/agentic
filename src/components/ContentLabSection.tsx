'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { marked } from 'marked'

type Status = 'new' | 'ready' | 'published'

type LabItem = {
  id: string
  type: 'article' | 'social'
  title: string
  concept: string
  status: Status
  platform?: string | null
  word_count?: number | null
  keywords?: string[]
  pillar?: string | null
  published_at?: string | null
  generated_content?: string | null
  created_at: string
}

type SubTab = 'articles' | 'social'

const DEFAULT_KEYWORDS = ['AI', 'Agentic AI', 'Enterprise AI', 'Intellina AI', 'EdTech', 'Machine Learning', 'Automation']
const PLATFORMS = ['LinkedIn', 'Instagram', 'YouTube'] as const
const PLATFORM_ICONS: Record<string, string> = { LinkedIn: '💼', Instagram: '📸', YouTube: '▶️' }

const PILLARS = [
  'AI Strategy',
  'EdTech',
  'Thought Leadership',
  'Product',
  'Research',
]

const STATUS_CONFIG: Record<Status, { label: string; color: string; dot: string }> = {
  new:       { label: 'New',       color: 'bg-gray-100 text-gray-600 border-gray-200',       dot: 'bg-gray-400' },
  ready:     { label: 'Ready',     color: 'bg-blue-50 text-blue-700 border-blue-200',         dot: 'bg-blue-500' },
  published: { label: 'Published', color: 'bg-green-50 text-green-700 border-green-200',      dot: 'bg-green-500' },
}

// ─── Tiptap editor ────────────────────────────────────────────────────────────

function mdToHtml(md: string): string {
  return marked.parse(md) as string
}

function RichEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const html = mdToHtml(content)
  const editor = useEditor({
    extensions: [StarterKit],
    content: html,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => {
    if (editor) {
      const newHtml = mdToHtml(content)
      if (editor.getHTML() !== newHtml) editor.commands.setContent(newHtml)
    }
  }, [content, editor])

  if (!editor) return null

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[#E3E0D8] bg-[#FAF9F6] flex-shrink-0 flex-wrap">
        {[
          { label: 'B',      title: 'Bold',          action: () => editor.chain().focus().toggleBold().run(),                    active: editor.isActive('bold') },
          { label: 'I',      title: 'Italic',        action: () => editor.chain().focus().toggleItalic().run(),                  active: editor.isActive('italic') },
          { label: 'H2',     title: 'Heading 2',     action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),     active: editor.isActive('heading', { level: 2 }) },
          { label: 'H3',     title: 'Heading 3',     action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),     active: editor.isActive('heading', { level: 3 }) },
          { label: '• List', title: 'Bullet list',   action: () => editor.chain().focus().toggleBulletList().run(),              active: editor.isActive('bulletList') },
          { label: '1. List',title: 'Ordered list',  action: () => editor.chain().focus().toggleOrderedList().run(),             active: editor.isActive('orderedList') },
          { label: '❝',      title: 'Blockquote',    action: () => editor.chain().focus().toggleBlockquote().run(),              active: editor.isActive('blockquote') },
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

// ─── Create modal ─────────────────────────────────────────────────────────────

function CreateModal({
  defaultType,
  onClose,
  onCreate,
}: {
  defaultType: SubTab
  onClose: () => void
  onCreate: (item: LabItem) => void
}) {
  const [type, setType] = useState<'article' | 'social'>(defaultType === 'articles' ? 'article' : 'social')
  const [title, setTitle] = useState('')
  const [concept, setConcept] = useState('')
  const [pillar, setPillar] = useState('')
  const [platform, setPlatform] = useState('LinkedIn')
  const [wordCount, setWordCount] = useState(800)
  const [keywords, setKeywords] = useState<string[]>(DEFAULT_KEYWORDS)
  const [kwInput, setKwInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addKw = () => {
    const v = kwInput.trim()
    if (v && !keywords.includes(v)) setKeywords((p) => [...p, v])
    setKwInput('')
  }

  const submit = async () => {
    if (!title.trim() || !concept.trim()) { setError('Title and brief are required.'); return }
    setSaving(true)
    const body: Record<string, unknown> = { type, title: title.trim(), concept: concept.trim(), pillar: pillar || null }
    if (type === 'article') { body.word_count = wordCount; body.keywords = keywords }
    if (type === 'social') body.platform = platform
    const res = await fetch('/api/content-lab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)
    if (data.error) { setError(data.error); return }
    onCreate(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E3E0D8] flex-shrink-0">
          <h2 className="text-base font-semibold text-[#1A1A1A]">New Content</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#1A1A1A] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Type toggle */}
          <div className="flex gap-2 p-1 bg-[#F5F3EE] rounded-xl">
            {(['articles', 'social'] as SubTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t === 'articles' ? 'article' : 'social')}
                className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${type === (t === 'articles' ? 'article' : 'social') ? 'bg-white text-[#1A1A1A] shadow-sm border border-[#E3E0D8]' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'}`}
              >
                {t === 'articles' ? '📝 Article' : '📣 Social Post'}
              </button>
            ))}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === 'article' ? 'e.g. Why AI Governance Matters in 2026' : 'e.g. The #1 mistake EdTech leaders make with AI'}
              className="w-full text-sm border border-[#E3E0D8] rounded-lg px-3 py-2 focus:outline-none focus:border-[#D4622A] bg-[#FAF9F6]"
            />
          </div>

          {/* Concept / Brief */}
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Brief / Concept</label>
            <textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              rows={3}
              placeholder="What's the core idea, angle, and target audience for this piece?"
              className="w-full text-sm border border-[#E3E0D8] rounded-lg px-3 py-2 focus:outline-none focus:border-[#D4622A] bg-[#FAF9F6] resize-none"
            />
          </div>

          {/* Pillar */}
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-2">Content Pillar</label>
            <div className="flex flex-wrap gap-2">
              {PILLARS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPillar(pillar === p ? '' : p)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${pillar === p ? 'bg-[#D4622A] text-white border-[#D4622A]' : 'border-[#E3E0D8] text-[#6B6B6B] hover:border-[#D4622A]/40 hover:text-[#D4622A]'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Article-specific */}
          {type === 'article' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-2">Word Count</label>
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
                <label className="block text-xs font-semibold text-[#374151] mb-2">Keywords</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {keywords.map((kw) => (
                    <span key={kw} className="flex items-center gap-1 text-xs bg-[#FEF3EC] text-[#D4622A] border border-[#F5D3BC] px-2 py-1 rounded-full">
                      {kw}
                      <button onClick={() => setKeywords((p) => p.filter((k) => k !== kw))} className="hover:text-red-500 ml-0.5">×</button>
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

          {/* Social-specific */}
          {type === 'social' && (
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-3">Platform</label>
              <div className="grid grid-cols-3 gap-3">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all ${platform === p ? 'border-[#D4622A] bg-[#FEF3EC]' : 'border-[#E3E0D8] hover:border-[#D4622A]/40'}`}
                  >
                    <span className="text-2xl">{PLATFORM_ICONS[p]}</span>
                    <span className="text-xs font-medium text-[#374151]">{p}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-[#E3E0D8] flex-shrink-0">
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 bg-[#D4622A] hover:bg-[#C05520] text-white text-sm font-medium py-2.5 rounded-xl transition-colors disabled:opacity-60"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
          <button onClick={onClose} className="px-5 text-sm text-[#6B6B6B] hover:text-[#1A1A1A] border border-[#E3E0D8] rounded-xl transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Content panel (right side) ───────────────────────────────────────────────

function ContentPanel({
  item,
  loading,
  streaming,
  streamContent,
  onClose,
  onRegenerate,
  onSaved,
  onStatusChange,
}: {
  item: LabItem
  loading: boolean
  streaming: boolean
  streamContent: string
  onClose: () => void
  onRegenerate: (opts: { wordCount?: number; keywords?: string[]; platform?: string }) => void
  onSaved: () => void
  onStatusChange: (status: Status) => void
}) {
  const [wordCount, setWordCount] = useState(item.word_count ?? 800)
  const [keywords, setKeywords] = useState<string[]>(item.keywords?.length ? item.keywords : DEFAULT_KEYWORDS)
  const [kwInput, setKwInput] = useState('')
  const [platform, setPlatform] = useState<string>(item.platform ?? 'LinkedIn')
  const [editedContent, setEditedContent] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showRegenerateForm, setShowRegenerateForm] = useState(false)
  const [statusDropdown, setStatusDropdown] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)

  const hasContent = !!(item.generated_content || streamContent)
  const displayContent = streaming ? streamContent : (editedContent || item.generated_content || '')

  useEffect(() => {
    if (item.generated_content && !editedContent) setEditedContent(item.generated_content)
  }, [item.generated_content])

  useEffect(() => { if (streaming) setShowRegenerateForm(false) }, [streaming])

  useEffect(() => {
    if (!streaming && streamContent) setEditedContent(streamContent)
  }, [streaming, streamContent])

  // Close status dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const saveEdits = async () => {
    if (!editedContent) return
    setSaving(true)
    await fetch(`/api/content-lab/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generated_content: editedContent, status: item.status === 'new' ? 'ready' : item.status }),
    }).catch(() => {})
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved()
  }

  const changeStatus = async (status: Status) => {
    setStatusDropdown(false)
    const body: Record<string, unknown> = { status }
    if (status === 'published') body.published_at = new Date().toISOString()
    await fetch(`/api/content-lab/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {})
    onStatusChange(status)
    onSaved()
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/share/content/${item.id}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const copyPost = () => {
    const text = displayContent.replace(/<[^>]+>/g, '')
    navigator.clipboard.writeText(text)
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

  const [selectedPillar, setSelectedPillar] = useState<string>(item.pillar ?? '')

  const savePillar = async (p: string) => {
    setSelectedPillar(p)
    await fetch(`/api/content-lab/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pillar: p || null }),
    }).catch(() => {})
    onSaved()
  }

  const cfg = STATUS_CONFIG[item.status]

  return (
    <div className="flex flex-col h-full border-l border-[#E3E0D8] bg-white min-w-0">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#E3E0D8] flex-shrink-0">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {streaming ? (
            <span className="w-3 h-3 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin flex-shrink-0" />
          ) : (
            <span className="text-base flex-shrink-0">{item.type === 'article' ? '📝' : '📣'}</span>
          )}
          <span className="text-sm font-semibold text-[#1A1A1A] truncate">{item.title}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Status dropdown */}
          <div className="relative" ref={statusRef}>
            <button
              onClick={() => setStatusDropdown((v) => !v)}
              className={`flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg transition-colors ${cfg.color}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {statusDropdown && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-[#E3E0D8] rounded-xl shadow-lg z-20 overflow-hidden w-36">
                {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([s, c]) => (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[#FAF9F6] transition-colors ${item.status === s ? 'font-semibold' : ''}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {hasContent && !streaming && (
            <>
              <button
                onClick={saveEdits}
                disabled={saving}
                className={`flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg transition-colors ${saved ? 'bg-green-50 text-green-700 border-green-200' : 'text-[#6B6B6B] bg-[#F5F3EE] border-[#E3E0D8] hover:text-[#1A1A1A]'}`}
              >
                {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
              </button>
              <button
                onClick={() => setShowRegenerateForm((v) => !v)}
                className={`flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg transition-colors ${showRegenerateForm ? 'bg-[#FEF3EC] text-[#D4622A] border-[#F5D3BC]' : 'text-[#6B6B6B] hover:text-[#D4622A] bg-[#F5F3EE] hover:bg-[#FEF3EC] border-[#E3E0D8] hover:border-[#D4622A]/30'}`}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
                </svg>
                Re-generate
              </button>
              {item.type === 'social' ? (
                <button
                  onClick={copyPost}
                  className={`flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg font-medium transition-colors ${linkCopied ? 'text-green-700 bg-green-50 border-green-200' : 'text-white bg-[#D4622A] border-[#D4622A] hover:bg-[#C05520]'}`}
                >
                  {linkCopied ? '✓ Copied!' : 'Copy Post'}
                </button>
              ) : (
                <button
                  onClick={copyLink}
                  className={`flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg transition-colors ${linkCopied ? 'text-green-700 bg-green-50 border-green-200' : 'text-[#6B6B6B] bg-[#F5F3EE] border-[#E3E0D8] hover:text-[#1A1A1A]'}`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  {linkCopied ? 'Copied!' : 'Share'}
                </button>
              )}
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
        {/* Pillar selector */}
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          <span className="text-xs text-[#9CA3AF]">Pillar:</span>
          {PILLARS.map((p) => (
            <button
              key={p}
              onClick={() => savePillar(selectedPillar === p ? '' : p)}
              className={`text-xs px-2.5 py-0.5 rounded-full border transition-all ${selectedPillar === p ? 'bg-[#D4622A] text-white border-[#D4622A]' : 'border-[#E3E0D8] text-[#6B6B6B] hover:border-[#D4622A]/40 hover:text-[#D4622A]'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex flex-col" id="content-lab-panel-body">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <span className="w-5 h-5 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && hasContent && !streaming && showRegenerateForm && (
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            <div>
              <p className="text-xs font-semibold text-[#1A1A1A] mb-1">Regenerate Settings</p>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">{item.concept}</p>
            </div>
            {item.type === 'article' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-2">Number of Words</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={300} max={2000} step={100} value={wordCount} onChange={(e) => setWordCount(Number(e.target.value))} className="flex-1 accent-[#D4622A]" />
                    <span className="text-sm font-medium text-[#1A1A1A] w-20 text-right">{wordCount} words</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-2">Keywords</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {keywords.map((kw) => (
                      <span key={kw} className="flex items-center gap-1 text-xs bg-[#FEF3EC] text-[#D4622A] border border-[#F5D3BC] px-2 py-1 rounded-full">
                        {kw}<button onClick={() => removeKw(kw)} className="hover:text-red-500 ml-0.5">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={kwInput} onChange={(e) => setKwInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKw() } }} placeholder="Add keyword…" className="flex-1 text-sm border border-[#E3E0D8] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#D4622A] bg-[#FAF9F6]" />
                    <button onClick={addKw} className="text-xs bg-[#F5F3EE] border border-[#E3E0D8] px-3 py-1.5 rounded-lg hover:bg-[#ECEAE3]">Add</button>
                  </div>
                </div>
              </>
            )}
            {item.type === 'social' && (
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-3">Platform</label>
                <div className="grid grid-cols-3 gap-3">
                  {PLATFORMS.map((p) => (
                    <button key={p} onClick={() => setPlatform(p)} className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all ${platform === p ? 'border-[#D4622A] bg-[#FEF3EC]' : 'border-[#E3E0D8] hover:border-[#D4622A]/40'}`}>
                      <span className="text-2xl">{PLATFORM_ICONS[p]}</span>
                      <span className="text-xs font-medium text-[#374151]">{p}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setShowRegenerateForm(false); onRegenerate(item.type === 'article' ? { wordCount, keywords } : { platform }) }} className="flex-1 bg-[#D4622A] hover:bg-[#C05520] text-white text-sm font-medium py-2.5 rounded-xl transition-colors">Regenerate</button>
              <button onClick={() => setShowRegenerateForm(false)} className="px-4 text-sm text-[#6B6B6B] hover:text-[#1A1A1A] border border-[#E3E0D8] rounded-xl transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {!loading && !hasContent && !streaming && (
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            <p className="text-xs text-[#9CA3AF] leading-relaxed">{item.concept}</p>
            {item.type === 'article' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-2">Number of Words</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={300} max={2000} step={100} value={wordCount} onChange={(e) => setWordCount(Number(e.target.value))} className="flex-1 accent-[#D4622A]" />
                    <span className="text-sm font-medium text-[#1A1A1A] w-20 text-right">{wordCount} words</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-2">Keywords</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {keywords.map((kw) => (
                      <span key={kw} className="flex items-center gap-1 text-xs bg-[#FEF3EC] text-[#D4622A] border border-[#F5D3BC] px-2 py-1 rounded-full">
                        {kw}<button onClick={() => removeKw(kw)} className="hover:text-red-500 ml-0.5">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={kwInput} onChange={(e) => setKwInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKw() } }} placeholder="Add keyword…" className="flex-1 text-sm border border-[#E3E0D8] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#D4622A] bg-[#FAF9F6]" />
                    <button onClick={addKw} className="text-xs bg-[#F5F3EE] border border-[#E3E0D8] px-3 py-1.5 rounded-lg hover:bg-[#ECEAE3]">Add</button>
                  </div>
                </div>
              </>
            )}
            {item.type === 'social' && (
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-3">Platform</label>
                <div className="grid grid-cols-3 gap-3">
                  {PLATFORMS.map((p) => (
                    <button key={p} onClick={() => setPlatform(p)} className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all ${platform === p ? 'border-[#D4622A] bg-[#FEF3EC]' : 'border-[#E3E0D8] hover:border-[#D4622A]/40 hover:bg-[#FAF9F6]'}`}>
                      <span className="text-2xl">{PLATFORM_ICONS[p]}</span>
                      <span className="text-sm font-medium text-[#1A1A1A]">{p}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => onRegenerate(item.type === 'article' ? { wordCount, keywords } : { platform })} className="w-full bg-[#D4622A] hover:bg-[#C05520] text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              {item.type === 'article' ? 'Generate Article' : `Generate for ${platform}`}
            </button>
          </div>
        )}

        {!loading && streaming && (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="prose prose-sm max-w-none prose-headings:text-[#1A1A1A] prose-headings:font-semibold prose-p:text-[#374151] prose-p:leading-relaxed prose-li:text-[#374151] prose-strong:text-[#1A1A1A]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamContent}</ReactMarkdown>
              <span className="inline-block w-2 h-4 bg-[#D4622A] animate-pulse ml-1 align-middle rounded-sm" />
            </div>
          </div>
        )}

        {!loading && hasContent && !streaming && !showRegenerateForm && (
          <RichEditor content={displayContent} onChange={setEditedContent} />
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
  const [panelLoading, setPanelLoading] = useState(false)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [streamContent, setStreamContent] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activePillar, setActivePillar] = useState<string>('All')
  const [activeStatus, setActiveStatus] = useState<string>('All')
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/content-lab')
    const data = await res.json()
    setItems(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (panelItem && !streamingId) {
      const updated = items.find((i) => i.id === panelItem.id)
      if (updated) setPanelItem((prev) => prev ? { ...updated, generated_content: prev.generated_content } : updated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, streamingId])

  const closePanel = () => {
    abortRef.current?.abort()
    setPanelItem(null)
    setPanelLoading(false)
    setStreamingId(null)
    setStreamContent('')
  }

  const openItem = async (item: LabItem) => {
    setStreamContent('')
    setStreamingId(null)
    setPanelLoading(true)
    setPanelItem(item)
    const res = await fetch(`/api/content-lab/${item.id}`)
    const full = await res.json()
    if (!full.error) setPanelItem(full)
    setPanelLoading(false)
  }

  const generate = async (item: LabItem, opts: { wordCount?: number; keywords?: string[]; platform?: string }) => {
    const patchBody: Record<string, unknown> = {}
    if (opts.wordCount !== undefined) patchBody.word_count = opts.wordCount
    if (opts.keywords !== undefined) patchBody.keywords = opts.keywords
    if (opts.platform !== undefined) patchBody.platform = opts.platform
    if (Object.keys(patchBody).length) {
      await fetch(`/api/content-lab/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patchBody) }).catch(() => {})
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setPanelItem(item)
    setStreamContent('')
    setStreamingId(item.id)

    try {
      const res = await fetch(`/api/content-lab/${item.id}/generate`, { method: 'POST', signal: controller.signal })
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
      setPanelItem((prev) => prev ? { ...prev, generated_content: acc, status: 'ready' } : prev)
      await load()
      setStreamingId(null)
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') setStreamingId(null)
    }
  }

  const deleteItem = async (id: string) => {
    if (panelItem?.id === id) closePanel()
    await fetch(`/api/content-lab/${id}`, { method: 'DELETE' })
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const handleStatusChange = (status: Status) => {
    setPanelItem((prev) => prev ? { ...prev, status } : prev)
    setItems((prev) => prev.map((i) => i.id === panelItem?.id ? { ...i, status } : i))
  }

  // Derive pillar list from actual items
  const usedPillars = Array.from(new Set(items.map((i) => i.pillar).filter(Boolean))) as string[]

  const typeItems = items.filter((i) => i.type === (subTab === 'articles' ? 'article' : 'social'))
  const pillarFiltered = activePillar === 'All' ? typeItems : typeItems.filter((i) => i.pillar === activePillar)
  const current = activeStatus === 'All' ? pillarFiltered : pillarFiltered.filter((i) => i.status === activeStatus)

  // Stats
  const stats = {
    new: typeItems.filter((i) => i.status === 'new').length,
    ready: typeItems.filter((i) => i.status === 'ready').length,
    published: typeItems.filter((i) => i.status === 'published').length,
  }

  return (
    <>
      {showCreateModal && (
        <CreateModal
          defaultType={subTab}
          onClose={() => setShowCreateModal(false)}
          onCreate={(item) => {
            setItems((prev) => [item, ...prev])
            setSubTab(item.type === 'article' ? 'articles' : 'social')
            openItem(item)
          }}
        />
      )}

      <div className="flex flex-col md:flex-row h-full overflow-hidden">
        {/* ── Left: list ── */}
        <div className={`flex flex-col overflow-hidden bg-[#FAF9F6] transition-all duration-300 ${panelItem ? 'hidden md:flex md:w-1/2' : 'flex w-full'}`}>
          {/* Sub-tab bar + New button */}
          <div className="border-b border-[#E3E0D8] bg-[#F5F3EE] px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 flex-1">
              {([['articles', '📝 Articles'], ['social', '📣 Social Posts']] as [SubTab, string][]).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => { setSubTab(id); setActivePillar('All'); setActiveStatus('All') }}
                  className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${subTab === id ? 'bg-white text-[#1A1A1A] border border-[#E3E0D8] shadow-sm' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 text-sm font-medium bg-[#D4622A] hover:bg-[#C05520] text-white px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {/* Header + stats */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-lg font-semibold text-[#1A1A1A]">
                  {subTab === 'articles' ? '📝 Articles' : '📣 Social Posts'}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />{stats.new} new</span>
                  <span className="text-xs text-blue-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />{stats.ready} ready</span>
                  <span className="text-xs text-green-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />{stats.published} published</span>
                </div>
              </div>
              <span className="text-xs text-[#9CA3AF] mt-1">{current.length} item{current.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Pillar filter */}
            <div className="flex flex-wrap gap-1.5 mb-3">
                {['All', ...PILLARS].map((p) => (
                  <button
                    key={p}
                    onClick={() => setActivePillar(p)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${activePillar === p ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'border-[#E3E0D8] text-[#6B6B6B] hover:border-[#1A1A1A]/30 hover:text-[#1A1A1A]'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>

            {/* Status filter */}
            <div className="flex gap-1.5 mb-4">
              {['All', 'new', 'ready', 'published'].map((s) => {
                const cfg = s === 'All' ? null : STATUS_CONFIG[s as Status]
                return (
                  <button
                    key={s}
                    onClick={() => setActiveStatus(s)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 ${activeStatus === s ? (cfg ? cfg.color + ' font-semibold' : 'bg-[#1A1A1A] text-white border-[#1A1A1A]') : 'border-[#E3E0D8] text-[#6B6B6B] hover:border-[#9CA3AF]'}`}
                  >
                    {cfg && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
                    {s === 'All' ? 'All' : STATUS_CONFIG[s as Status].label}
                  </button>
                )
              })}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <span className="w-5 h-5 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : current.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">{subTab === 'articles' ? '📝' : '📣'}</div>
                <h2 className="text-base font-semibold text-[#1A1A1A] mb-1">Nothing here yet</h2>
                <p className="text-[#9CA3AF] text-xs max-w-xs mx-auto mb-4">
                  {activePillar !== 'All' || activeStatus !== 'All'
                    ? 'Try clearing your filters.'
                    : 'Click "New" to create your first piece, or add items from the daily report.'}
                </p>
                {(activePillar !== 'All' || activeStatus !== 'All') && (
                  <button onClick={() => { setActivePillar('All'); setActiveStatus('All') }} className="text-xs text-[#D4622A] hover:underline">Clear filters</button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {current.map((item) => {
                  const isActive = panelItem?.id === item.id
                  const isStreaming = streamingId === item.id
                  const cfg = STATUS_CONFIG[item.status]
                  return (
                    <div
                      key={item.id}
                      className={`bg-white border rounded-xl p-4 transition-all group ${isActive ? 'border-[#D4622A]/40 shadow-sm' : 'border-[#E3E0D8] hover:border-[#D4622A]/30 hover:shadow-sm'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#FEF3EC] flex items-center justify-center flex-shrink-0 text-sm">
                          {item.type === 'article' ? '📝' : '📣'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[#1A1A1A] leading-snug">{item.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {item.platform && <span className="text-xs text-[#9CA3AF]">{PLATFORM_ICONS[item.platform]} {item.platform}</span>}
                                {item.pillar && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#F5F3EE] text-[#6B6B6B] border border-[#E3E0D8]">{item.pillar}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={`text-xs border px-2 py-0.5 rounded-full flex items-center gap-1 ${cfg.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                              </span>
                              <button
                                onClick={() => openItem(item)}
                                disabled={isStreaming}
                                className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${isActive && !isStreaming ? 'text-[#D4622A] border-[#D4622A]/40 bg-[#FEF3EC]' : 'text-[#6B6B6B] border-[#E3E0D8] hover:text-[#D4622A] hover:border-[#D4622A]/40 hover:bg-[#FEF3EC]'}`}
                              >
                                {isStreaming ? (
                                  <><span className="w-3 h-3 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin" />Generating…</>
                                ) : item.status !== 'new' ? (
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
                          <p className="text-xs text-[#9CA3AF] mt-1.5 line-clamp-2 leading-relaxed">{item.concept}</p>
                          {item.status === 'published' && item.published_at && (
                            <p className="text-xs text-green-600 mt-1">Published {new Date(item.published_at).toLocaleDateString()}</p>
                          )}
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
          <div className="flex flex-col w-full md:w-1/2 flex-shrink-0 h-full">
            <div className="md:hidden flex items-center px-4 py-2 bg-[#F5F3EE] border-b border-[#E3E0D8] flex-shrink-0">
              <button onClick={closePanel} className="flex items-center gap-1.5 text-sm text-[#6B6B6B] hover:text-[#1A1A1A]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ContentPanel
                key={panelItem.id}
                item={panelItem}
                loading={panelLoading}
                streaming={streamingId === panelItem.id}
                streamContent={streamContent}
                onClose={closePanel}
                onRegenerate={(opts) => generate(panelItem, opts)}
                onSaved={load}
                onStatusChange={handleStatusChange}
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
