'use client'

import { useCallback, useEffect, useState } from 'react'

type PersonRef = { id: string; name: string }

type SuggestedTask = {
  title: string
  description: string
  urgency: 'high' | 'medium' | 'low'
  person_id: string | null
}

type Meeting = {
  id: string
  title: string
  meeting_date: string
  pillar: string | null
  notes: string | null
  suggested_tasks: SuggestedTask[]
  created_at: string
  meeting_people: { people: PersonRef }[]
}

type TaskRef = {
  id: string
  title: string
  meeting_id: string | null
}

type FormState = {
  title: string
  meeting_date: string
  pillar: string
  notes: string
  person_ids: string[]
}

const PILLARS = ['Learning AI', 'Enterprise AI', 'AI Infrastructure']

const PILLAR_STYLES: Record<string, string> = {
  'Learning AI': 'bg-[#EEF6FF] text-[#2563EB] border-[#CFE2FF]',
  'Enterprise AI': 'bg-[#FEF3EC] text-[#D4622A] border-[#F5D3BC]',
  'AI Infrastructure': 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]',
}

const URGENCY_DOT: Record<SuggestedTask['urgency'], string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-400',
  low: 'bg-slate-300',
}

const today = () => new Date().toISOString().slice(0, 10)

function emptyForm(): FormState {
  return { title: '', meeting_date: today(), pillar: '', notes: '', person_ids: [] }
}

