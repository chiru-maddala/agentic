'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import Placeholder from '@tiptap/extension-placeholder'

type NoteMeta = { id: string; title: string; updated_at: string }
type Note = NoteMeta & { content: string; created_at: string }

function NoteEditor({ note, onSave }: { note: Note; onSave: (content: string) => void }) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    content: note.content || '',
    onUpdate: ({ editor }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        onSave(editor.getHTML())
      }, 1500)
    },
  })

  // When note changes, update editor content
  useEffect(() => {
    if (editor && note.content !== editor.getHTML()) {
      editor.commands.setContent(note.content || '')
    }
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id])

  const insertImage = () => {
    const url = window.prompt('Image URL (or paste a data URL):')
    if (url && editor) editor.chain().focus().setImage({ src: url }).run()
  }

  const insertTable = () => {
    if (editor) editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  if (!editor) return null

  const btn = (onClick: () => void, title: string, children: React.ReactNode, active?: boolean) => (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded text-sm w-7 h-7 flex items-center justify-center transition-colors ${
        active
          ? 'bg-[#D4622A] text-white'
          : 'text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#F5F3EE]'
      }`}
    >
      {children}
    </button>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-4 py-2 border-b border-[#E3E0D8] bg-white">
        {btn(() => editor.chain().focus().toggleBold().run(), 'Bold', <b>B</b>, editor.isActive('bold'))}
        {btn(() => editor.chain().focus().toggleItalic().run(), 'Italic', <i>I</i>, editor.isActive('italic'))}
        {btn(() => editor.chain().focus().toggleStrike().run(), 'Strikethrough', <s>S</s>, editor.isActive('strike'))}
        <div className="w-px h-5 bg-[#E3E0D8] mx-1" />
        {btn(() => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'H1', <span className="text-xs">H1</span>, editor.isActive('heading', { level: 1 }))}
        {btn(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'H2', <span className="text-xs">H2</span>, editor.isActive('heading', { level: 2 }))}
        {btn(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'H3', <span className="text-xs">H3</span>, editor.isActive('heading', { level: 3 }))}
        <div className="w-px h-5 bg-[#E3E0D8] mx-1" />
        {btn(() => editor.chain().focus().toggleBulletList().run(), 'Bullet list', '•', editor.isActive('bulletList'))}
        {btn(() => editor.chain().focus().toggleOrderedList().run(), 'Numbered list', '1.', editor.isActive('orderedList'))}
        {btn(() => editor.chain().focus().toggleBlockquote().run(), 'Blockquote', '"', editor.isActive('blockquote'))}
        {btn(() => editor.chain().focus().toggleCodeBlock().run(), 'Code block', <span className="font-mono text-xs">{`<>`}</span>, editor.isActive('codeBlock'))}
        <div className="w-px h-5 bg-[#E3E0D8] mx-1" />
        {btn(insertTable, 'Insert table', (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
          </svg>
        ))}
        {editor.isActive('table') && (
          <>
            {btn(() => editor.chain().focus().addColumnAfter().run(), 'Add column', (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1"/><line x1="14" y1="12" x2="21" y2="12"/><line x1="17.5" y1="8.5" x2="17.5" y2="15.5"/></svg>
            ))}
            {btn(() => editor.chain().focus().addRowAfter().run(), 'Add row', (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="7" rx="1"/><line x1="12" y1="14" x2="12" y2="21"/><line x1="8.5" y1="17.5" x2="15.5" y2="17.5"/></svg>
            ))}
            {btn(() => editor.chain().focus().deleteColumn().run(), 'Delete column', (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1"/><line x1="14" y1="10" x2="21" y2="17"/><line x1="21" y1="10" x2="14" y2="17"/></svg>
            ))}
            {btn(() => editor.chain().focus().deleteRow().run(), 'Delete row', (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="7" rx="1"/><line x1="10" y1="14" x2="17" y2="21"/><line x1="17" y1="14" x2="10" y2="21"/></svg>
            ))}
            {btn(() => editor.chain().focus().deleteTable().run(), 'Delete table', (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
            ))}
          </>
        )}
        {btn(insertImage, 'Insert image', (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
        ))}
      </div>

      <EditorContent
        editor={editor}
        className="flex-1 overflow-y-auto px-8 py-4 notes-tiptap"
      />
    </div>
  )
}

export default function NotesSection() {
  const [notes, setNotes] = useState<NoteMeta[]>([])
  const [active, setActive] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const titleRef = useRef('')
  titleRef.current = title
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeRef = useRef<Note | null>(null)
  activeRef.current = active

  const loadNotes = useCallback(async () => {
    const res = await fetch('/api/notes')
    const data = await res.json()
    setNotes(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => { loadNotes() }, [loadNotes])

  const saveContent = useCallback(async (noteId: string, noteTitle: string, content: string) => {
    await fetch(`/api/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: noteTitle, content }),
    })
    loadNotes()
  }, [loadNotes])

  const openNote = useCallback(async (id: string) => {
    const res = await fetch(`/api/notes/${id}`)
    const data: Note = await res.json()
    setActive(data)
    setTitle(data.title)
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

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
    if (titleTimer.current) clearTimeout(titleTimer.current)
    const cur = activeRef.current
    if (cur) {
      titleTimer.current = setTimeout(() => {
        fetch(`/api/notes/${cur.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: e.target.value, content: undefined }),
        }).then(() => loadNotes())
      }, 1000)
    }
  }

  const copyLink = () => {
    if (!active) return
    navigator.clipboard.writeText(`${window.location.origin}/share/note/${active.id}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const deleteNote = async () => {
    if (!active) return
    if (!window.confirm('Delete this note?')) return
    await fetch(`/api/notes/${active.id}`, { method: 'DELETE' })
    setActive(null)
    setTitle('')
    loadNotes()
  }

  return (
    <div className="flex h-full">
      {/* Notes sidebar */}
      <aside className="w-64 flex-shrink-0 bg-[#F5F3EE] border-r border-[#E3E0D8] flex flex-col">
        <div className="p-3 border-b border-[#E3E0D8]">
          <button
            onClick={newNote}
            className="w-full bg-[#D4622A] hover:bg-[#C05520] text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors"
          >
            + New Note
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {notes.length === 0 && (
            <p className="text-xs text-[#9CA3AF] px-2 py-4">No notes yet.</p>
          )}
          {notes.map((n) => (
            <button
              key={n.id}
              onClick={() => openNote(n.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                active?.id === n.id
                  ? 'bg-[#E8E4DC] text-[#1A1A1A] font-medium'
                  : 'text-[#6B6B6B] hover:bg-[#ECEAE3] hover:text-[#1A1A1A]'
              }`}
            >
              <div className="truncate font-medium">{n.title}</div>
              <div className={`text-xs mt-0.5 ${active?.id === n.id ? 'text-[#6B6B6B]' : 'text-[#9CA3AF]'}`}>
                {new Date(n.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#FAF9F6]">
        {!active ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-5xl mb-4">📝</div>
            <h2 className="text-xl font-semibold text-[#1A1A1A] mb-2">Notes</h2>
            <p className="text-[#9CA3AF] text-sm max-w-xs">Capture ideas, strategies, and observations.</p>
            <button
              onClick={newNote}
              className="mt-4 bg-[#D4622A] hover:bg-[#C05520] text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Create your first note
            </button>
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div className="flex items-center gap-3 px-8 pt-6 pb-2">
              <input
                type="text"
                value={title}
                onChange={handleTitleChange}
                placeholder="Note title"
                className="flex-1 bg-transparent text-2xl font-bold text-[#1A1A1A] placeholder-[#C4BFB5] focus:outline-none"
              />
              <button
                onClick={copyLink}
                className={`text-xs px-2 py-1 rounded border transition-colors flex-shrink-0 ${
                  linkCopied
                    ? 'text-green-700 bg-green-50 border-green-200'
                    : 'text-[#6B6B6B] bg-[#F5F3EE] border-[#E3E0D8] hover:text-[#1A1A1A]'
                }`}
              >
                {linkCopied ? 'Copied!' : 'Share'}
              </button>
              <button
                onClick={deleteNote}
                className="text-xs text-[#9CA3AF] hover:text-red-500 transition-colors px-2 py-1 flex-shrink-0"
              >
                Delete
              </button>
            </div>
            <NoteEditor
              key={active.id}
              note={active}
              onSave={(content) => saveContent(active.id, titleRef.current, content)}
            />
          </>
        )}
      </div>

      <style jsx global>{`
        .notes-tiptap .ProseMirror {
          min-height: 300px;
          color: #374151;
          font-size: 0.875rem;
          line-height: 1.75;
          outline: none;
        }
        .notes-tiptap .ProseMirror p.is-editor-empty:first-child::before {
          color: #C4BFB5;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .notes-tiptap .ProseMirror h1 { font-size: 1.5rem; font-weight: 700; margin: 1em 0 0.5em; color: #1A1A1A; }
        .notes-tiptap .ProseMirror h2 { font-size: 1.25rem; font-weight: 600; margin: 1em 0 0.5em; color: #1A1A1A; }
        .notes-tiptap .ProseMirror h3 { font-size: 1.1rem; font-weight: 600; margin: 0.8em 0 0.4em; color: #374151; }
        .notes-tiptap .ProseMirror ul { list-style: disc; padding-left: 1.5em; margin: 0.5em 0; }
        .notes-tiptap .ProseMirror ol { list-style: decimal; padding-left: 1.5em; margin: 0.5em 0; }
        .notes-tiptap .ProseMirror li { margin: 0.25em 0; }
        .notes-tiptap .ProseMirror strong { font-weight: 700; color: #1A1A1A; }
        .notes-tiptap .ProseMirror em { font-style: italic; }
        .notes-tiptap .ProseMirror s { text-decoration: line-through; }
        .notes-tiptap .ProseMirror blockquote { border-left: 3px solid #D4622A; padding-left: 1em; color: #6B6B6B; margin: 0.5em 0; }
        .notes-tiptap .ProseMirror code { background: #FEF3EC; color: #D4622A; padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.85em; }
        .notes-tiptap .ProseMirror pre { background: #F5F3EE; border: 1px solid #E3E0D8; border-radius: 6px; padding: 1em; margin: 0.5em 0; }
        .notes-tiptap .ProseMirror pre code { background: none; color: #374151; padding: 0; }
        .notes-tiptap .ProseMirror img { max-width: 100%; border-radius: 6px; margin: 0.5em 0; }
        .notes-tiptap .ProseMirror table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        .notes-tiptap .ProseMirror table td, .notes-tiptap .ProseMirror table th {
          border: 1px solid #E3E0D8; padding: 0.5em 0.75em; text-align: left; min-width: 80px;
        }
        .notes-tiptap .ProseMirror table th { background: #F5F3EE; font-weight: 600; color: #1A1A1A; }
        .notes-tiptap .ProseMirror table .selectedCell { background: #FEF3EC; }
        .notes-tiptap .ProseMirror .tableWrapper { overflow-x: auto; }
      `}</style>
    </div>
  )
}
