'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { computeGoalPacing, type PacingStatus } from '@/lib/goals'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import Placeholder from '@tiptap/extension-placeholder'

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

type Achievement = {
  id: string
  goal_id: string
  title: string
  location: string | null
  notes: string | null
  achieved_at: string
  created_at: string
}

type FormState = { name: string; target_number: string; target_date: string }
type AchievementFormState = { title: string; location: string; notes: string; achieved_at: string }
type GoalTab = 'plan' | 'achieved' | 'tasks' | 'meetings'

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

// ─── Big-number input, remounted (via key) whenever the server value changes externally ──
function CurrentValueInput({ initialValue, targetNumber, onSave }: {
  initialValue: string
  targetNumber: number | null
  onSave: (value: string) => void
}) {
  const [draft, setDraft] = useState(initialValue)
  const [saving, setSaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const handleChange = (value: string) => {
    setDraft(value)
    if (timer.current) clearTimeout(timer.current)
    setSaving(true)
    timer.current = setTimeout(() => {
      onSave(value)
      setSaving(false)
    }, 1500)
  }

  return (
    <div className="flex items-end gap-3 flex-wrap">
      <input
        type="number"
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="0"
        className="text-5xl font-bold text-[#1A1A1A] bg-transparent w-40 focus:outline-none border-b-2 border-transparent focus:border-[#D4622A] transition-colors"
      />
      <span className="text-2xl text-[#C4BFB5] font-medium pb-1">/ {targetNumber ?? '?'}</span>
      {saving && <span className="text-xs text-[#9CA3AF] pb-2">Saving…</span>}
    </div>
  )
}

// ─── Rich text editor for an approved plan document ────────────────────────
function PlanEditor({ initialContent, onSave }: { initialContent: string; onSave: (html: string) => void }) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: 'Edit the plan…' }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => onSave(editor.getHTML()), 1200)
    },
  })

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  const btn = (onClick: () => void, title: string, children: React.ReactNode, active?: boolean) => (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded text-sm w-7 h-7 flex items-center justify-center transition-colors ${
        active ? 'bg-[#D4622A] text-white' : 'text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#F5F3EE]'
      }`}
    >
      {children}
    </button>
  )

  if (!editor) return null

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 px-6 py-2 border-b border-[#E3E0D8] bg-[#FAF9F6]">
        {btn(() => editor.chain().focus().toggleBold().run(), 'Bold', <b>B</b>, editor.isActive('bold'))}
        {btn(() => editor.chain().focus().toggleItalic().run(), 'Italic', <i>I</i>, editor.isActive('italic'))}
        {btn(() => editor.chain().focus().toggleStrike().run(), 'Strikethrough', <s>S</s>, editor.isActive('strike'))}
        <div className="w-px h-5 bg-[#E3E0D8] mx-1" />
        {btn(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'H2', <span className="text-xs">H2</span>, editor.isActive('heading', { level: 2 }))}
        {btn(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'H3', <span className="text-xs">H3</span>, editor.isActive('heading', { level: 3 }))}
        <div className="w-px h-5 bg-[#E3E0D8] mx-1" />
        {btn(() => editor.chain().focus().toggleBulletList().run(), 'Bullet list', '•', editor.isActive('bulletList'))}
        {btn(() => editor.chain().focus().toggleOrderedList().run(), 'Numbered list', '1.', editor.isActive('orderedList'))}
        {btn(() => editor.chain().focus().toggleBlockquote().run(), 'Blockquote', '"', editor.isActive('blockquote'))}
        <div className="w-px h-5 bg-[#E3E0D8] mx-1" />
        {btn(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), 'Insert table', (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
          </svg>
        ))}
      </div>
      <EditorContent editor={editor} className="goal-plan-tiptap px-6 py-6" />
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

  const [generating, setGenerating] = useState(false)
  const [streamedDoc, setStreamedDoc] = useState('')
  const [feedback, setFeedback] = useState('')
  const [approving, setApproving] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [addingKey, setAddingKey] = useState<string | null>(null)
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set())
  const [planError, setPlanError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<GoalTab>('plan')
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [achievementForm, setAchievementForm] = useState<AchievementFormState>({ title: '', location: '', notes: '', achieved_at: '' })
  const [addingAchievement, setAddingAchievement] = useState(false)

  useEffect(() => {
    fetch(`/api/mirror/pillar-goals/${goal.id}/achievements`)
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setAchievements(data) })
      .catch(() => {})
  }, [goal.id])

  const addAchievement = async () => {
    if (!achievementForm.title.trim()) return
    setAddingAchievement(true)
    try {
      const res = await fetch(`/api/mirror/pillar-goals/${goal.id}/achievements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(achievementForm),
      })
      const data = await res.json()
      if (res.ok) {
        setAchievements((prev) => [data.achievement, ...prev])
        onGoalUpdate(data.goal)
        setAchievementForm({ title: '', location: '', notes: '', achieved_at: '' })
      }
    } finally {
      setAddingAchievement(false)
    }
  }

  const deleteAchievement = async (achievementId: string) => {
    setAchievements((prev) => prev.filter((a) => a.id !== achievementId))
    const res = await fetch(`/api/mirror/pillar-goals/${goal.id}/achievements/${achievementId}`, { method: 'DELETE' })
    if (res.ok) {
      const data = await res.json()
      if (data.goal) onGoalUpdate(data.goal)
    }
  }

  const savePlanDocument = useCallback(async (html: string) => {
    const res = await fetch(`/api/mirror/pillar-goals/${goal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_document: html }),
    })
    if (res.ok) onGoalUpdate(await res.json())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal.id])

  const saveCurrentValue = useCallback(async (value: string) => {
    const res = await fetch(`/api/mirror/pillar-goals/${goal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_value: value ? Number(value) : null }),
    })
    if (res.ok) onGoalUpdate(await res.json())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal.id])

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
        <CurrentValueInput
          key={goal.current_value_updated_at ?? 'unset'}
          initialValue={goal.current_value?.toString() ?? ''}
          targetNumber={goal.target_number}
          onSave={saveCurrentValue}
        />
        <div className="flex items-center gap-2 mt-3">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${pacingMeta.color}`}>{pacingMeta.label}</span>
          {goal.target_date && <span className="text-xs text-[#9CA3AF]">Target date: {formatDate(goal.target_date)}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#E3E0D8]">
        {([
          { key: 'plan', label: 'Plan' },
          { key: 'achieved', label: 'Achieved', count: achievements.length },
          { key: 'tasks', label: 'Tasks', count: linkedTasks.length },
          { key: 'meetings', label: 'Meetings', count: linkedMeetings.length },
        ] as { key: GoalTab; label: string; count?: number }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-[#D4622A] text-[#1A1A1A]'
                : 'border-transparent text-[#9CA3AF] hover:text-[#1A1A1A]'
            }`}
          >
            {tab.label}
            {tab.count != null && <span className="ml-1.5 text-xs text-[#C4BFB5]">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Plan */}
      {activeTab === 'plan' && (
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
            {!generating && goal.plan_approved_at ? (
              <PlanEditor initialContent={docToShow} onSave={savePlanDocument} />
            ) : (
              <div className="px-6 py-6">
                <div
                  className="prose prose-sm max-w-none prose-headings:text-[#1A1A1A] prose-headings:font-semibold prose-p:text-[#374151] prose-p:leading-relaxed prose-strong:text-[#1A1A1A] prose-li:text-[#374151] prose-th:text-[#1A1A1A] prose-td:text-[#374151] prose-table:border prose-table:border-[#E3E0D8] prose-th:border prose-th:border-[#E3E0D8] prose-th:bg-[#F5F3EE] prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-[#E3E0D8] prose-td:px-3 prose-td:py-2"
                  dangerouslySetInnerHTML={{ __html: docToShow }}
                />
                {generating && <span className="inline-block w-2 h-4 bg-[#D4622A] animate-pulse ml-1 align-middle rounded-sm" />}
              </div>
            )}

            {!generating && (
              <div className="px-6 py-4 border-t border-[#F5F3EE] bg-[#FAF9F6] space-y-3">
                {planError && <p className="text-xs text-red-600">{planError}</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  {goal.plan_approved_at ? (
                    <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-lg">✓ Plan approved · editable above</span>
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
      )}

      {/* Achieved */}
      {activeTab === 'achieved' && (
        <div className="bg-white border border-[#E3E0D8] rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-[#E3E0D8] space-y-3">
            <h2 className="text-sm font-semibold text-[#1A1A1A]">Log an achievement</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                value={achievementForm.title}
                onChange={(e) => setAchievementForm({ ...achievementForm, title: e.target.value })}
                placeholder="Title (e.g. school name)"
                className="text-sm bg-white border border-[#E3E0D8] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#D4622A]"
              />
              <input
                value={achievementForm.location}
                onChange={(e) => setAchievementForm({ ...achievementForm, location: e.target.value })}
                placeholder="Location"
                className="text-sm bg-white border border-[#E3E0D8] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#D4622A]"
              />
              <input
                type="date"
                value={achievementForm.achieved_at}
                onChange={(e) => setAchievementForm({ ...achievementForm, achieved_at: e.target.value })}
                className="text-sm bg-white border border-[#E3E0D8] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#D4622A]"
              />
            </div>
            <textarea
              value={achievementForm.notes}
              onChange={(e) => setAchievementForm({ ...achievementForm, notes: e.target.value })}
              placeholder="Notes…"
              rows={2}
              className="w-full text-sm bg-white border border-[#E3E0D8] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#D4622A] resize-none"
            />
            <button
              onClick={addAchievement}
              disabled={addingAchievement || !achievementForm.title.trim()}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#D4622A] hover:bg-[#C05520] text-white disabled:opacity-50 transition-colors"
            >
              {addingAchievement ? 'Logging…' : '+ Log Achievement'}
            </button>
          </div>
          {achievements.length === 0 ? (
            <p className="text-xs text-[#9CA3AF] px-6 py-4">No achievements logged yet.</p>
          ) : (
            <div className="divide-y divide-[#F5F3EE]">
              {achievements.map((a) => (
                <div key={a.id} className="px-6 py-3 flex items-start gap-3 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1A1A]">{a.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-[#9CA3AF]">
                      {a.location && <span>{a.location}</span>}
                      <span>{formatDate(a.achieved_at)}</span>
                    </div>
                    {a.notes && <p className="text-xs text-[#6B6B6B] mt-1">{a.notes}</p>}
                  </div>
                  <button
                    onClick={() => deleteAchievement(a.id)}
                    className="opacity-0 group-hover:opacity-100 text-[#C4BFB5] hover:text-red-500 transition-opacity text-xs p-1"
                    title="Delete achievement"
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tasks */}
      {activeTab === 'tasks' && (
        <div className="bg-white border border-[#E3E0D8] rounded-2xl overflow-hidden shadow-sm">
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
      )}

      {/* Meetings */}
      {activeTab === 'meetings' && (
        <div className="bg-white border border-[#E3E0D8] rounded-2xl overflow-hidden shadow-sm">
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
      )}
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
            key={selectedGoal.id}
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

      <style jsx global>{`
        .goal-plan-tiptap .ProseMirror {
          min-height: 150px;
          color: #374151;
          font-size: 0.875rem;
          line-height: 1.75;
          outline: none;
        }
        .goal-plan-tiptap .ProseMirror p.is-editor-empty:first-child::before {
          color: #C4BFB5;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .goal-plan-tiptap .ProseMirror h1 { font-size: 1.5rem; font-weight: 700; margin: 1em 0 0.5em; color: #1A1A1A; }
        .goal-plan-tiptap .ProseMirror h2 { font-size: 1.25rem; font-weight: 600; margin: 1em 0 0.5em; color: #1A1A1A; }
        .goal-plan-tiptap .ProseMirror h3 { font-size: 1.1rem; font-weight: 600; margin: 0.8em 0 0.4em; color: #374151; }
        .goal-plan-tiptap .ProseMirror ul { list-style: disc; padding-left: 1.5em; margin: 0.5em 0; }
        .goal-plan-tiptap .ProseMirror ol { list-style: decimal; padding-left: 1.5em; margin: 0.5em 0; }
        .goal-plan-tiptap .ProseMirror li { margin: 0.25em 0; }
        .goal-plan-tiptap .ProseMirror strong { font-weight: 700; color: #1A1A1A; }
        .goal-plan-tiptap .ProseMirror em { font-style: italic; }
        .goal-plan-tiptap .ProseMirror s { text-decoration: line-through; }
        .goal-plan-tiptap .ProseMirror blockquote { border-left: 3px solid #D4622A; padding-left: 1em; color: #6B6B6B; margin: 0.5em 0; }
        .goal-plan-tiptap .ProseMirror table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        .goal-plan-tiptap .ProseMirror table td, .goal-plan-tiptap .ProseMirror table th {
          border: 1px solid #E3E0D8; padding: 0.5em 0.75em; text-align: left; min-width: 80px;
        }
        .goal-plan-tiptap .ProseMirror table th { background: #F5F3EE; font-weight: 600; color: #1A1A1A; }
        .goal-plan-tiptap .ProseMirror table .selectedCell { background: #FEF3EC; }
        .goal-plan-tiptap .ProseMirror .tableWrapper { overflow-x: auto; }
      `}</style>
    </div>
  )
}
