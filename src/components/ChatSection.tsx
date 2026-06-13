'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReportDisplay from './ReportDisplay'

type Session = { id: string; title: string; created_at: string }
type Message = { id: string; role: 'user' | 'assistant'; content: string }
type Attachment = { name: string; mediaType: string; data: string }

const ACCEPTED_TYPES = 'application/pdf,image/png,image/jpeg,image/gif,image/webp'
const MAX_FILE_MB = 10

async function fileToAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // strip "data:<mediaType>;base64," prefix
      const base64 = dataUrl.split(',')[1]
      resolve({ name: file.name, mediaType: file.type, data: base64 })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function AttachmentChip({ name, onRemove }: { name: string; onRemove: () => void }) {
  const isPdf = name.toLowerCase().endsWith('.pdf')
  return (
    <span className="inline-flex items-center gap-1.5 bg-[#E8E4DC] text-[#1A1A1A] text-xs rounded-lg px-2.5 py-1.5 font-medium">
      <span>{isPdf ? '📄' : '🖼️'}</span>
      <span className="max-w-[120px] truncate">{name}</span>
      <button
        onClick={onRemove}
        className="text-[#6B6B6B] hover:text-red-500 transition-colors ml-0.5"
        aria-label={`Remove ${name}`}
      >✕</button>
    </span>
  )
}

export default function ChatSection() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [showList, setShowList] = useState(true)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [attachError, setAttachError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    setAttachError('')
    const toAdd: Attachment[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setAttachError(`"${file.name}" exceeds ${MAX_FILE_MB} MB limit.`)
        continue
      }
      try {
        toAdd.push(await fileToAttachment(file))
      } catch {
        setAttachError(`Failed to read "${file.name}".`)
      }
    }
    setAttachments((prev) => [...prev, ...toAdd])
  }

  const loadSessions = useCallback(async () => {
    const res = await fetch('/api/chat')
    const data = await res.json()
    setSessions(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  const openSession = useCallback(async (session: Session) => {
    setActiveSession(session)
    const res = await fetch(`/api/chat/${session.id}`)
    const data = await res.json()
    setMessages(Array.isArray(data) ? data : [])
    setShowList(false)
  }, [])

  const newChat = async () => {
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const session = await res.json()
    await loadSessions()
    setActiveSession(session)
    setMessages([])
    setShowList(false)
  }

  const deleteSession = async (id: string) => {
    await fetch(`/api/chat/${id}`, { method: 'DELETE' })
    if (activeSession?.id === id) {
      setActiveSession(null)
      setMessages([])
    }
    await loadSessions()
  }

  const sendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || !activeSession || streaming) return
    const text = input.trim()
    const currentAttachments = [...attachments]
    const userId = crypto.randomUUID()
    const assistantId = crypto.randomUUID()
    setInput('')
    setAttachments([])
    setAttachError('')

    // Show attached file names in the user bubble
    const attachNote = currentAttachments.length > 0
      ? `\n📎 ${currentAttachments.map((a) => a.name).join(', ')}`
      : ''
    setMessages((prev) => [...prev, { id: userId, role: 'user', content: text + attachNote }])
    setStreaming(true)
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    const res = await fetch(`/api/chat/${activeSession.id}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, attachments: currentAttachments }),
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
    await loadSessions()
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex h-full">
      {/* Chat sidebar */}
      <aside className={`${showList ? 'flex' : 'hidden'} md:flex w-full md:w-64 flex-shrink-0 bg-[#F5F3EE] border-r border-[#E3E0D8] flex-col`}>
        <div className="p-3 border-b border-[#E3E0D8]">
          <button
            onClick={newChat}
            className="w-full bg-[#D4622A] hover:bg-[#C05520] text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors"
          >
            + New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 && (
            <p className="text-xs text-[#9CA3AF] px-2 py-4">No chats yet.</p>
          )}
          {sessions.map((s) => (
            <div key={s.id} className="group relative">
              <button
                onClick={() => openSession(s)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors pr-8 ${
                  activeSession?.id === s.id
                    ? 'bg-[#E8E4DC] text-[#1A1A1A] font-medium'
                    : 'text-[#6B6B6B] hover:bg-[#ECEAE3] hover:text-[#1A1A1A]'
                }`}
              >
                <div className="truncate font-medium">{s.title}</div>
                <div className={`text-xs mt-0.5 ${activeSession?.id === s.id ? 'text-[#6B6B6B]' : 'text-[#9CA3AF]'}`}>
                  {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </button>
              <button
                onClick={() => deleteSession(s.id)}
                className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-[#9CA3AF] hover:text-red-500 transition-opacity text-xs p-1"
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Chat main */}
      <div className={`${!showList ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0 bg-[#FAF9F6]`}>
        {!activeSession ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-5xl mb-4">💬</div>
            <h2 className="text-xl font-semibold text-[#1A1A1A] mb-2">Intellina AI Assistant</h2>
            <p className="text-[#9CA3AF] text-sm max-w-xs">
              Ask questions about AI trends, get strategic advice, or analyze report insights.
            </p>
            <button
              onClick={newChat}
              className="mt-4 bg-[#D4622A] hover:bg-[#C05520] text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Start a new chat
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-4 pt-3 pb-1 md:hidden border-b border-[#E3E0D8]">
              <button
                onClick={() => setShowList(true)}
                className="text-[#6B6B6B] hover:text-[#1A1A1A] p-1 -ml-1 flex-shrink-0"
                aria-label="Back to chats list"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="text-sm font-medium text-[#1A1A1A] truncate">{activeSession.title}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.length === 0 && (
                <div className="text-center text-[#9CA3AF] text-sm mt-8">
                  Send a message to start the conversation.
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'user' ? (
                    <div className="max-w-lg bg-[#1A1A1A] text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
                      {m.content}
                    </div>
                  ) : (
                    <div className="max-w-3xl w-full">
                      <ReportDisplay content={m.content} streaming={streaming && m === messages[messages.length - 1]} />
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="p-4 border-t border-[#E3E0D8] bg-[#FAF9F6]">
              {/* Attachment chips */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {attachments.map((a, i) => (
                    <AttachmentChip
                      key={i}
                      name={a.name}
                      onRemove={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                    />
                  ))}
                </div>
              )}
              {attachError && (
                <p className="text-xs text-red-500 mb-1.5">{attachError}</p>
              )}

              <div className="flex gap-2 items-end">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                {/* Paperclip button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={streaming}
                  title="Attach PDF or image"
                  className="flex-shrink-0 text-[#9CA3AF] hover:text-[#D4622A] disabled:opacity-40 transition-colors p-2 rounded-lg hover:bg-[#F0EDE6]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                </button>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleFiles(e.dataTransfer.files)
                  }}
                  placeholder="Ask anything about AI, Intellina strategy, or your reports…"
                  rows={2}
                  disabled={streaming}
                  className="flex-1 bg-white border border-[#E3E0D8] text-[#1A1A1A] text-sm rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#D4622A]/30 focus:border-[#D4622A] placeholder-[#9CA3AF] disabled:opacity-50 transition-colors"
                />
                <button
                  onClick={sendMessage}
                  disabled={streaming || (!input.trim() && attachments.length === 0)}
                  className="bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors self-end"
                >
                  {streaming ? '…' : 'Send'}
                </button>
              </div>
              <p className="text-xs text-[#9CA3AF] mt-1.5 ml-1">
                Press Enter to send · Shift+Enter for newline · Attach PDFs or images
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
