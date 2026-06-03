'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useEffect, useRef, useState } from 'react'

type Props = {
  content: string
  streaming?: boolean
}

type MenuState = {
  x: number
  y: number
  text: string
} | null

type Toast = { message: string; ok: boolean } | null

export default function ReportDisplay({ content, streaming }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<MenuState>(null)
  const [toast, setToast] = useState<Toast>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menu && !(e.target as Element).closest('[data-context-menu]')) {
        setMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menu])

  const handleContextMenu = (e: React.MouseEvent) => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()
    if (!text) return
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, text })
  }

  const showToast = (message: string, ok: boolean) => {
    setToast({ message, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const addToTask = async () => {
    if (!menu || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: menu.text.slice(0, 120),
          description: menu.text.length > 120 ? menu.text : undefined,
          source: 'report',
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      showToast('Added to Tasks ✓', true)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', false)
    } finally {
      setBusy(false)
      setMenu(null)
    }
  }

  const addToNote = async () => {
    if (!menu || busy) return
    setBusy(true)
    try {
      const title = menu.text.split('\n')[0].slice(0, 80) || 'Note from report'
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: menu.text }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      showToast('Added to Notes ✓', true)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', false)
    } finally {
      setBusy(false)
      setMenu(null)
    }
  }

  return (
    <div ref={containerRef} onContextMenu={handleContextMenu} className="relative">
      <div className="prose prose-sm max-w-none
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

      {menu && (
        <div
          data-context-menu
          style={{ position: 'fixed', top: menu.y, left: menu.x, zIndex: 9999 }}
          className="bg-white border border-[#E3E0D8] rounded-xl shadow-lg py-1 min-w-[160px] text-sm"
        >
          <button
            onClick={addToTask}
            disabled={busy}
            className="w-full text-left px-4 py-2 text-[#374151] hover:bg-[#F5F3EE] disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            <span>✅</span> Add to Tasks
          </button>
          <button
            onClick={addToNote}
            disabled={busy}
            className="w-full text-left px-4 py-2 text-[#374151] hover:bg-[#F5F3EE] disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            <span>📝</span> Add to Notes
          </button>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg border ${
            toast.ok
              ? 'bg-white text-green-700 border-green-200'
              : 'bg-white text-red-600 border-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
