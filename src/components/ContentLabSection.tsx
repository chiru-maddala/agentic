'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type LabItem = {
  id: string
  type: 'article' | 'social'
  title: string
  concept: string
  status: 'pending' | 'generated'
  platform?: string | null
  word_count?: number | null
  keywords?: string[]
  created_at: string
}

type SubTab = 'articles' | 'social'

// ─── Generate dialog ───────────────────────────────────────────────────────────

const DEFAULT_KEYWORDS = ['AI', 'Agentic AI', 'Enterprise AI', 'Intellina AI', 'EdTech', 'Machine Learning', 'Automation']

function ArticleDialog({
  item,
  onClose,
  onGenerated,
}: {
  item: LabItem
  onClose: () => void
  onGenerated: () => void
}) {
  const [wordCount, setWordCount] = useState(800)
  const [keywords, setKeywords] = useState<string[]>(item.keywords?.length ? item.keywords : DEFAULT_KEYWORDS)
  const [kwInput, setKwInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [stream, setStream] = useState('')
  const [done, setDone] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const removeKw = (kw: string) => setKeywords((prev) => prev.filter((k) => k !== kw))
  const addKw = () => {
    const v = kwInput.trim()
    if (v && !keywords.includes(v)) setKeywords((prev) => [...prev, v])
    setKwInput('')
  }

  const generate = async () => {
    // First update the item with latest settings
    await fetch(`/api/content-lab/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word_count: wordCount, keywords }),
    }).catch(() => {})

    setGenerating(true)
    setStream('')
    setDone(false)
    abortRef.current = new AbortController()
    try {
      const res = await fetch(`/api/content-lab/${item.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word_count: wordCount, keywords }),
        signal: abortRef.current.signal,
      })
      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done: d, value } = await reader.read()
        if (d) break
        setStream((prev) => prev + decoder.decode(value, { stream: true }))
      }
      setDone(true)
      onGenerated()
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') setStream('Generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/share/content/${item.id}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-[#E3E0D8] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-[#E3E0D8]">
          <div>
            <div className="text-xs font-medium text-[#D4622A] mb-1">📝 Article</div>
            <h2 className="text-sm font-semibold text-[#1A1A1A] leading-snug">{item.title}</h2>
          </div>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#1A1A1A] p-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {!stream ? (
          /* Settings */
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-2">Number of Words</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={300}
                  max={2000}
                  step={100}
                  value={wordCount}
                  onChange={(e) => setWordCount(Number(e.target.value))}
                  className="flex-1 accent-[#D4622A]"
                />
                <span className="text-sm font-medium text-[#1A1A1A] w-16 text-right">{wordCount} words</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-2">Preferred Keywords</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="flex items-center gap-1 text-xs bg-[#FEF3EC] text-[#D4622A] border border-[#F5D3BC] px-2 py-1 rounded-full"
                  >
                    {kw}
                    <button onClick={() => removeKw(kw)} className="hover:text-red-500 ml-0.5">×</button>
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
          </div>
        ) : (
          /* Preview */
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="prose prose-gray prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{stream}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#E3E0D8]">
          <div className="flex items-center gap-2">
            {done && (
              <button
                onClick={copyLink}
                className={`flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg transition-colors ${
                  linkCopied ? 'text-green-700 bg-green-50 border-green-200' : 'text-[#6B6B6B] border-[#E3E0D8] hover:bg-[#F5F3EE]'
                }`}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                {linkCopied ? 'Copied!' : 'Share'}
              </button>
            )}
            {stream && !generating && (
              <button onClick={() => { setStream(''); setDone(false) }} className="text-xs text-[#9CA3AF] hover:text-[#6B6B6B]">
                ← Settings
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-xs text-[#6B6B6B] hover:text-[#1A1A1A] px-3 py-1.5">Close</button>
            <button
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              {generating ? (
                <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating…</>
              ) : done ? 'Regenerate' : 'Generate Article'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SocialDialog({
  item,
  onClose,
  onGenerated,
}: {
  item: LabItem
  onClose: () => void
  onGenerated: () => void
}) {
  const [platform, setPlatform] = useState<'LinkedIn' | 'Instagram' | 'YouTube'>(
    (item.platform as 'LinkedIn' | 'Instagram' | 'YouTube') ?? 'LinkedIn'
  )
  const [generating, setGenerating] = useState(false)
  const [stream, setStream] = useState('')
  const [done, setDone] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const generate = async () => {
    // Update platform on item
    await fetch(`/api/content-lab/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform }),
    }).catch(() => {})

    setGenerating(true)
    setStream('')
    setDone(false)
    try {
      const res = await fetch(`/api/content-lab/${item.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done: d, value } = await reader.read()
        if (d) break
        setStream((prev) => prev + decoder.decode(value, { stream: true }))
      }
      setDone(true)
      onGenerated()
    } catch {
      setStream('Generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/share/content/${item.id}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const PLATFORMS: ('LinkedIn' | 'Instagram' | 'YouTube')[] = ['LinkedIn', 'Instagram', 'YouTube']
  const PLATFORM_ICONS: Record<string, string> = { LinkedIn: '💼', Instagram: '📸', YouTube: '▶️' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-[#E3E0D8] flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between px-6 py-4 border-b border-[#E3E0D8]">
          <div>
            <div className="text-xs font-medium text-[#D4622A] mb-1">📣 Social Post</div>
            <h2 className="text-sm font-semibold text-[#1A1A1A] leading-snug">{item.title}</h2>
          </div>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#1A1A1A] p-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {!stream ? (
          <div className="flex-1 px-6 py-5">
            <label className="block text-xs font-medium text-[#374151] mb-3">Select Platform</label>
            <div className="grid grid-cols-3 gap-3">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all ${
                    platform === p
                      ? 'border-[#D4622A] bg-[#FEF3EC]'
                      : 'border-[#E3E0D8] hover:border-[#D4622A]/40 hover:bg-[#FAF9F6]'
                  }`}
                >
                  <span className="text-2xl">{PLATFORM_ICONS[p]}</span>
                  <span className="text-sm font-medium text-[#1A1A1A]">{p}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="prose prose-gray prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{stream}</ReactMarkdown>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-3 border-t border-[#E3E0D8]">
          <div className="flex items-center gap-2">
            {done && (
              <button
                onClick={copyLink}
                className={`flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg transition-colors ${
                  linkCopied ? 'text-green-700 bg-green-50 border-green-200' : 'text-[#6B6B6B] border-[#E3E0D8] hover:bg-[#F5F3EE]'
                }`}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                {linkCopied ? 'Copied!' : 'Share'}
              </button>
            )}
            {stream && !generating && (
              <button onClick={() => { setStream(''); setDone(false) }} className="text-xs text-[#9CA3AF] hover:text-[#6B6B6B]">
                ← Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-xs text-[#6B6B6B] hover:text-[#1A1A1A] px-3 py-1.5">Close</button>
            <button
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              {generating ? (
                <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating…</>
              ) : done ? 'Regenerate' : `Generate for ${platform}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Item card ────────────────────────────────────────────────────────────────

function LabItemCard({
  item,
  onDelete,
  onGenerated,
}: {
  item: LabItem
  onDelete: () => void
  onGenerated: () => void
}) {
  const [showDialog, setShowDialog] = useState(false)

  return (
    <>
      <div className="bg-white border border-[#E3E0D8] rounded-xl p-4 hover:border-[#D4622A]/30 hover:shadow-sm transition-all group">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FEF3EC] flex items-center justify-center flex-shrink-0 text-base">
            {item.type === 'article' ? '📝' : '📣'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[#1A1A1A] leading-snug">{item.title}</p>
                {item.platform && (
                  <span className="text-xs text-[#9CA3AF]">{item.platform}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {item.status === 'generated' && (
                  <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">Generated</span>
                )}
                <button
                  onClick={() => setShowDialog(true)}
                  className="text-xs bg-[#D4622A] hover:bg-[#C05520] text-white px-2.5 py-1 rounded-lg transition-colors"
                >
                  {item.status === 'generated' ? 'View / Edit' : 'Generate'}
                </button>
                <button
                  onClick={() => { if (window.confirm('Delete this item?')) onDelete() }}
                  className="opacity-0 group-hover:opacity-100 text-[#9CA3AF] hover:text-red-500 p-1 transition-all"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-1.5 leading-relaxed">{item.concept}</p>
          </div>
        </div>
      </div>

      {showDialog && item.type === 'article' && (
        <ArticleDialog item={item} onClose={() => setShowDialog(false)} onGenerated={onGenerated} />
      )}
      {showDialog && item.type === 'social' && (
        <SocialDialog item={item} onClose={() => setShowDialog(false)} onGenerated={onGenerated} />
      )}
    </>
  )
}

// ─── Main section ─────────────────────────────────────────────────────────────

export default function ContentLabSection() {
  const [subTab, setSubTab] = useState<SubTab>('articles')
  const [items, setItems] = useState<LabItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch('/api/content-lab')
    const data = await res.json()
    setItems(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const deleteItem = async (id: string) => {
    await fetch(`/api/content-lab/${id}`, { method: 'DELETE' })
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const articles = items.filter((i) => i.type === 'article')
  const socialPosts = items.filter((i) => i.type === 'social')
  const current = subTab === 'articles' ? articles : socialPosts

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF9F6]">
      {/* Sub-tab bar */}
      <div className="border-b border-[#E3E0D8] bg-[#F5F3EE] px-6 py-3 flex items-center gap-4">
        {([['articles', '📝 Articles'], ['social', '📣 Social Posts']] as [SubTab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
              subTab === id
                ? 'bg-white text-[#1A1A1A] border border-[#E3E0D8] shadow-sm'
                : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold text-[#1A1A1A]">
              {subTab === 'articles' ? '📝 Articles' : '📣 Social Posts'}
            </h1>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              {subTab === 'articles'
                ? 'Generate blog articles from your daily AI intelligence signals.'
                : 'Create platform-optimized social media content from market insights.'}
            </p>
          </div>
          <span className="text-xs text-[#9CA3AF]">
            {current.length} item{current.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="w-5 h-5 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : current.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">{subTab === 'articles' ? '📝' : '📣'}</div>
            <h2 className="text-lg font-semibold text-[#1A1A1A] mb-2">No {subTab === 'articles' ? 'articles' : 'social posts'} yet</h2>
            <p className="text-[#9CA3AF] text-sm max-w-xs mx-auto">
              Open a daily report, scroll to &quot;Content Lab Suggestions&quot;, and click &quot;Add to Lab&quot; to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {current.map((item) => (
              <LabItemCard
                key={item.id}
                item={item}
                onDelete={() => deleteItem(item.id)}
                onGenerated={load}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
