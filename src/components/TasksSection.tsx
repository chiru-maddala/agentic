'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ContextMenuWrapper from './ContextMenuWrapper'

type Task = {
  id: string
  title: string
  description: string | null
  pillar: string
  status: 'todo' | 'in-progress' | 'done'
  source: 'manual' | 'report' | 'chat'
  document_content: string | null
  created_at: string
}

type EditState = { title: string; description: string; pillar: string }

const PILLARS = ['Learning AI', 'Enterprise AI', 'AI Infrastructure', 'General']
const STATUSES: Task['status'][] = ['todo', 'in-progress', 'done']
const STATUS_LABELS: Record<Task['status'], string> = {
  'todo': 'New',
  'in-progress': 'In Progress',
  'done': 'Done',
}
const STATUS_COLORS: Record<Task['status'], string> = {
  'todo': 'bg-[#F5F3EE] text-[#6B6B6B] border border-[#E3E0D8]',
  'in-progress': 'bg-amber-50 text-amber-700 border border-amber-200',
  'done': 'bg-green-50 text-green-700 border border-green-200',
}

function DocumentPanel({
  task,
  streaming,
  streamContent,
  onClose,
  onRerun,
}: {
  task: Task
  streaming: boolean
  streamContent: string
  onClose: () => void
  onRerun: () => void
}) {
  const [copied, setCopied] = useState(false)
  const content = streaming ? streamContent : (task.document_content ?? streamContent)

  const copyShareLink = () => {
    const url = `${window.location.origin}/share/${task.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const downloadPDF = async () => {
    const { default: html2canvas } = await import('html2canvas')
    const { default: jsPDF } = await import('jspdf')
    const el = document.getElementById('task-doc-panel-content')
    if (!el) return
    // Clone offscreen so html2canvas captures the full content, not just the visible scroll area
    const clone = el.cloneNode(true) as HTMLElement
    clone.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:760px;padding:48px;background:white;color:#111827;font-family:Georgia,serif;font-size:14px;line-height:1.8;'
    const style = document.createElement('style')
    style.textContent = '*{color:#111827!important;background:transparent!important}h1,h2,h3,h4{color:#1f2937!important;margin-top:1em}table{border-collapse:collapse;width:100%}td,th{border:1px solid #e5e7eb!important;padding:6px 10px}th{background:#f9fafb!important}'
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
      pdf.save(`${task.title.slice(0, 40)}.pdf`)
    } finally {
      document.body.removeChild(clone)
    }
  }

  return (
    <div className="flex flex-col h-full border-l border-[#E3E0D8] bg-white min-w-0">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#E3E0D8] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {streaming ? (
            <span className="w-3 h-3 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin flex-shrink-0" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4622A" strokeWidth="2" className="flex-shrink-0">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
          )}
          <span className="text-sm font-semibold text-[#1A1A1A] truncate">{task.title}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!streaming && (
            <>
              <button
                onClick={onRerun}
                className="flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-[#D4622A] bg-[#F5F3EE] hover:bg-[#FEF3EC] border border-[#E3E0D8] hover:border-[#D4622A]/30 px-2.5 py-1.5 rounded-lg transition-colors"
                title="Re-run agent"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
                </svg>
                Re-Run
              </button>
              <button
                onClick={copyShareLink}
                className={`flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg transition-colors ${
                  copied
                    ? 'text-green-700 bg-green-50 border-green-200'
                    : 'text-[#6B6B6B] hover:text-[#1A1A1A] bg-[#F5F3EE] border-[#E3E0D8]'
                }`}
                title="Copy shareable link"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                {copied ? 'Copied!' : 'Share'}
              </button>
              <button
                onClick={downloadPDF}
                className="flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-[#1A1A1A] bg-[#F5F3EE] border border-[#E3E0D8] px-2.5 py-1.5 rounded-lg transition-colors"
                title="Download PDF"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
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

      {/* Document content */}
      <div className="flex-1 overflow-y-auto p-6">
        <ContextMenuWrapper showCourse>
          <div
            id="task-doc-panel-content"
            className="prose prose-sm max-w-none
              prose-headings:text-[#1A1A1A] prose-headings:font-semibold
              prose-p:text-[#374151] prose-p:leading-relaxed
              prose-strong:text-[#1A1A1A]
              prose-li:text-[#374151]
              prose-th:text-[#1A1A1A] prose-td:text-[#374151]
              prose-table:border prose-table:border-[#E3E0D8]
              prose-th:border prose-th:border-[#E3E0D8] prose-th:bg-[#F5F3EE] prose-th:px-3 prose-th:py-2
              prose-td:border prose-td:border-[#E3E0D8] prose-td:px-3 prose-td:py-2"
            dangerouslySetInnerHTML={{ __html: content }}
          />
          {streaming && (
            <span className="inline-block w-2 h-4 bg-[#D4622A] animate-pulse ml-1 align-middle rounded-sm" />
          )}
        </ContextMenuWrapper>
      </div>
    </div>
  )
}

export default function TasksSection() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', pillar: 'General' })
  const [filterPillar, setFilterPillar] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ title: '', description: '', pillar: 'General' })

  // Panel state
  const [panelTask, setPanelTask] = useState<Task | null>(null)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [streamContent, setStreamContent] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const loadTasks = useCallback(async () => {
    const res = await fetch('/api/tasks')
    const data = await res.json()
    setTasks(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  const createTask = async () => {
    if (!form.title.trim()) return
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ title: '', description: '', pillar: 'General' })
    setShowForm(false)
    loadTasks()
  }

  const updateStatus = async (id: string, status: Task['status']) => {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    loadTasks()
  }

  const deleteTask = async (id: string) => {
    if (panelTask?.id === id) closePanel()
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    loadTasks()
  }

  const startEdit = (task: Task) => {
    setEditingId(task.id)
    setEditState({ title: task.title, description: task.description ?? '', pillar: task.pillar })
  }

  const cancelEdit = () => { setEditingId(null) }

  const saveEdit = async (id: string) => {
    if (!editState.title.trim()) return
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editState.title.trim(),
        description: editState.description.trim() || null,
        pillar: editState.pillar,
      }),
    })
    setEditingId(null)
    loadTasks()
  }

  const closePanel = () => {
    abortRef.current?.abort()
    setPanelTask(null)
    setStreamingId(null)
    setStreamContent('')
  }

  const runTask = async (task: Task, forceRerun = false) => {
    // If already has document and not forcing rerun, just show it
    if (task.document_content && !forceRerun && streamingId !== task.id) {
      setPanelTask(task)
      setStreamContent('')
      setStreamingId(null)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setPanelTask(task)
    setStreamContent('')
    setStreamingId(task.id)

    try {
      const res = await fetch(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
        signal: controller.signal,
      })
      if (!res.body) throw new Error('No stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        setStreamContent(accumulated)
      }

      // Reload tasks so the task gets document_content + done status
      await loadTasks()
      setStreamingId(null)
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        alert('Task agent failed. Please try again.')
        setStreamingId(null)
      }
    }
  }

  // Keep panelTask in sync with latest task data after reload
  useEffect(() => {
    if (panelTask && streamingId === null) {
      const updated = tasks.find((t) => t.id === panelTask.id)
      if (updated) setPanelTask(updated)
    }
  }, [tasks, panelTask, streamingId])

  const filtered = tasks.filter((t) => {
    if (filterPillar && t.pillar !== filterPillar) return false
    if (filterStatus && t.status !== filterStatus) return false
    return true
  })

  const grouped = PILLARS.reduce((acc, pillar) => {
    acc[pillar] = filtered.filter((t) => t.pillar === pillar)
    return acc
  }, {} as Record<string, Task[]>)

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: task list ── */}
      <div className={`flex flex-col overflow-y-auto bg-[#FAF9F6] transition-all duration-300 ${panelTask ? 'w-1/2' : 'w-full'}`}>
        <div className="p-6">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-semibold text-[#1A1A1A]">Tasks</h1>
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-[#D4622A] hover:bg-[#C05520] text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
              >
                + Add Task
              </button>
            </div>

            {/* Create form */}
            {showForm && (
              <div className="bg-white border border-[#E3E0D8] rounded-xl p-4 mb-6 space-y-3 shadow-sm">
                <input
                  type="text"
                  placeholder="Task title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-[#FAF9F6] border border-[#E3E0D8] text-[#1A1A1A] text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#D4622A]/30 focus:border-[#D4622A] placeholder-[#9CA3AF] transition-colors"
                />
                <textarea
                  placeholder="Description (optional)"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full bg-[#FAF9F6] border border-[#E3E0D8] text-[#1A1A1A] text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#D4622A]/30 focus:border-[#D4622A] placeholder-[#9CA3AF] transition-colors"
                />
                <div className="flex items-center gap-3">
                  <select
                    value={form.pillar}
                    onChange={(e) => setForm({ ...form, pillar: e.target.value })}
                    className="bg-[#FAF9F6] border border-[#E3E0D8] text-[#1A1A1A] text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#D4622A]/30"
                  >
                    {PILLARS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                  <button onClick={createTask} className="bg-[#D4622A] hover:bg-[#C05520] text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors">Save</button>
                  <button onClick={() => setShowForm(false)} className="text-[#9CA3AF] hover:text-[#6B6B6B] text-sm transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setFilterPillar(null)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors border ${!filterPillar ? 'bg-[#D4622A] text-white border-[#D4622A]' : 'bg-white text-[#6B6B6B] border-[#E3E0D8] hover:border-[#D4622A] hover:text-[#D4622A]'}`}
              >All Pillars</button>
              {PILLARS.map((p) => (
                <button key={p} onClick={() => setFilterPillar(filterPillar === p ? null : p)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors border ${filterPillar === p ? 'bg-[#D4622A] text-white border-[#D4622A]' : 'bg-white text-[#6B6B6B] border-[#E3E0D8] hover:border-[#D4622A] hover:text-[#D4622A]'}`}
                >{p}</button>
              ))}
              <div className="w-px bg-[#E3E0D8] mx-1" />
              {STATUSES.map((s) => (
                <button key={s} onClick={() => setFilterStatus(filterStatus === s ? null : s)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors border ${filterStatus === s ? 'bg-[#D4622A] text-white border-[#D4622A]' : 'bg-white text-[#6B6B6B] border-[#E3E0D8] hover:border-[#D4622A] hover:text-[#D4622A]'}`}
                >{STATUS_LABELS[s]}</button>
              ))}
            </div>

            {/* Task groups */}
            <div className="space-y-8">
              {PILLARS.map((pillar) => {
                const pillarTasks = grouped[pillar]
                if (filterPillar && filterPillar !== pillar) return null
                if (pillarTasks.length === 0 && filterPillar !== pillar) return null
                return (
                  <div key={pillar}>
                    <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">
                      {pillar} <span className="text-[#C4BFB5] font-normal normal-case">({pillarTasks.length})</span>
                    </h2>
                    {pillarTasks.length === 0 ? (
                      <p className="text-xs text-[#C4BFB5] px-1">No tasks.</p>
                    ) : (
                      <div className="space-y-2">
                        {pillarTasks.map((task) => {
                          const isStreaming = streamingId === task.id
                          const isActive = panelTask?.id === task.id
                          const hasDoc = !!task.document_content
                          return (
                            <div
                              key={task.id}
                              className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-colors ${isActive ? 'border-[#D4622A]/40' : 'border-[#E3E0D8]'}`}
                            >
                              {editingId === task.id ? (
                                <div className="px-4 py-3 space-y-2.5">
                                  <input
                                    autoFocus
                                    value={editState.title}
                                    onChange={(e) => setEditState({ ...editState, title: e.target.value })}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(task.id); if (e.key === 'Escape') cancelEdit() }}
                                    className="w-full text-sm text-[#1A1A1A] bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#D4622A]/30 focus:border-[#D4622A]"
                                  />
                                  <textarea
                                    value={editState.description}
                                    onChange={(e) => setEditState({ ...editState, description: e.target.value })}
                                    placeholder="Description (optional)"
                                    rows={2}
                                    className="w-full text-sm text-[#374151] bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#D4622A]/30 focus:border-[#D4622A] placeholder-[#C4BFB5]"
                                  />
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={editState.pillar}
                                      onChange={(e) => setEditState({ ...editState, pillar: e.target.value })}
                                      className="text-xs bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-2.5 py-1.5 text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#D4622A]/30"
                                    >
                                      {PILLARS.map((p) => <option key={p}>{p}</option>)}
                                    </select>
                                    <div className="flex-1" />
                                    <button onClick={() => saveEdit(task.id)} className="text-xs bg-[#D4622A] hover:bg-[#C05520] text-white px-3 py-1.5 rounded-lg transition-colors font-medium">Save</button>
                                    <button onClick={cancelEdit} className="text-xs text-[#9CA3AF] hover:text-[#6B6B6B] px-2 py-1.5 transition-colors">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="px-4 py-3 flex items-start gap-3 group">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`text-sm ${task.status === 'done' ? 'line-through text-[#9CA3AF]' : 'text-[#1A1A1A]'}`}>
                                        {task.title}
                                      </span>
                                      {(task.source === 'report' || task.source === 'chat') && (
                                        <span className="text-xs bg-[#FEF3EC] text-[#D4622A] border border-[#F5D3BC] px-2 py-0.5 rounded-full">
                                          from {task.source}
                                        </span>
                                      )}
                                    </div>
                                    {task.description && (
                                      <p className="text-xs text-[#9CA3AF] mt-1">{task.description}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <select
                                      value={task.status}
                                      onChange={(e) => updateStatus(task.id, e.target.value as Task['status'])}
                                      className={`text-xs rounded-full px-2.5 py-1 focus:outline-none cursor-pointer ${STATUS_COLORS[task.status]}`}
                                    >
                                      {STATUSES.map((s) => (
                                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                      ))}
                                    </select>

                                    {/* Run Task / View Document button */}
                                    <button
                                      onClick={() => runTask(task)}
                                      disabled={isStreaming}
                                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
                                        isActive && !isStreaming
                                          ? 'text-[#D4622A] border-[#D4622A]/40 bg-[#FEF3EC]'
                                          : 'text-[#6B6B6B] border-[#E3E0D8] hover:text-[#D4622A] hover:border-[#D4622A]/40 hover:bg-[#FEF3EC]'
                                      } ${!isStreaming && !hasDoc ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}
                                      title={hasDoc ? 'View document' : 'Run task with AI agent'}
                                    >
                                      {isStreaming ? (
                                        <>
                                          <span className="w-3 h-3 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin" />
                                          Running…
                                        </>
                                      ) : hasDoc ? (
                                        <>
                                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                          </svg>
                                          View Document
                                        </>
                                      ) : (
                                        <>
                                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/>
                                          </svg>
                                          Run Task
                                        </>
                                      )}
                                    </button>

                                    <button
                                      onClick={() => startEdit(task)}
                                      className="opacity-0 group-hover:opacity-100 text-[#9CA3AF] hover:text-[#1A1A1A] transition-all p-1 rounded"
                                      title="Edit"
                                    >
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => deleteTask(task.id)}
                                      className="opacity-0 group-hover:opacity-100 text-[#C4BFB5] hover:text-red-500 transition-all text-xs p-1 rounded"
                                      title="Delete"
                                    >✕</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {filtered.length === 0 && (
                <div className="text-center text-[#9CA3AF] text-sm py-12">No tasks yet. Click &quot;Add Task&quot; to create one.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: document panel ── */}
      {panelTask && (
        <div className="w-1/2 flex-shrink-0 h-full">
          <DocumentPanel
            task={panelTask}
            streaming={streamingId === panelTask.id}
            streamContent={streamContent}
            onClose={closePanel}
            onRerun={() => runTask(panelTask, true)}
          />
        </div>
      )}
    </div>
  )
}
