'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReportDisplay from './ReportDisplay'
import { createClient } from '@/lib/supabase-browser'

type Source = { type: 'pdf' | 'url'; name: string; url: string }

type ResearchReport = {
  id: string
  title: string
  sources: Source[]
  created_at: string
  content?: string
}

export default function ResearchSection({ onContextChange }: { onContextChange?: (ctx: string) => void }) {
  const [reports, setReports] = useState<ResearchReport[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [sources, setSources] = useState<Source[]>([])
  const [streaming, setStreaming] = useState(false)

  // Input state
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [urlInput, setUrlInput] = useState('')
  const [pendingUrls, setPendingUrls] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [dragging, setDragging] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  // PDF viewer
  const [viewingPdf, setViewingPdf] = useState<Source | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  // Mobile
  const [showList, setShowList] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchReports = useCallback(async () => {
    const res = await fetch('/api/research')
    const data = await res.json()
    setReports(data)
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  const loadReport = useCallback(async (id: string) => {
    setSelectedId(id)
    setShowList(false)
    setContent('')
    setSources([])
    const res = await fetch(`/api/research/${id}`)
    const data = await res.json()
    const loaded = data.content ?? ''
    setContent(loaded)
    setSources(data.sources ?? [])
    if (loaded) onContextChange?.(`research. Viewing research report "${data.title ?? 'Untitled'}". Content: ${loaded.slice(0, 1200)}`)
  }, [onContextChange])

  const addUrl = () => {
    const trimmed = urlInput.trim()
    if (!trimmed) return
    try { new URL(trimmed) } catch { return }
    setPendingUrls((prev) => [...prev, trimmed])
    setUrlInput('')
  }

  const handleFiles = (files: FileList | File[]) => {
    const pdfs = Array.from(files).filter((f) => f.type === 'application/pdf')
    setPendingFiles((prev) => [...prev, ...pdfs])
  }

  const analyze = async () => {
    if (pendingFiles.length === 0 && pendingUrls.length === 0) return
    setAnalyzing(true)
    setSelectedId(null)
    setContent('')
    setSources([])
    setStreaming(true)
    setShowList(false)

    // Upload PDFs directly from browser to Supabase Storage (bypasses Vercel payload limit)
    const supabase = createClient()
    const uploadedPdfs: { name: string; storagePath: string; publicUrl: string }[] = []

    for (const file of pendingFiles) {
      const storagePath = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error } = await supabase.storage
        .from('research-pdfs')
        .upload(storagePath, file, { contentType: 'application/pdf', upsert: false })

      if (!error) {
        const { data: urlData } = supabase.storage.from('research-pdfs').getPublicUrl(storagePath)
        uploadedPdfs.push({ name: file.name, storagePath, publicUrl: urlData.publicUrl })
      }
    }

    const res = await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title || `Research — ${new Date().toLocaleDateString()}`,
        urls: pendingUrls,
        pdfs: uploadedPdfs,
      }),
    })
    if (!res.body) return

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      setContent((prev) => prev + decoder.decode(value, { stream: true }))
    }

    setStreaming(false)
    setAnalyzing(false)
    setPendingFiles([])
    setPendingUrls([])
    setTitle('')

    await fetchReports()
    const listRes = await fetch('/api/research')
    const reports = await listRes.json()
    if (reports[0]) loadReport(reports[0].id)
  }

  const deleteReport = async () => {
    if (!selectedId) return
    if (!window.confirm('Delete this research report?')) return
    await fetch(`/api/research/${selectedId}`, { method: 'DELETE' })
    setSelectedId(null)
    setContent('')
    setSources([])
    setShowList(true)
    fetchReports()
  }

  const hasPending = pendingFiles.length > 0 || pendingUrls.length > 0

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside className={`
        flex-shrink-0 w-64 bg-[#F5F3EE] border-r border-[#E3E0D8] flex flex-col
        ${showList ? 'flex' : 'hidden'} md:flex
      `}>
        <div className="p-3 border-b border-[#E3E0D8]">
          <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider px-1 mb-3">Research</h2>

          {/* Title */}
          <input
            type="text"
            placeholder="Report title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-sm bg-white border border-[#E3E0D8] rounded-lg px-3 py-2 mb-2 text-[#1A1A1A] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#D4622A]"
          />

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors mb-2 ${
              dragging ? 'border-[#D4622A] bg-[#FEF3EC]' : 'border-[#D1CBBF] hover:border-[#D4622A] hover:bg-[#FEF3EC]'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          >
            <svg className="w-5 h-5 mx-auto mb-1 text-[#9CA3AF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <p className="text-xs text-[#9CA3AF]">Drop PDFs here or click</p>
            <input ref={fileInputRef} type="file" accept=".pdf" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
          </div>

          {/* URL input */}
          <div className="flex gap-1 mb-2">
            <input
              type="url"
              placeholder="Paste a URL..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addUrl()}
              className="flex-1 text-xs bg-white border border-[#E3E0D8] rounded-lg px-2 py-1.5 text-[#1A1A1A] placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#D4622A] min-w-0"
            />
            <button
              onClick={addUrl}
              className="text-xs bg-[#E3E0D8] hover:bg-[#D1CBBF] text-[#6B6B6B] px-2 py-1.5 rounded-lg transition-colors flex-shrink-0"
            >
              Add
            </button>
          </div>

          {/* Pending sources */}
          {hasPending && (
            <div className="space-y-1 mb-2">
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs bg-white border border-[#E3E0D8] rounded-lg px-2 py-1">
                  <svg className="w-3 h-3 text-[#D4622A] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span className="truncate flex-1 text-[#374151]">{f.name}</span>
                  <button onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))} className="text-[#9CA3AF] hover:text-red-400 flex-shrink-0">×</button>
                </div>
              ))}
              {pendingUrls.map((u, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs bg-white border border-[#E3E0D8] rounded-lg px-2 py-1">
                  <svg className="w-3 h-3 text-[#6B6B6B] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  <span className="truncate flex-1 text-[#374151]">{u}</span>
                  <button onClick={() => setPendingUrls((p) => p.filter((_, j) => j !== i))} className="text-[#9CA3AF] hover:text-red-400 flex-shrink-0">×</button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={analyze}
            disabled={!hasPending || analyzing}
            className="w-full bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {analyzing ? (
              <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Analyzing...</>
            ) : (
              <>&#128269; Analyze Sources</>
            )}
          </button>
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs text-[#9CA3AF] uppercase tracking-wider mb-2 px-1">History</p>
          {reports.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] px-2 py-4">No research reports yet.</p>
          ) : (
            <ul className="space-y-1">
              {reports.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => loadReport(r.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedId === r.id
                        ? 'bg-[#E8E4DC] text-[#1A1A1A] font-medium'
                        : 'text-[#6B6B6B] hover:bg-[#ECEAE3] hover:text-[#1A1A1A]'
                    }`}
                  >
                    <div className="font-medium truncate">{r.title || 'Research Report'}</div>
                    <div className="text-xs text-[#9CA3AF] mt-0.5">
                      {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {(r.sources || []).slice(0, 3).map((s, i) => (
                        <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.type === 'pdf' ? 'bg-[#FEF3EC] text-[#D4622A]' : 'bg-[#F3F4F6] text-[#6B6B6B]'}`}>
                          {s.type === 'pdf' ? '📄' : '🔗'} {s.name.length > 20 ? s.name.slice(0, 18) + '…' : s.name}
                        </span>
                      ))}
                      {(r.sources || []).length > 3 && (
                        <span className="text-[10px] text-[#9CA3AF]">+{r.sources.length - 3} more</span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 overflow-y-auto flex flex-col min-w-0 ${!showList ? 'flex' : 'hidden md:flex'}`}>
        {content ? (
          <div className="max-w-4xl mx-auto w-full px-4 md:px-8 py-6 md:py-10">
            {/* Mobile back */}
            <button onClick={() => setShowList(true)} className="md:hidden flex items-center gap-1 text-sm text-[#6B6B6B] mb-4 -ml-1">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              All Research
            </button>

            {/* Sources bar */}
            {sources.length > 0 && !streaming && (
              <div className="mb-6 p-3 bg-[#F5F3EE] border border-[#E3E0D8] rounded-xl">
                <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">Sources</p>
                <div className="flex flex-wrap gap-2">
                  {sources.map((s, i) => (
                    <div key={i}>
                      {s.type === 'pdf' ? (
                        <button
                          onClick={() => setViewingPdf(viewingPdf?.url === s.url ? null : s)}
                          className="flex items-center gap-1.5 text-xs bg-white border border-[#E3E0D8] hover:border-[#D4622A] px-2.5 py-1.5 rounded-lg text-[#374151] hover:text-[#D4622A] transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-[#D4622A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          {s.name.length > 30 ? s.name.slice(0, 28) + '…' : s.name}
                          {viewingPdf?.url === s.url && <span className="text-[#D4622A]">▲</span>}
                        </button>
                      ) : (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs bg-white border border-[#E3E0D8] hover:border-[#6B6B6B] px-2.5 py-1.5 rounded-lg text-[#374151] hover:text-[#1A1A1A] transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          {s.name.length > 40 ? s.name.slice(0, 38) + '…' : s.name}
                          <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                      )}
                    </div>
                  ))}
                </div>

                {/* PDF inline viewer */}
                {viewingPdf && (
                  <div className="mt-3 rounded-lg overflow-hidden border border-[#E3E0D8]">
                    <iframe
                      src={viewingPdf.url}
                      title={viewingPdf.name}
                      className="w-full"
                      style={{ height: '600px' }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            {selectedId && !streaming && (
              <div className="flex items-center justify-end gap-2 mb-4">
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/share/research/${selectedId}`
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
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  {linkCopied ? 'Copied!' : 'Share'}
                </button>
                <button
                  onClick={deleteReport}
                  className="flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-red-500 bg-white hover:bg-[#F5F3EE] border border-[#E3E0D8] px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                  Delete
                </button>
              </div>
            )}

            <ReportDisplay content={content} streaming={streaming} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="text-5xl mb-4">🔬</div>
            <h2 className="text-xl font-semibold text-[#1A1A1A] mb-2">Research Intelligence</h2>
            <p className="text-[#9CA3AF] text-sm max-w-xs">
              Drop PDFs or paste URLs in the panel to generate a structured intelligence report from your own research.
            </p>
          </div>
        )}
      </div>

      {/* PDF full-screen is handled inline above */}
    </div>
  )
}
