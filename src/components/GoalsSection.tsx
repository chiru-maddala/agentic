'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { computeGoalPacing, type PacingStatus } from '@/lib/goals'

type SuggestedTask = {
  title: string
  description: string
  urgency: 'high' | 'medium' | 'low'
}

type PillarGoal = {
  id: string
  pillar: string
  name: string
  target_number: number | null
  target_date: string | null
  current_value: number | null
  current_value_updated_at: string | null
  plan_document: string | null
  plan_approved_at: string | null
  suggested_plan: SuggestedTask[]
  created_at: string
}

type TaskRef = {
  id: string
  title: string
  status: 'todo' | 'in-progress' | 'done'
  pillar: string
  goal_id: string | null
}

type MeetingRef = {
  id: string
  title: string
  meeting_date: string
  pillar: string | null
  goal_id: string | null
}

type FormState = { name: string; target_number: string; target_date: string }

const PILLARS = ['Learning AI', 'Enterprise AI', 'AI Infrastructure']

const PILLAR_META: Record<string, { border: string; badge: string; icon: string; products: string }> = {
  'Learning AI':       { border: 'border-blue-200',   badge: 'bg-blue-50 text-blue-700',   icon: '📚', products: 'Cypher · AutoCampus · RED AI' },
  'Enterprise AI':     { border: 'border-violet-200', badge: 'bg-violet-50 text-violet-700', icon: '🤖', products: 'Orchea.ai' },
  'AI Infrastructure': { border: 'border-amber-200',  badge: 'bg-amber-50 text-amber-700',  icon: '☁️', products: 'TerraNine · MATRIX' },
}

const PACING_META: Record<PacingStatus, { label: string; color: string }> = {
  'no-target':   { label: 'No target set',   color: 'text-[#9CA3AF] bg-[#F5F3EE] border-[#E3E0D8]' },
  'no-progress': { label: 'No progress yet', color: 'text-[#9CA3AF] bg-[#F5F3EE] border-[#E3E0D8]' },
  ahead:         { label: 'Ahead of pace',   color: 'text-green-600 bg-green-50 border-green-200' },
  'on-pace':     { label: 'On pace',         color: 'text-blue-600 bg-blue-50 border-blue-200' },
  behind:        { label: 'Behind pace',     color: 'text-amber-600 bg-amber-50 border-amber-200' },
  overdue:       { label: 'Overdue',         color: 'text-red-600 bg-red-50 border-red-200' },
}

const URGENCY_DOT: Record<SuggestedTask['urgency'], string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-400',
  low: 'bg-slate-300',
}

const STATUS_LABELS: Record<TaskRef['status'], string> = { todo: 'New', 'in-progress': 'In Progress', done: 'Done' }
const STATUS_COLORS: Record<TaskRef['status'], string> = {
  'todo': 'bg-[#F5F3EE] text-[#6B6B6B] border border-[#E3E0D8]',
  'in-progress': 'bg-amber-50 text-amber-700 border border-amber-200',
  'done': 'bg-green-50 text-green-700 border border-green-200',
}

