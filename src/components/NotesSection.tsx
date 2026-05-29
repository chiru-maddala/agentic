'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type NoteMeta = { id: string; title: string; updated_at: string }
type Note = NoteMeta & { content: string; created_at: string }

export default function NotesSection() {
  const [notes, setNotes] = useState<NoteMeta[]>([])
  const [active, setActive] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [dirty, setDirty] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  const loadNotes = useCallback(async () => {
    const res = await fetch('/api/notes')
    const data = await res.json()
    setNotes(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => { loadNotes() }, [loadNotes])

  const openNote = useCallback(async (id: string) => {
    const res = await fetch(`/api/notes/${id}`)
    const data: Note = await res.json()
    setActive(data)
    setTitle(data.title)
    setDirty(false)
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = data.content
    }, 0)
  }, [])

  const newNote = async () => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled Note', content: '' }),
    })
    const note: Note = await res.json()
    await loadNotes()
    await openNote(note.id)
  }

  const saveNote = useCallback(async (noteId: string, noteTitle: string, content: string) => {
    await fetch(`/api/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: noteTitle, content }),
    })
    setDirty(false)
    loadNotes()
  }, [loadNotes])

  const scheduleAutosave = useCallback((noteId: string, noteTitle: string, content: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveNote(noteId, noteTitle, content), 1500)
  }, [saveNote])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
    setDirty(true)
    if (active) scheduleAutosave(active.id, e.target.value, editorRef.current?.innerHTML ?? '')
  }

  const handleEditorInput = () => {
    setDirty(true)
    if (active) scheduleAutosave(active.id, title, editorRef.current?.innerHTML ?? '')
  }

  const deleteNote = async () => {
    if (!active) return
    if (!window.confirm('Delete this note?')) return
    await fetch(`/api/notes/${active.id}`, { method: 'DELETE' })
    setActive(null)
    setTitle('')
    if (editorRef.current) editorRef.current.innerHTML = ''
    loadNotes()
  }

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value)
    editorRef.current?.focus()
    handleEditorInput()
  }

  return (
    <div className="flex h-full">
      {/* Notes sidebar */}
      <aside className="w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-3 border-b border-gray-800">
          <button
            onClick={newNote}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors"
          >
            + New Note
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {notes.length === 0 && (
            <p className="text-xs text-gray-500 px-2 py-4">No notes yet.</p>
          )}
          {notes.map((n) => (
            <button
              key={n.id}
              onClick={() => openNote(n.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                active?.id === n.id ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="truncate font-medium">{n.title}</div>
              <div className={`text-xs mt-0.5 ${active?.id === n.id ? 'text-indigo-200' : 'text-gray-500'}`}>
                {new Date(n.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {!active ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-5xl mb-4">📝</div>
            <h2 className="text-xl font-semibold text-gray-300 mb-2">Notes</h2>
            <p className="text-gray-500 text-sm max-w-xs">Capture ideas, strategies, and observations.</p>
            <button
              onClick={newNote}
              className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Create your first note
            </button>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800 bg-gray-900">
              <button onClick={() => execCmd('bold')} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-sm font-bold w-7 h-7 flex items-center justify-center" title="Bold">B</button>
              <button onClick={() => execCmd('italic')} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-sm italic w-7 h-7 flex items-center justify-center" title="Italic">I</button>
              <button onClick={() => execCmd('underline')} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-sm underline w-7 h-7 flex items-center justify-center" title="Underline">U</button>
              <div className="w-px h-5 bg-gray-700 mx-1" />
              <button onClick={() => execCmd('formatBlock', 'H1')} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-xs w-7 h-7 flex items-center justify-center" title="Heading 1">H1</button>
              <button onClick={() => execCmd('formatBlock', 'H2')} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-xs w-7 h-7 flex items-center justify-center" title="Heading 2">H2</button>
              <button onClick={() => execCmd('formatBlock', 'H3')} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-xs w-7 h-7 flex items-center justify-center" title="Heading 3">H3</button>
              <div className="w-px h-5 bg-gray-700 mx-1" />
              <button onClick={() => execCmd('insertUnorderedList')} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-sm w-7 h-7 flex items-center justify-center" title="Bullet list">•</button>
              <button onClick={() => execCmd('insertOrderedList')} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-sm w-7 h-7 flex items-center justify-center" title="Numbered list">1.</button>
              <div className="flex-1" />
              {dirty && <span className="text-xs text-gray-500">Saving…</span>}
              <button
                onClick={deleteNote}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1"
              >
                Delete
              </button>
            </div>

            {/* Title */}
            <div className="px-8 pt-8 pb-2">
              <input
                type="text"
                value={title}
                onChange={handleTitleChange}
                placeholder="Note title"
                className="w-full bg-transparent text-2xl font-bold text-white placeholder-gray-600 focus:outline-none"
              />
            </div>

            {/* Body */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleEditorInput}
              className="flex-1 px-8 py-4 text-gray-200 text-sm leading-relaxed focus:outline-none overflow-y-auto notes-editor"
              data-placeholder="Start writing…"
            />
          </>
        )}
      </div>

      <style jsx>{`
        .notes-editor:empty:before {
          content: attr(data-placeholder);
          color: #4b5563;
          pointer-events: none;
        }
        .notes-editor h1 { font-size: 1.5rem; font-weight: 700; margin: 1em 0 0.5em; color: white; }
        .notes-editor h2 { font-size: 1.25rem; font-weight: 600; margin: 1em 0 0.5em; color: white; }
        .notes-editor h3 { font-size: 1.1rem; font-weight: 600; margin: 0.8em 0 0.4em; color: #e5e7eb; }
        .notes-editor ul { list-style: disc; padding-left: 1.5em; margin: 0.5em 0; }
        .notes-editor ol { list-style: decimal; padding-left: 1.5em; margin: 0.5em 0; }
        .notes-editor li { margin: 0.25em 0; }
        .notes-editor b, .notes-editor strong { font-weight: 700; color: white; }
        .notes-editor i, .notes-editor em { font-style: italic; }
      `}</style>
    </div>
  )
}
