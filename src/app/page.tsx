'use client'

import { useCallback, useEffect, useState } from 'react'
import ReportHistory from '@/components/ReportHistory'
import ReportDisplay from '@/components/ReportDisplay'

export default function Home() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [streaming, setStreaming] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)

  const loadReport = useCallback(async (id: string, date: string) => {
    setSelectedId(id)
    setSelectedDate(date)
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
    }
  }

  useEffect(() => {
    fetch('/api/reports')
      .then((r) => r.json())
      .then((reports) => {
        if (reports[0]) loadReport(reports[0].id, reports[0].date)
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
              <>&#9889; Generate Today&apos;s Report</>
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
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {content ? (
          <div className="max-w-4xl mx-auto px-8 py-10">
            {selectedDate && !streaming && (
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs text-gray-500">
                  {new Date(selectedDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })}
                </span>
                {isToday && (
                  <span className="text-xs bg-indigo-900 text-indigo-300 px-2 py-1 rounded-full">
                    Today
                  </span>
                )}
              </div>
            )}
            <ReportDisplay content={content} streaming={streaming} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-5xl mb-4">&#128225;</div>
            <h2 className="text-xl font-semibold text-gray-300 mb-2">No report yet</h2>
            <p className="text-gray-500 text-sm max-w-xs">
              Click &quot;Generate Today&apos;s Report&quot; to fetch the latest AI intelligence for Intellina.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