function formatDate(d: string | null) {
  if (!d) return null
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── List view: per-pillar goal cards ──────────────────────────────────────
function GoalsListCard({ pillar, goals, onAdd, onDelete, onSelect }: {
  pillar: string
  goals: PillarGoal[]
  onAdd: (pillar: string, name: string, targetNumber: string, targetDate: string) => Promise<void>
  onDelete: (id: string) => void
  onSelect: (id: string) => void
}) {
  const meta = PILLAR_META[pillar]
  const [form, setForm] = useState<FormState>({ name: '', target_number: '', target_date: '' })
  const [adding, setAdding] = useState(false)

  const submit = async () => {
    if (!form.name.trim()) return
    setAdding(true)
    try {
      await onAdd(pillar, form.name.trim(), form.target_number, form.target_date)
      setForm({ name: '', target_number: '', target_date: '' })
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className={`bg-white border ${meta.border} rounded-xl overflow-hidden shadow-sm`}>
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[#E3E0D8] bg-[#FAF9F6]">
        <span className="text-base">{meta.icon}</span>
        <span className="text-sm font-semibold text-[#1A1A1A]">{pillar}</span>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.products}</span>
      </div>
      {goals.length > 0 && (
        <div className="divide-y divide-[#F5F3EE]">
          {goals.map((g) => {
            const pacing = computeGoalPacing(g)
            const pacingMeta = PACING_META[pacing.status]
            return (
              <div key={g.id} className="px-5 py-3 flex items-start gap-3 group">
                <button onClick={() => onSelect(g.id)} className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-[#1A1A1A] leading-snug hover:text-[#D4622A] transition-colors">{g.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-[#9CA3AF]">
                      {g.current_value ?? 0}/{g.target_number ?? '?'}{g.target_date ? ` by ${formatDate(g.target_date)}` : ''}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border ${pacingMeta.color}`}>{pacingMeta.label}</span>
                  </div>
                </button>
                <button
                  onClick={() => onDelete(g.id)}
                  className="opacity-0 group-hover:opacity-100 text-[#C4BFB5] hover:text-red-500 transition-opacity text-xs p-1"
                  title="Delete goal"
                >✕</button>
              </div>
            )
          })}
        </div>
      )}
      <div className="px-5 py-3 border-t border-[#F5F3EE] bg-[#FAF9F6] space-y-2">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder="Goal name"
          className="w-full text-sm bg-white border border-[#E3E0D8] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#D4622A]"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={form.target_number}
            onChange={(e) => setForm({ ...form, target_number: e.target.value })}
            placeholder="Target number"
            className="flex-1 text-sm bg-white border border-[#E3E0D8] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#D4622A]"
          />
          <input
            type="date"
            value={form.target_date}
            onChange={(e) => setForm({ ...form, target_date: e.target.value })}
            className="flex-1 text-sm bg-white border border-[#E3E0D8] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#D4622A]"
          />
        </div>
        <button
          onClick={submit}
          disabled={adding || !form.name.trim()}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#D4622A] hover:bg-[#C05520] text-white disabled:opacity-50 transition-colors"
        >
          {adding ? 'Adding…' : '+ Add Goal'}
        </button>
      </div>
    </div>
  )
}

// ─── Detail view ────────────────────────────────────────────────────────────
function GoalDetailView({ goal, tasks, meetings, onBack, onGoalUpdate, onTaskCreated }: {
  goal: PillarGoal
  tasks: TaskRef[]
  meetings: MeetingRef[]
  onBack: () => void
  onGoalUpdate: (updated: PillarGoal) => void
  onTaskCreated: (task: TaskRef) => void
}) {
  const meta = PILLAR_META[goal.pillar]
  const pacing = computeGoalPacing(goal)
  const pacingMeta = PACING_META[pacing.status]

  const [currentValueDraft, setCurrentValueDraft] = useState(goal.current_value?.toString() ?? '')
  const [savingValue, setSavingValue] = useState(false)
  const valueTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [generating, setGenerating] = useState(false)
  const [streamedDoc, setStreamedDoc] = useState('')
  const [feedback, setFeedback] = useState('')
  const [approving, setApproving] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [addingKey, setAddingKey] = useState<string | null>(null)
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set())
  const [planError, setPlanError] = useState<string | null>(null)

  const handleValueChange = (value: string) => {
    setCurrentValueDraft(value)
    if (valueTimer.current) clearTimeout(valueTimer.current)
    setSavingValue(true)
    valueTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/mirror/pillar-goals/${goal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_value: value ? Number(value) : null }),
      })
      if (res.ok) onGoalUpdate(await res.json())
      setSavingValue(false)
    }, 1500)
  }

  const generatePlan = async (withFeedback?: string) => {
    setGenerating(true)
    setStreamedDoc('')
    setPlanError(null)
    try {
      const res = await fetch(`/api/mirror/pillar-goals/${goal.id}/plan-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withFeedback ? { feedback: withFeedback } : {}),
      })
      if (!res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        full += chunk
        setStreamedDoc((prev) => prev + chunk)
      }
      onGoalUpdate({ ...goal, plan_document: full, plan_approved_at: null })
      setFeedback('')
    } finally {
      setGenerating(false)
    }
  }

  const approvePlan = async () => {
    setApproving(true)
    try {
      const res = await fetch(`/api/mirror/pillar-goals/${goal.id}/approve-plan`, { method: 'POST' })
      if (res.ok) onGoalUpdate(await res.json())
    } finally {
      setApproving(false)
    }
  }

  const extractTasks = async () => {
    setExtracting(true)
    setPlanError(null)
    try {
      const res = await fetch(`/api/mirror/pillar-goals/${goal.id}/plan-tasks`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && Array.isArray(data.tasks)) {
        onGoalUpdate({ ...goal, suggested_plan: data.tasks })
      } else {
        setPlanError(data.error ?? 'Failed to extract tasks')
      }
    } finally {
      setExtracting(false)
    }
  }

  const approveTask = async (suggestion: SuggestedTask, index: number) => {
    const key = `${goal.id}-${index}`
    setAddingKey(key)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: suggestion.title,
          description: suggestion.description,
          pillar: goal.pillar,
          status: 'todo',
          source: 'goal_plan',
          goal_id: goal.id,
        }),
      })
      const created: TaskRef = await res.json()
      if (res.ok) {
        onTaskCreated(created)
        setAddedKeys((prev) => new Set(prev).add(key))
      }
    } finally {
      setAddingKey(null)
    }
  }

  const linkedTasks = tasks.filter((t) => t.goal_id === goal.id)
  const linkedMeetings = meetings.filter((m) => m.goal_id === goal.id)
  const isSuggestionAdded = (s: SuggestedTask, i: number) =>
    addedKeys.has(`${goal.id}-${i}`) || linkedTasks.some((t) => t.title === s.title)

  const docToShow = generating ? streamedDoc : (goal.plan_document ?? streamedDoc)

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <div>
        <button onClick={onBack} className="text-xs text-[#9CA3AF] hover:text-[#1A1A1A] transition-colors mb-4">
          ← Back to Goals
        </button>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">{meta.icon}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${meta.badge}`}>{goal.pillar}</span>
        </div>
        <h1 className="text-2xl font-semibold text-[#1A1A1A]">{goal.name}</h1>
      </div>

      {/* Big number */}
      <div className="bg-white border border-[#E3E0D8] rounded-2xl px-8 py-8 shadow-sm">
        <div className="flex items-end gap-3 flex-wrap">
          <input
            type="number"
            value={currentValueDraft}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="0"
            className="text-5xl font-bold text-[#1A1A1A] bg-transparent w-40 focus:outline-none border-b-2 border-transparent focus:border-[#D4622A] transition-colors"
          />
          <span className="text-2xl text-[#C4BFB5] font-medium pb-1">/ {goal.target_number ?? '?'}</span>
          {savingValue && <span className="text-xs text-[#9CA3AF] pb-2">Saving…</span>}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${pacingMeta.color}`}>{pacingMeta.label}</span>
          {goal.target_date && <span className="text-xs text-[#9CA3AF]">Target date: {formatDate(goal.target_date)}</span>}
        </div>
      </div>

      {/* Plan */}
      <div className="bg-white border border-[#E3E0D8] rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#E3E0D8] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1A1A1A]">Plan</h2>
          {!docToShow && !generating && (
            <button
              onClick={() => generatePlan()}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#D4622A] hover:bg-[#C05520] text-white transition-colors"
            >
              ⚡ Generate Plan
            </button>
          )}
        </div>

        {generating && !streamedDoc && (
          <div className="px-6 py-8 flex items-center gap-2 text-sm text-[#9CA3AF]">
            <span className="w-4 h-4 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin" />
            Generating plan…
          </div>
        )}

        {docToShow && (
          <>
            <div className="px-6 py-6">
              <div
                className="prose prose-sm max-w-none prose-headings:text-[#1A1A1A] prose-headings:font-semibold prose-p:text-[#374151] prose-p:leading-relaxed prose-strong:text-[#1A1A1A] prose-li:text-[#374151] prose-th:text-[#1A1A1A] prose-td:text-[#374151] prose-table:border prose-table:border-[#E3E0D8] prose-th:border prose-th:border-[#E3E0D8] prose-th:bg-[#F5F3EE] prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-[#E3E0D8] prose-td:px-3 prose-td:py-2"
                dangerouslySetInnerHTML={{ __html: docToShow }}
              />
              {generating && <span className="inline-block w-2 h-4 bg-[#D4622A] animate-pulse ml-1 align-middle rounded-sm" />}
            </div>

            {!generating && (
              <div className="px-6 py-4 border-t border-[#F5F3EE] bg-[#FAF9F6] space-y-3">
                {planError && <p className="text-xs text-red-600">{planError}</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  {goal.plan_approved_at ? (
                    <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-lg">✓ Plan approved</span>
                  ) : (
                    <button
                      onClick={approvePlan}
                      disabled={approving}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors"
                    >
                      {approving ? 'Approving…' : '✓ Approve Plan'}
                    </button>
                  )}
                  {goal.plan_approved_at && (
                    <button
                      onClick={extractTasks}
                      disabled={extracting}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#1A1A1A] hover:bg-black text-white disabled:opacity-50 transition-colors"
                    >
                      {extracting ? 'Extracting…' : 'Extract Tasks from Plan'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Suggest changes to this plan…"
                    className="flex-1 text-sm bg-white border border-[#E3E0D8] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#D4622A]"
                  />
                  <button
                    onClick={() => generatePlan(feedback)}
                    disabled={!feedback.trim()}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-[#E3E0D8] text-[#6B6B6B] hover:border-[#D4622A] hover:text-[#D4622A] disabled:opacity-50 transition-colors flex-shrink-0"
                  >
                    Regenerate with Feedback
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {goal.suggested_plan?.length > 0 && (
          <div className="px-6 py-4 border-t border-[#F5F3EE]">
            <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider mb-2">Tasks from this plan</p>
            <div className="space-y-2">
              {goal.suggested_plan.map((s, i) => {
                const added = isSuggestionAdded(s, i)
                const adding = addingKey === `${goal.id}-${i}`
                return (
                  <div key={i} className="flex items-start gap-3 bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-2">
                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${URGENCY_DOT[s.urgency] ?? URGENCY_DOT.medium}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#1A1A1A] leading-snug">{s.title}</p>
                      {s.description && <p className="text-xs text-[#9CA3AF] mt-0.5">{s.description}</p>}
                    </div>
                    <button
                      onClick={() => approveTask(s, i)}
                      disabled={adding || added}
                      className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        added
                          ? 'bg-green-50 text-green-600 border-green-200 cursor-default'
                          : 'bg-white border-[#E3E0D8] text-[#6B6B6B] hover:bg-[#D4622A] hover:text-white hover:border-[#D4622A]'
                      }`}
                    >
                      {adding ? (
                        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                      ) : added ? '✓ Active' : 'Approve'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Linked Tasks */}
      <div className="bg-white border border-[#E3E0D8] rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#E3E0D8]">
          <h2 className="text-sm font-semibold text-[#1A1A1A]">Linked Tasks <span className="text-[#C4BFB5] font-normal">({linkedTasks.length})</span></h2>
        </div>
        {linkedTasks.length === 0 ? (
          <p className="text-xs text-[#9CA3AF] px-6 py-4">No tasks linked to this goal yet.</p>
        ) : (
          <div className="divide-y divide-[#F5F3EE]">
            {linkedTasks.map((t) => (
              <div key={t.id} className="px-6 py-3 flex items-center gap-3">
                <span className="text-sm text-[#1A1A1A] flex-1">{t.title}</span>
                <span className={`text-xs rounded-full px-2.5 py-1 ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked Meetings */}
      <div className="bg-white border border-[#E3E0D8] rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#E3E0D8]">
          <h2 className="text-sm font-semibold text-[#1A1A1A]">Linked Meetings <span className="text-[#C4BFB5] font-normal">({linkedMeetings.length})</span></h2>
        </div>
        {linkedMeetings.length === 0 ? (
          <p className="text-xs text-[#9CA3AF] px-6 py-4">No meetings linked to this goal yet.</p>
        ) : (
          <div className="divide-y divide-[#F5F3EE]">
            {linkedMeetings.map((m) => (
              <div key={m.id} className="px-6 py-3 flex items-center gap-3">
                <span className="text-sm text-[#1A1A1A] flex-1">{m.title}</span>
                <span className="text-xs text-[#9CA3AF]">{formatDate(m.meeting_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function GoalsSection() {
  const [goals, setGoals] = useState<PillarGoal[]>([])
  const [tasks, setTasks] = useState<TaskRef[]>([])
  const [meetings, setMeetings] = useState<MeetingRef[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [goalsRes, tasksRes, meetingsRes] = await Promise.all([
        fetch('/api/mirror/pillar-goals'),
        fetch('/api/tasks'),
        fetch('/api/meetings'),
      ])
      const [goalsData, tasksData, meetingsData] = await Promise.all([
        goalsRes.json(),
        tasksRes.json(),
        meetingsRes.json(),
      ])
      if (Array.isArray(goalsData)) setGoals(goalsData)
      if (Array.isArray(tasksData)) setTasks(tasksData)
      if (Array.isArray(meetingsData)) setMeetings(meetingsData)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const addGoal = async (pillar: string, name: string, targetNumber: string, targetDate: string) => {
    const res = await fetch('/api/mirror/pillar-goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pillar,
        name,
        target_number: targetNumber ? Number(targetNumber) : null,
        target_date: targetDate || null,
      }),
    })
    if (res.ok) {
      const created: PillarGoal = await res.json()
      setGoals((prev) => [...prev, created])
    }
  }

  const deleteGoal = async (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id))
    if (selectedGoalId === id) setSelectedGoalId(null)
    await fetch(`/api/mirror/pillar-goals/${id}`, { method: 'DELETE' })
  }

  const updateGoal = (updated: PillarGoal) => {
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? { ...g, ...updated } : g)))
  }

  const addTask = (task: TaskRef) => setTasks((prev) => [...prev, task])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm text-[#9CA3AF]">Loading…</span>
      </div>
    )
  }

  const selectedGoal = goals.find((g) => g.id === selectedGoalId) ?? null

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#FAF9F6]">
      <div className="flex items-center gap-2 px-6 py-4 bg-white border-b border-[#E3E0D8] flex-shrink-0">
        <span className="text-lg">🎯</span>
        <div>
          <h1 className="text-base font-semibold text-[#1A1A1A]">Goals</h1>
          <p className="text-xs text-[#9CA3AF] mt-0.5">Every measurable goal, its plan, and everything aligned to it</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedGoal ? (
          <GoalDetailView
            goal={selectedGoal}
            tasks={tasks}
            meetings={meetings}
            onBack={() => setSelectedGoalId(null)}
            onGoalUpdate={updateGoal}
            onTaskCreated={addTask}
          />
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
            {PILLARS.map((pillar) => (
              <GoalsListCard
                key={pillar}
                pillar={pillar}
                goals={goals.filter((g) => g.pillar === pillar)}
                onAdd={addGoal}
                onDelete={deleteGoal}
                onSelect={setSelectedGoalId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
