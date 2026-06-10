'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReportDisplay from './ReportDisplay'

type Message = { id: string; role: 'user' | 'assistant'; content: string }

type Props = {
  pageContext: string
  onOpenFull: () => void
}

const SUGGESTIONS: Record<string, string[]> = {
  dashboard:  ['What should I focus on today?', 'Summarise my in-progress tasks', 'What momentum do I have this week?'],
  reports:    ['What are the key takeaways from this report?', 'Which pillar had the most activity today?', 'What actions should I take from this?'],
  tasks:      ['What tasks are most overdue?', 'Help me prioritise my to-do list', 'Which pillar has the most open work?'],
  notes:      ['Help me expand this note', 'Summarise what I have saved', 'Find connections between my notes'],
  mirror:     ['How is my progress against my goals?', 'Where am I drifting from my intent?', 'What should I focus on this week?'],
  research:   ['Summarise what I just researched', 'How does this relate to Intellina?', 'What are the key signals here?'],
  chat:       [],
  default:    ['What are the latest AI trends?', 'Help me think through a strategy', 'What should I work on next?'],
}

export default function FloatingChat({ pageContext, onOpenFull }: Props) {
  const [open, setOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const getOrCreateSession = useCallback(async () => {
    setLoading(true)
    try {
      const saved = localStorage.getItem('floating_chat_session_id')
      if (saved) {
        const res = await fetch(`/api/chat/${saved}`)
        if (res.ok) {
          const data = await res.json()
          setSessionId(saved)
          setMessages(Array.isArray(data) ? data : [])
          return
        }
        // Session no longer exists — create a fresh one
        localStorage.removeItem('floating_chat_session_id')
      }
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const session = await res.json()
      localStorage.setItem('floating_chat_session_id', session.id)
      setSessionId(session.id)
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && !sessionId) getOrCreateSession()
    if (open) setTimeout(() => inputRef.current?.focus(), 300)
  }, [open, sessionId, getOrCreateSession])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || !sessionId || streaming) return
    const userId = crypto.randomUUID()
    const assistantId = crypto.randomUUID()
    setInput('')
    setMessages((prev) => [...prev, { id: userId, role: 'user', content: msg }])
    setStreaming(true)
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    const res = await fetch(`/api/chat/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, pageContext }),
    })

    if (!res.body) { setStreaming(false); return }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content: m.content + chunk } : m)
      )
    }
    setStreaming(false)
  }

  // Derive the tab key for suggestions from the pageContext string
  const tabKey = pageContext.toLowerCase().includes('report') ? 'reports'
    : pageContext.toLowerCase().includes('task') ? 'tasks'
    : pageContext.toLowerCase().includes('note') ? 'notes'
    : pageContext.toLowerCase().includes('mirror') ? 'mirror'
    : pageContext.toLowerCase().includes('research') ? 'research'
    : pageContext.toLowerCase().includes('dashboard') ? 'dashboard'
    : 'default'

  const suggestions = SUGGESTIONS[tabKey] ?? SUGGESTIONS.default

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`
          fixed top-0 right-0 h-full z-50 flex flex-col
          w-full sm:w-[420px]
          bg-[#FAF9F6] border-l border-[#E3E0D8] shadow-2xl
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E3E0D8] bg-white flex-shrink-0">
          <span className="text-sm font-semibold text-[#1A1A1A] flex-1">Ask IntelliRadar</span>
          {pageContext && (
            <span className="text-xs text-[#9CA3AF] bg-[#F5F3EE] px-2 py-0.5 rounded-full truncate max-w-[140px]">
              {pageContext.split('.')[0]}
            </span>
          )}
          <button
            onClick={() => { setOpen(false); onOpenFull() }}
            title="Open full Chat"
            className="p-1.5 text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#F5F3EE] rounded-lg transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            </svg>
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#F5F3EE] rounded-lg transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <span className="w-4 h-4 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div className="py-6">
              <p className="text-xs text-[#9CA3AF] text-center mb-4">
                Ask anything — I have context on what you're currently viewing.
              </p>
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left text-xs text-[#6B6B6B] bg-white border border-[#E3E0D8] rounded-lg px-3 py-2.5 hover:bg-[#F5F3EE] hover:text-[#1A1A1A] hover:border-[#C4BFB5] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'user' ? (
                <div className="max-w-[82%] bg-[#1A1A1A] text-white rounded-2xl rounded-tr-sm px-3 py-2 text-sm leading-relaxed">
                  {m.content}
                </div>
              ) : (
                <div className="max-w-[95%] w-full">
                  <ReportDisplay
                    content={m.content}
                    streaming={streaming && m === messages[messages.length - 1]}
                  />
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-[#E3E0D8] bg-white flex-shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Ask anything… (Enter to send)"
              rows={2}
              disabled={streaming || loading}
              className="flex-1 bg-[#FAF9F6] border border-[#E3E0D8] text-[#1A1A1A] text-sm rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#D4622A]/30 focus:border-[#D4622A] placeholder-[#9CA3AF] disabled:opacity-50 transition-colors"
            />
            <button
              onClick={() => sendMessage()}
              disabled={streaming || !input.trim() || loading}
              className="bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-40 disabled:cursor-not-allowed text-white w-9 h-9 rounded-xl text-sm font-bold flex items-center justify-center transition-colors flex-shrink-0"
            >
              {streaming ? (
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
              )}
            </button>
          </div>
          <p className="text-xs text-[#C4BFB5] mt-1.5 ml-1">Shift+Enter for new line</p>
        </div>
      </div>

      {/* Floating button — hidden on the Chat tab */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`
          fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl
          flex items-center justify-center transition-all duration-200
          hover:scale-105 active:scale-95
          ${open
            ? 'bg-[#1A1A1A] hover:bg-[#2A2A2A]'
            : 'bg-[#D4622A] hover:bg-[#C05520]'
          }
        `}
        title={open ? 'Close chat' : 'Ask IntelliRadar'}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
      </button>
    </>
  )
}