function MeetingCard({
  meeting,
  people,
  tasks,
  extracting,
  addingKey,
  addedKeys,
  onAddTask,
}: {
  meeting: Meeting
  people: PersonRef[]
  tasks: TaskRef[]
  extracting: boolean
  addingKey: string | null
  addedKeys: Set<string>
  onAddTask: (meeting: Meeting, suggestion: SuggestedTask, index: number) => void
}) {
  const attendees = (meeting.meeting_people ?? []).map((mp) => mp.people).filter(Boolean)
  const meetingTasks = tasks.filter((t) => t.meeting_id === meeting.id)
  const isAdded = (suggestion: SuggestedTask, index: number) =>
    addedKeys.has(`${meeting.id}-${index}`) || meetingTasks.some((t) => t.title === suggestion.title)
  const personName = (id: string | null) => (id ? people.find((p) => p.id === id)?.name ?? null : null)

  return (
    <div className="bg-white border border-[#E3E0D8] rounded-xl p-4 shadow-sm">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[#1A1A1A]">{meeting.title}</span>
            {meeting.pillar && (
              <span className={`text-xs border px-2 py-0.5 rounded-full ${PILLAR_STYLES[meeting.pillar] ?? ''}`}>
                {meeting.pillar}
              </span>
            )}
          </div>
          <p className="text-xs text-[#9CA3AF] mt-0.5">
            {new Date(`${meeting.meeting_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          {attendees.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {attendees.map((a) => (
                <span key={a.id} className="text-xs bg-[#F5F3EE] text-[#6B6B6B] px-2 py-0.5 rounded-full">{a.name}</span>
              ))}
            </div>
          )}
          {meeting.notes && (
            <p className="text-xs text-[#6B6B6B] mt-2 leading-relaxed whitespace-pre-wrap">{meeting.notes}</p>
          )}
        </div>
      </div>

      {(extracting || meeting.suggested_tasks?.length > 0) && (
        <div className="mt-3 pt-3 border-t border-[#F5F3EE]">
          <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider mb-2">Suggested Tasks</p>
          {extracting ? (
            <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
              <span className="w-3 h-3 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin" />
              Extracting tasks…
            </div>
          ) : (
            <div className="space-y-2">
              {meeting.suggested_tasks.map((s, i) => {
                const added = isAdded(s, i)
                const adding = addingKey === `${meeting.id}-${i}`
                const owner = personName(s.person_id)
                return (
                  <div key={i} className="flex items-start gap-3 bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-2">
                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${URGENCY_DOT[s.urgency] ?? URGENCY_DOT.medium}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#1A1A1A] leading-snug">{s.title}</p>
                      {s.description && <p className="text-xs text-[#9CA3AF] mt-0.5">{s.description}</p>}
                      {owner && <p className="text-xs text-[#D4622A] mt-0.5">Suggested owner: {owner}</p>}
                    </div>
                    <button
                      onClick={() => onAddTask(meeting, s, i)}
                      disabled={adding || added}
                      className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        added
                          ? 'bg-green-50 text-green-600 border-green-200 cursor-default'
                          : 'bg-white border-[#E3E0D8] text-[#6B6B6B] hover:bg-[#D4622A] hover:text-white hover:border-[#D4622A]'
                      }`}
                    >
                      {adding ? (
                        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                      ) : added ? '✓ Added' : '+ Add to Tasks'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function MeetingsSection() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [people, setPeople] = useState<PersonRef[]>([])
  const [tasks, setTasks] = useState<TaskRef[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [extractingId, setExtractingId] = useState<string | null>(null)
  const [addingKey, setAddingKey] = useState<string | null>(null)
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [meetingsRes, peopleRes, tasksRes] = await Promise.all([
        fetch('/api/meetings'),
        fetch('/api/people'),
        fetch('/api/tasks'),
      ])
      const [meetingsData, peopleData, tasksData] = await Promise.all([
        meetingsRes.json(),
        peopleRes.json(),
        tasksRes.json(),
      ])
      if (Array.isArray(meetingsData)) setMeetings(meetingsData)
      if (Array.isArray(peopleData)) setPeople(peopleData)
      if (Array.isArray(tasksData)) setTasks(tasksData)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const togglePerson = (id: string) => {
    setForm((prev) => ({
      ...prev,
      person_ids: prev.person_ids.includes(id)
        ? prev.person_ids.filter((p) => p !== id)
        : [...prev.person_ids, id],
    }))
  }

  const createMeeting = async () => {
    if (!form.title.trim() || !form.meeting_date) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          meeting_date: form.meeting_date,
          pillar: form.pillar || null,
          notes: form.notes.trim() || null,
          person_ids: form.person_ids,
        }),
      })
      const created: Meeting = await res.json()
      if (!res.ok) throw new Error((created as unknown as { error?: string }).error ?? 'Failed to save meeting')

      setMeetings((prev) => [created, ...prev])
      setForm(emptyForm())
      setShowForm(false)

      if (form.notes.trim()) {
        setExtractingId(created.id)
        try {
          const extractRes = await fetch(`/api/meetings/${created.id}/extract-tasks`, { method: 'POST' })
          const extracted = await extractRes.json()
          if (extractRes.ok && Array.isArray(extracted.tasks)) {
            setMeetings((prev) => prev.map((m) => (m.id === created.id ? { ...m, suggested_tasks: extracted.tasks } : m)))
          }
        } finally {
          setExtractingId(null)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save meeting')
    } finally {
      setSaving(false)
    }
  }

  const addSuggestionToTask = async (meeting: Meeting, suggestion: SuggestedTask, index: number) => {
    const key = `${meeting.id}-${index}`
    setAddingKey(key)
    setAddError(null)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: suggestion.title,
          description: suggestion.description,
          pillar: meeting.pillar ?? 'General',
          status: 'todo',
          source: 'meeting',
          meeting_id: meeting.id,
          person_id: suggestion.person_id ?? null,
        }),
      })
      const created: TaskRef & { error?: string } = await res.json()
      if (res.ok) {
        setTasks((prev) => [...prev, created])
        setAddedKeys((prev) => new Set(prev).add(key))
      } else {
        setAddError(created.error ?? 'Failed to add task')
      }
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to add task')
    } finally {
      setAddingKey(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm text-[#9CA3AF]">Loading…</span>
      </div>
    )
  }

  const todayStr = today()
  const upcoming = meetings.filter((m) => m.meeting_date >= todayStr).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))
  const past = meetings.filter((m) => m.meeting_date < todayStr).sort((a, b) => b.meeting_date.localeCompare(a.meeting_date))

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#FAF9F6]">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#1A1A1A]">Meetings</h1>
            <p className="text-sm text-[#9CA3AF] mt-1">Capture the details — the system suggests action items from your notes.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex-shrink-0 bg-[#D4622A] hover:bg-[#C05520] text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            + Add Meeting
          </button>
        </div>

        {addError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            Couldn&apos;t add task: {addError}
          </div>
        )}

        {showForm && (
          <div className="bg-white border border-[#E3E0D8] rounded-xl p-4 space-y-3 shadow-sm">
            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Meeting title"
              className="w-full text-sm bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#D4622A]/30 focus:border-[#D4622A]"
            />
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={form.meeting_date}
                onChange={(e) => setForm({ ...form, meeting_date: e.target.value })}
                className="text-sm bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-2 focus:outline-none"
              />
              <select
                value={form.pillar}
                onChange={(e) => setForm({ ...form, pillar: e.target.value })}
                className="text-sm bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-2"
              >
                <option value="">No pillar</option>
                {PILLARS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider mb-1.5">Attendees</p>
              {people.length === 0 ? (
                <p className="text-xs text-[#9CA3AF]">No people yet — add them in Settings → People first.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {people.map((p) => {
                    const selected = form.person_ids.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePerson(p.id)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          selected ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-[#FAF9F6] text-[#6B6B6B] border-[#E3E0D8] hover:border-[#D4622A]'
                        }`}
                      >
                        {p.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Meeting notes — key details, decisions, and anything that implies a follow-up…"
              rows={4}
              className="w-full text-sm bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-2 resize-none focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={createMeeting}
                disabled={saving || !form.title.trim()}
                className="text-xs font-medium px-4 py-2 rounded-lg bg-[#D4622A] hover:bg-[#C05520] text-white disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setShowForm(false)} className="text-xs text-[#9CA3AF] hover:text-[#6B6B6B] px-2 py-2 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {meetings.length === 0 && !showForm ? (
          <p className="text-xs text-[#9CA3AF]">No meetings yet. Click &quot;Add Meeting&quot; to log one.</p>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">
                  Upcoming <span className="text-[#C4BFB5] font-normal normal-case">({upcoming.length})</span>
                </h2>
                <div className="space-y-3">
                  {upcoming.map((m) => (
                    <MeetingCard key={m.id} meeting={m} people={people} tasks={tasks} extracting={extractingId === m.id} addingKey={addingKey} addedKeys={addedKeys} onAddTask={addSuggestionToTask} />
                  ))}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">
                  Past <span className="text-[#C4BFB5] font-normal normal-case">({past.length})</span>
                </h2>
                <div className="space-y-3">
                  {past.map((m) => (
                    <MeetingCard key={m.id} meeting={m} people={people} tasks={tasks} extracting={extractingId === m.id} addingKey={addingKey} addedKeys={addedKeys} onAddTask={addSuggestionToTask} />
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
