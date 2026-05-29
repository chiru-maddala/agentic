'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ReportHistory from '@/components/ReportHistory'
import ReportDisplay from '@/components/ReportDisplay'
import { createClient } from '@/lib/supabase-browser'

export default function Home() {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedCreatedAt, setSelectedCreatedAt] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [streaming, setStreaming] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  const ADMIN_EMAIL = 'chirans@gmail.com'

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const loadReport = useCallback(async (id: string, date: string, created_at?: string) => {
    setSelectedId(id)
    setSelectedDate(date)
    setSelectedCreatedAt(created_at ?? null)
    setStreaming(false)
    const res = await fetch(`/api/reports/${id}`)
    const data = await res.json()
    setContent(data.content ?? '')
  }, [])

  const generateReport = async () => {
    setGenerating(true)
    setSelectedId(null)
    setSelectedDate(null)
    setContent('')
    setStreaming(true)

    const res = await fetch('/api/generate', { method: 'POST' })
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
    setHistoryKey((k) => k + 1)

    const listRes = await fetch('/api/reports')
    const reports = await listRes.json()
    if (reports[0]) {
      setSelectedId(reports[0].id)
      setSelectedDate(reports[0].date)
      setSelectedCreatedAt(reports[0].created_at)
    }
  }

  const downloadPDF = async () => {
    if (!reportRef.current) return
    const { default: html2canvas } = await import('html2canvas')
    const { default: jsPDF } = await import('jspdf')
    const clone = reportRef.current.cloneNode(true) as HTMLElement
    clone.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:800px;padding:48px;background:white;color:#111827;font-family:Georgia,serif;font-size:14px;line-height:1.8;'
    const style = document.createElement('style')
    style.textContent = '*{color:#111827!important;background:transparent!important}h1,h2,h3,h4{color:#1f2937!important;margin-top:1em}code,pre{background:#f3f4f6!important;color:#374151!important;padding:2px 4px;border-radius:3px}a{color:#4f46e5!important}'
    clone.appendChild(style)
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
      pdf.save(`IntelliRadar-${new Date().toISOString().slice(0, 10)}.pdf`)
    } finally {
      document.body.removeChild(clone)
    }
  }

  const deleteReport = async () => {
    if (!selectedId) return
    if (!window.confirm('Are you sure you want to delete this report? This cannot be undone.')) return
    await fetch(`/api/reports/${selectedId}`, { method: 'DELETE' })
    setSelectedId(null)
    setSelectedDate(null)
    setSelectedCreatedAt(null)
    setContent('')
    setHistoryKey((k) => k + 1)
    const listRes = await fetch('/api/reports')
    const reports = await listRes.json()
    if (reports[0]) loadReport(reports[0].id, reports[0].date, reports[0].created_at)
  }

  useEffect(() => {
    fetch('/api/reports')
      .then((r) => r.json())
      .then((reports) => {
        if (reports[0]) loadReport(reports[0].id, reports[0].date, reports[0].created_at)
      })
  }, [loadReport])

  const today = new Date().toISOString().split('T')[0]
  const isToday = selectedDate === today

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold text-indigo-400">IntelliRadar</span>
          </div>
          <p className="text-xs text-gray-500">Intellina AI Daily Intelligence</p>
        </div>

        <div className="p-3">
          <button
            onClick={generateReport}
            disabled={generating}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>&#9889; Generate Report</>
)}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 px-1">History</p>
          <ReportHistory
            key={historyKey}
            selectedId={selectedId}
            onSelect={loadReport}
          />
        </div>

        <div className="border-t border-gray-800 p-3 space-y-1">
          {userEmail === ADMIN_EMAIL && (
            <button
              onClick={() => router.push('/admin')}
              className="w-full text-left text-xs text-gray-400 hover:text-white px-2 py-1.5 rounded transition-colors"
            >
              User Management
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-gray-500 hover:text-gray-300 px-2 py-1.5 rounded transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {content ? (
          <div className="max-w-4xl mx-auto px-8 py-10">
            {selectedDate && !streaming && (
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs text-gray-500">
                  {selectedCreatedAt
                    ? new Date(selectedCreatedAt).toLocaleString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })
                    : new Date(selectedDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        timeZone: 'UTC',
                      })}
                </span>
                <div className="flex items-center gap-2">
                  {isToday && (
                    <span className="text-xs bg-indigo-900 text-indigo-300 px-2 py-1 rounded-full">
                      Today
                    </span>
                  )}
                  <button
                    onClick={downloadPDF}
                    title="Download as PDF"
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    PDF
                  </button>
                  <button
                    onClick={deleteReport}
                    title="Delete report"
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-400 bg-gray-800 hover:bg-gray-700 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            )}
            <div ref={reportRef}>
              <ReportDisplay content={content} streaming={streaming} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-5xl mb-4">&#128225;</div>
            <h2 className="text-xl font-semibold text-gray-300 mb-2">No report yet</h2>
            <p className="text-gray-500 text-sm max-w-xs">
              Click &quot;Generate Report&quot; to fetch the latest AI intelligence for Intellina.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
