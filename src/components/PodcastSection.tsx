'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Episode = {
  id: string
  title: string
  created_at: string
}

export default function PodcastSection() {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [streaming, setStreaming] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showList, setShowList] = useState(true)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const loadEpisodes = useCallback(async () => {
    const res = await fetch('/api/podcast')
    const data = await res.json()
    setEpisodes(Array.isArray(data) ? data : [])
    return Array.isArray(data) ? data : []
  }, [])

  const loadEpisode = useCallback(async (id: string) => {
    setSelectedId(id)
    setStreaming(false)
    setShowList(false)
    const res = await fetch(`/api/podcast/${id}`)
    const data = await res.json()
    setContent(data.content ?? '')
  }, [])

  useEffect(() => {
    loadEpisodes().then((data) => {
      if (data[0]) loadEpisode(data[0].id)
    })
  }, [loadEpisodes, loadEpisode])

  const generate = async () => {
    setGenerating(true)
    setSelectedId(null)
    setContent('')
    setStreaming(true)
    setShowList(false)

    const res = await fetch('/api/podcast/generate', { method: 'POST' })
    if (!res.body) return

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      setContent((prev) => prev + decoder.decode(value, { stream: true }))
    }

    setStreaming(false)
    setGenerating(false)

    const data = await loadEpisodes()
    if (data[0]) {
      setSelectedId(data[0].id)
    }
  }

  const deleteEpisode = async () => {
    if (!selectedId) return
    if (!window.confirm('Delete this episode prep? This cannot be undone.')) return
    await fetch(`/api/podcast/${selectedId}`, { method: 'DELETE' })
    setSelectedId(null)
    setContent('')
    const data = await loadEpisodes()
    if (data[0]) loadEpisode(data[0].id)
    else setShowList(true)
  }

  const selectedEpisode = episodes.find((e) => e.id === selectedId)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar — episode list */}
      <aside className={`
        flex-shrink-0 w-64 bg-[#F5F3EE] border-r border-[#E3E0D8] flex flex-col
        ${showList ? 'flex' : 'hidden md:flex'}
      `}>
        <div className="p-3 border-b border-[#E3E0D8]">
          <button
            onClick={generate}
            disabled={generating}
            className="w-full bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>🎙️ Generate</>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs text-[#9CA3AF] uppercase tracking-wider mb-2 px-1">Episodes</p>
          {episodes.length === 0 && (
            <p className="text-xs text-[#9CA3AF] px-1">No episodes yet.</p>
          )}
          {episodes.map((ep) => (
            <button
              key={ep.id}
              onClick={() => loadEpisode(ep.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-all ${
                selectedId === ep.id
                  ? 'bg-white border border-[#E3E0D8] shadow-sm text-[#1A1A1A]'
                  : 'text-[#6B6B6B] hover:bg-[#ECEAE3] hover:text-[#1A1A1A]'
              }`}
            >
              <p className="text-xs font-medium leading-snug line-clamp-2">{ep.title}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                {new Date(ep.created_at).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
                })}
              </p>
            </button>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 overflow-y-auto ${showList && !selectedId ? 'hidden md:block' : ''}`}>
        {content ? (
          <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10">
            {/* Mobile back */}
            <button
              onClick={() => setShowList(true)}
              className="md:hidden flex items-center gap-1 text-sm text-[#6B6B6B] hover:text-[#1A1A1A] mb-4 -ml-1"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              All Episodes
            </button>

            {selectedEpisode && !streaming && (
              <div className="flex flex-wrap items-center gap-2 justify-between mb-6">
                <span className="text-xs text-[#9CA3AF]">
                  {new Date(selectedEpisode.created_at).toLocaleString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    hour: 'numeric', minute: '2-digit', hour12: true,
                  })}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/share/podcast/${selectedId}`
                      navigator.clipboard.writeText(url).then(() => {
                        setLinkCopied(true)
                        setTimeout(() => setLinkCopied(false), 2000)
                      })
                    }}
                    className={`flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg transition-colors ${
                      linkCopied
                        ? 'text-green-700 bg-green-50 border-green-200'
                        : 'text-[#6B6B6B] hover:text-[#1A1A1A] bg-white hover:bg-[#F5F3EE] border-[#E3E0D8]'
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                    {linkCopied ? 'Copied!' : 'Share'}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(content).then(() => {
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      })
                    }}
                    className={`flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg transition-colors ${
                      copied
                        ? 'text-green-700 bg-green-50 border-green-200'
                        : 'text-[#6B6B6B] hover:text-[#1A1A1A] bg-white hover:bg-[#F5F3EE] border-[#E3E0D8]'
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={deleteEpisode}
                    className="flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-red-500 bg-white hover:bg-[#F5F3EE] border border-[#E3E0D8] px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            )}

            <div ref={contentRef} className="prose prose-sm max-w-none
              prose-headings:text-[#1A1A1A] prose-headings:font-semibold
              prose-p:text-[#374151] prose-p:leading-relaxed
              prose-strong:text-[#1A1A1A]
              prose-a:text-[#D4622A] prose-a:no-underline hover:prose-a:underline
              prose-code:text-[#D4622A] prose-code:bg-[#FEF3EC] prose-code:px-1 prose-code:rounded
              prose-pre:bg-[#F5F3EE] prose-pre:border prose-pre:border-[#E3E0D8]
              prose-blockquote:border-l-[#D4622A] prose-blockquote:text-[#6B6B6B]
              prose-hr:border-[#E3E0D8]
              prose-li:text-[#374151]
              prose-th:text-[#1A1A1A] prose-td:text-[#374151]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              {streaming && (
                <span className="inline-block w-2 h-4 bg-[#D4622A] animate-pulse ml-1 align-middle rounded-sm" />
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="text-5xl mb-4">🎙️</div>
            <h2 className="text-xl font-semibold text-[#1A1A1A] mb-2">The AI Sense</h2>
            <p className="text-[#9CA3AF] text-sm max-w-xs mb-1">
              Your podcast research space within the MARS framework.
            </p>
            <p className="text-[#9CA3AF] text-sm max-w-xs">
              Click <strong className="text-[#D4622A]">Generate</strong> to get today&apos;s top 10 talking points and episode brief.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
