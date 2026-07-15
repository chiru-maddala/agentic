'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type PersonType = 'internal' | 'external'

type Person = {
  id: string
  name: string
  type: PersonType
  role: string | null
  company: string | null
  email: string | null
  primary_pillar: string | null
  notes: string | null
  status_note: string | null
  status_updated_at: string | null
  created_at: string
}

type FormState = {
  name: string
  type: PersonType
  role: string
  company: string
  primary_pillar: string
  notes: string
}

const PILLARS = ['Learning AI', 'Enterprise AI', 'AI Infrastructure']

const PILLAR_STYLES: Record<string, string> = {
  'Learning AI': 'bg-[#EEF6FF] text-[#2563EB] border-[#CFE2FF]',
  'Enterprise AI': 'bg-[#FEF3EC] text-[#D4622A] border-[#F5D3BC]',
  'AI Infrastructure': 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]',
}

const emptyForm: FormState = { name: '', type: 'internal', role: '', company: '', primary_pillar: '', notes: '' }

function PersonRow({
  person,
  onDelete,
  onEdit,
  onStatusChange,
}: {
  person: Person
  onDelete: (id: string) => void
  onEdit: (id: string, form: FormState) => Promise<void>
  onStatusChange: (id: string, statusNote: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FormState>({
    name: person.name,
    type: person.type,
    role: person.role ?? '',
    company: person.company ?? '',
    primary_pillar: person.primary_pillar ?? '',
    notes: person.notes ?? '',
  })
  const [statusDraft, setStatusDraft] = useState(person.status_note ?? '')
  const [statusSaving, setStatusSaving] = useState(false)
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleStatusChange = (value: string) => {
    setStatusDraft(value)
    if (statusTimer.current) clearTimeout(statusTimer.current)
    setStatusSaving(true)
    statusTimer.current = setTimeout(() => {
      onStatusChange(person.id, value)
      setStatusSaving(false)
    }, 1500)
  }

  const startEdit = () => {
    setForm({
      name: person.name,
      type: person.type,
      role: person.role ?? '',
      company: person.company ?? '',
      primary_pillar: person.primary_pillar ?? '',
      notes: person.notes ?? '',
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!form.name.trim()) return
    await onEdit(person.id, form)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="bg-white border border-[#E3E0D8] rounded-xl p-4 space-y-2.5 shadow-sm">
        <input
          autoFocus
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Name"
          className="w-full text-sm bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#D4622A]/30 focus:border-[#D4622A]"
        />
        <div className="flex items-center gap-2">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as PersonType })}
            className="text-xs bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-2.5 py-1.5"
          >
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>
          <input
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            placeholder="Role"
            className="flex-1 text-sm bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-1.5 focus:outline-none"
          />
          {form.type === 'external' && (
            <input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="Company"
              className="flex-1 text-sm bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-1.5 focus:outline-none"
            />
          )}
        </div>
        <select
          value={form.primary_pillar}
          onChange={(e) => setForm({ ...form, primary_pillar: e.target.value })}
          className="text-xs bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-2.5 py-1.5"
        >
          <option value="">No pillar</option>
          {PILLARS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Strengths, skills, general notes…"
          rows={2}
          className="w-full text-sm bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-1.5 resize-none focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button onClick={saveEdit} className="text-xs bg-[#D4622A] hover:bg-[#C05520] text-white px-3 py-1.5 rounded-lg font-medium transition-colors">Save</button>
          <button onClick={() => setEditing(false)} className="text-xs text-[#9CA3AF] hover:text-[#6B6B6B] px-2 py-1.5 transition-colors">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#E3E0D8] rounded-xl p-4 shadow-sm group">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[#1A1A1A]">{person.name}</span>
            {person.primary_pillar && (
              <span className={`text-xs border px-2 py-0.5 rounded-full ${PILLAR_STYLES[person.primary_pillar] ?? ''}`}>
                {person.primary_pillar}
              </span>
            )}
          </div>
          {(person.role || person.company) && (
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              {[person.role, person.company].filter(Boolean).join(' · ')}
            </p>
          )}
          {person.notes && (
            <p className="text-xs text-[#6B6B6B] mt-1.5 leading-relaxed">{person.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={startEdit} className="text-[#9CA3AF] hover:text-[#1A1A1A] p-1" title="Edit">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button onClick={() => onDelete(person.id)} className="text-[#C4BFB5] hover:text-red-500 p-1 text-xs" title="Delete">✕</button>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-[#F5F3EE]">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">Status</p>
          {statusSaving && <span className="text-xs text-[#C4BFB5]">Saving…</span>}
        </div>
        <textarea
          value={statusDraft}
          onChange={(e) => handleStatusChange(e.target.value)}
          placeholder="What's this person up to right now?"
          rows={1}
          className="w-full text-sm bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-1.5 resize-none focus:outline-none focus:border-[#D4622A]"
        />
      </div>
    </div>
  )
}

export default function PeopleSettingsSection() {
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/people')
      const data = await res.json()
      if (Array.isArray(data)) setPeople(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const addPerson = async () => {
    if (!form.name.trim()) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          role: form.role.trim() || null,
          company: form.company.trim() || null,
          primary_pillar: form.primary_pillar || null,
          notes: form.notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPeople((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(emptyForm)
      setShowForm(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add person')
    } finally {
      setAdding(false)
    }
  }

  const editPerson = async (id: string, edited: FormState) => {
    const res = await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: edited.name.trim(),
        type: edited.type,
        role: edited.role.trim() || null,
        company: edited.company.trim() || null,
        primary_pillar: edited.primary_pillar || null,
        notes: edited.notes.trim() || null,
      }),
    })
    if (res.ok) {
      setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...edited, role: edited.role || null, company: edited.company || null, primary_pillar: edited.primary_pillar || null, notes: edited.notes || null } : p)))
    }
  }

  const deletePerson = async (id: string) => {
    setPeople((prev) => prev.filter((p) => p.id !== id))
    await fetch(`/api/people/${id}`, { method: 'DELETE' })
  }

  const updateStatus = async (id: string, statusNote: string) => {
    await fetch(`/api/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status_note: statusNote }),
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm text-[#9CA3AF]">Loading…</span>
      </div>
    )
  }

  const internal = people.filter((p) => p.type === 'internal')
  const external = people.filter((p) => p.type === 'external')

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#FAF9F6]">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#1A1A1A]">People</h1>
            <p className="text-sm text-[#9CA3AF] mt-1">
              Defined once, used across Meetings and Tasks — the key people around you and your notes on their strengths and skills.
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex-shrink-0 bg-[#D4622A] hover:bg-[#C05520] text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            + Add Person
          </button>
        </div>

        {showForm && (
          <div className="bg-white border border-[#E3E0D8] rounded-xl p-4 space-y-2.5 shadow-sm">
            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') addPerson() }}
              placeholder="Name"
              className="w-full text-sm bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#D4622A]/30 focus:border-[#D4622A]"
            />
            <div className="flex items-center gap-2">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as PersonType })}
                className="text-sm bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-2"
              >
                <option value="internal">Internal</option>
                <option value="external">External</option>
              </select>
              <input
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="Role"
                className="flex-1 text-sm bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-2 focus:outline-none"
              />
              {form.type === 'external' && (
                <input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Company"
                  className="flex-1 text-sm bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-2 focus:outline-none"
                />
              )}
            </div>
            <select
              value={form.primary_pillar}
              onChange={(e) => setForm({ ...form, primary_pillar: e.target.value })}
              className="text-sm bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-2"
            >
              <option value="">No primary pillar</option>
              {PILLARS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Strengths, skills, general notes…"
              rows={2}
              className="w-full text-sm bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-2 resize-none focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={addPerson}
                disabled={adding || !form.name.trim()}
                className="text-xs font-medium px-4 py-2 rounded-lg bg-[#D4622A] hover:bg-[#C05520] text-white disabled:opacity-50 transition-colors"
              >
                {adding ? 'Adding…' : 'Save'}
              </button>
              <button onClick={() => setShowForm(false)} className="text-xs text-[#9CA3AF] hover:text-[#6B6B6B] px-2 py-2 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {people.length === 0 && !showForm ? (
          <p className="text-xs text-[#9CA3AF]">No people yet. Click &quot;Add Person&quot; to get started.</p>
        ) : (
          <>
            {internal.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">
                  Internal <span className="text-[#C4BFB5] font-normal normal-case">({internal.length})</span>
                </h2>
                <div className="space-y-3">
                  {internal.map((p) => (
                    <PersonRow key={p.id} person={p} onDelete={deletePerson} onEdit={editPerson} onStatusChange={updateStatus} />
                  ))}
                </div>
              </div>
            )}
            {external.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">
                  External <span className="text-[#C4BFB5] font-normal normal-case">({external.length})</span>
                </h2>
                <div className="space-y-3">
                  {external.map((p) => (
                    <PersonRow key={p.id} person={p} onDelete={deletePerson} onEdit={editPerson} onStatusChange={updateStatus} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
