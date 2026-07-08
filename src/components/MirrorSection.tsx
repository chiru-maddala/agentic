'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import ReportDisplay from './ReportDisplay'
import type { ActionsPayload, PillarStatus } from '@/app/api/mirror/actions/route'
import type { Thought } from '@/app/api/mirror/thoughts/route'

type MirrorTab = 'intent' | 'coach' | 'signals' | 'thoughts'

const THOUGHT_MAX_LENGTH = 280

type Goal = {
  pillar: string
  goal_statement: string
  success_criteria: string
  north_star_metric: string
  constraints_context: string
  updated_at: string
}

type Signal = {
  id: string
  type: string
  content: string
  pillar: string | null
  created_at: string
}

const PILLARS = ['Learning AI', 'Enterprise AI', 'AI Infrastructure']

const PILLAR_COLORS: Record<string, {
  border: string; badge: string; icon: string
  bg: string; accent: string; bar: string; text: string
}> = {
  'Learning AI':       { border: 'border-blue-200',   badge: 'bg-blue-50 text-blue-700',   icon: '📚', bg: 'bg-blue-50',   accent: 'border-blue-300', bar: 'bg-blue-500',   text: 'text-blue-700' },
  'Enterprise AI':     { border: 'border-violet-200', badge: 'bg-violet-50 text-violet-700', icon: '🤖', bg: 'bg-violet-50', accent: 'border-violet-300', bar: 'bg-violet-500', text: 'text-violet-700' },
  'AI Infrastructure': { border: 'border-amber-200',  badge: 'bg-amber-50 text-amber-700',  icon: '☁️', bg: 'bg-amber-50',  accent: 'border-amber-300', bar: 'bg-amber-500',  text: 'text-amber-700' },
}

const MOMENTUM_META: Record<string, { label: string; icon: string; color: string }> = {
  accelerating: { label: 'Accelerating', icon: '↑',  color: 'text-green-600 bg-green-50 border-green-200' },
  building:     { label: 'Building',     icon: '↗',  color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  steady:       { label: 'Steady',       icon: '→',  color: 'text-blue-600 bg-blue-50 border-blue-200' },
  slowing:      { label: 'Slowing',      icon: '↘',  color: 'text-amber-600 bg-amber-50 border-amber-200' },
  drifting:     { label: 'Drifting',     icon: '↓',  color: 'text-red-600 bg-red-50 border-red-200' },
}

const URGENCY_META: Record<string, { dot: string; label: string }> = {
  high:   { dot: 'bg-red-500',    label: 'High' },
  medium: { dot: 'bg-amber-400',  label: 'Medium' },
  low:    { dot: 'bg-slate-300',  label: 'Low' },
}

const SIGNAL_META: Record<string, { label: string; color: string; icon: string }> = {
  manual_checkin:   { label: 'Check-in',      color: 'bg-[#FEF3EC] text-[#D4622A]',      icon: '✍️' },
  report_generated: { label: 'Report',        color: 'bg-blue-50 text-blue-700',          icon: '📡' },
  task_completed:   { label: 'Task done',     color: 'bg-green-50 text-green-700',        icon: '✅' },
  task_created:     { label: 'Task created',  color: 'bg-[#F5F3EE] text-[#6B6B6B]',      icon: '➕' },
  note_created:     { label: 'Note saved',    color: 'bg-purple-50 text-purple-700',      icon: '📝' },
  chat_session:     { label: 'Chat',          color: 'bg-teal-50 text-teal-700',          icon: '💬' },
  research_done:    { label: 'Research',      color: 'bg-indigo-50 text-indigo-700',      icon: '🔍' },
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ─── Goal Card ────────────────────────────────────────────────────────────────
function GoalCard({ pillar, goal, onChange, saving }: {
  pillar: string; goal: Goal; onChange: (field: keyof Goal, value: string) => void; saving: boolean
}) {
  const colors = PILLAR_COLORS[pillar]
  const daysSince = goal.updated_at
    ? Math.floor((Date.now() - new Date(goal.updated_at).getTime()) / 86400000)
    : null

  return (
    <div className={`bg-white border ${colors.border} rounded-xl overflow-hidden shadow-sm`}>
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[#E3E0D8] bg-[#FAF9F6]">
        <span className="text-base">{colors.icon}</span>
        <span className="text-sm font-semibold text-[#1A1A1A]">{pillar}</span>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>
          {pillar === 'Learning AI' ? 'Cypher · AutoCampus · RED AI' :
           pillar === 'Enterprise AI' ? 'Orchea.ai' : 'TerraNine · MATRIX'}
        </span>
        {saving && <span className="text-xs text-[#9CA3AF]">Saving…</span>}
        {!saving && daysSince !== null && (
          <span className={`text-xs ${daysSince > 30 ? 'text-amber-500' : 'text-[#9CA3AF]'}`}>
            {daysSince === 0 ? 'Updated today' : `Updated ${daysSince}d ago`}
          </span>
        )}
      </div>
      <div className="divide-y divide-[#F5F3EE]">
        {[
          { key: 'goal_statement' as keyof Goal, label: 'Goal', placeholder: `What do you want to achieve with ${pillar}?`, rows: 3 },
          { key: 'success_criteria' as keyof Goal, label: 'Success looks like', placeholder: 'Describe the future state concretely.', rows: 2 },
          { key: 'north_star_metric' as keyof Goal, label: 'North Star Metric', placeholder: 'The one number that tells you it\'s working', rows: 1, mono: true },
          { key: 'constraints_context' as keyof Goal, label: 'Constraints & Context', placeholder: 'Real-world limits, team size, key risks…', rows: 2 },
        ].map(({ key, label, placeholder, rows, mono }) => (
          <div key={key} className="px-5 py-3">
            <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider mb-1.5">{label}</p>
            <textarea
              value={(goal[key] as string) ?? ''}
              onChange={(e) => onChange(key, e.target.value)}
              placeholder={placeholder}
              rows={rows}
              className={`w-full bg-transparent text-sm text-[#374151] placeholder-[#C4BFB5] resize-none focus:outline-none leading-relaxed ${mono ? 'font-mono' : ''}`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Pillar Action Card ───────────────────────────────────────────────────────
function PillarCard({ data, onAddTask }: {
  data: PillarStatus
  onAddTask: (title: string, pillar: string) => Promise<void>
}) {
  const colors = PILLAR_COLORS[data.pillar]
  const momentum = MOMENTUM_META[data.momentum] ?? MOMENTUM_META.steady
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())

  const handleAdd = async (title: string) => {
    setAdding(title)
    await onAddTask(title, data.pillar)
    setAdded((prev) => new Set(prev).add(title))
    setAdding(null)
  }

  return (
    <div className={`bg-white border ${colors.border} rounded-2xl overflow-hidden shadow-sm flex flex-col`}>
      {/* Pillar header */}
      <div className={`px-5 py-4 ${colors.bg} border-b ${colors.accent}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{colors.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#1A1A1A] truncate">{data.pillar}</p>
            <p className={`text-xs px-2 py-0.5 rounded-full border inline-flex items-center gap-1 mt-1 font-medium ${momentum.color}`}>
              <span className="text-base leading-none">{momentum.icon}</span>
              {momentum.label}
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#6B6B6B]">Task completion</span>
            <span className={`text-xs font-semibold ${colors.text}`}>{data.progress_pct}%</span>
          </div>
          <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
            <div
              className={`h-full ${colors.bar} rounded-full transition-all duration-700`}
              style={{ width: `${data.progress_pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Momentum note */}
      <div className="px-5 py-3 border-b border-[#F5F3EE]">
        <p className="text-xs text-[#6B6B6B] leading-relaxed">{data.momentum_note}</p>
      </div>

      {/* Top 3 actions */}
      <div className="flex-1 divide-y divide-[#F5F3EE]">
        {data.actions.slice(0, 3).map((action, i) => {
          const urgency = URGENCY_META[action.urgency] ?? URGENCY_META.medium
          const isAdded = added.has(action.title)
          const isAdding = adding === action.title
          return (
            <div key={i} className="px-5 py-3 flex items-start gap-3 group">
              <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
                <span className="text-xs font-bold text-[#C4BFB5]">{i + 1}</span>
                <span className={`w-2 h-2 rounded-full ${urgency.dot} flex-shrink-0`} title={urgency.label} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A1A1A] leading-snug">{action.title}</p>
                <p className="text-xs text-[#9CA3AF] mt-0.5 leading-relaxed">{action.description}</p>
              </div>
              <button
                onClick={() => handleAdd(action.title)}
                disabled={isAdding || isAdded}
                title={isAdded ? 'Added to Tasks' : 'Add as Task'}
                className={`flex-shrink-0 mt-0.5 flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all ${
                  isAdded
                    ? 'bg-green-50 text-green-600 border-green-200 cursor-default'
                    : 'bg-white border-[#E3E0D8] text-[#6B6B6B] hover:bg-[#D4622A] hover:text-white hover:border-[#D4622A] opacity-0 group-hover:opacity-100'
                }`}
              >
                {isAdding ? (
                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                ) : isAdded ? (
                  <>✓ Added</>
                ) : (
                  <>+ Task</>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Signal Badge ─────────────────────────────────────────────────────────────
function SignalBadge({ type }: { type: string }) {
  const meta = SIGNAL_META[type] ?? { label: type, color: 'bg-[#F5F3EE] text-[#6B6B6B]', icon: '•' }
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
      <span>{meta.icon}</span>{meta.label}
    </span>
  )
}

// ─── Thought Content (hashtags highlighted) ───────────────────────────────────
function renderThoughtContent(content: string): ReactNode[] {
  const parts = content.split(/(#[a-zA-Z0-9_]+)/g)
  return parts.map((part, i) =>
    part.startsWith('#')
      ? <span key={i} className="text-[#D4622A] font-medium">{part}</span>
      : <span key={i}>{part}</span>
  )
}

// ─── Thought Card ──────────────────────────────────────────────────────────────
function ThoughtCard({ thought, onDelete, onHashtagClick }: {
  thought: Thought
  onDelete: (id: string) => void
  onHashtagClick: (tag: string) => void
}) {
  const [hovering, setHovering] = useState(false)
  return (
    <div
      className="group px-4 py-3 flex items-start gap-3"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-wrap break-words">
          {renderThoughtContent(thought.content)}
        </p>
        {thought.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {thought.hashtags.map((tag) => (
              <button
                key={tag}
                onClick={() => onHashtagClick(tag)}
                className="text-xs text-[#D4622A] bg-[#FEF3EC] hover:bg-[#F5D3BC] px-1.5 py-0.5 rounded-full transition-colors"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-[#C4BFB5] whitespace-nowrap">
          {new Date(thought.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
        </span>
        <button
          onClick={() => onDelete(thought.id)}
          title="Delete thought"
          className={`text-[#C4BFB5] hover:text-red-500 transition-opacity ${hovering ? 'opacity-100' : 'opacity-0'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MirrorSection() {
  const [tab, setTab] = useState<MirrorTab>('coach')
  const [goals, setGoals] = useState<Record<string, Goal>>({})
  const [pendingGoals, setPendingGoals] = useState<Record<string, Goal>>({})
  const [savingPillars, setSavingPillars] = useState<Set<string>>(new Set())
  const [signals, setSignals] = useState<Signal[]>([])
  const [checkin, setCheckin] = useState('')
  const [checkinPillar, setCheckinPillar] = useState('')
  const [checkinSaving, setCheckinSaving] = useState(false)
  const [assessment, setAssessment] = useState('')
  const [lastAssessedAt, setLastAssessedAt] = useState<string | null>(null)
  const [assessing, setAssessing] = useState(false)
  const [actions, setActions] = useState<ActionsPayload | null>(null)
  const [actionsLoading, setActionsLoading] = useState(false)
  const [actionsAt, setActionsAt] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [showFullAssessment, setShowFullAssessment] = useState(false)
  const [thoughts, setThoughts] = useState<Thought[]>([])
  const [thoughtDraft, setThoughtDraft] = useState('')
  const [postingThought, setPostingThought] = useState(false)
  const [thoughtFilter, setThoughtFilter] = useState<string | null>(null)
  const [vision, setVision] = useState('')
  const debouncedVision = useDebounce(vision, 1500)
  const visionSaved = useRef(false)

  const loadGoals = useCallback(async () => {
    const res = await fetch('/api/mirror/goals')
    const data: Goal[] = await res.json()
    if (!Array.isArray(data)) return
    const map: Record<string, Goal> = {}
    for (const g of data) map[g.pillar] = g
    setGoals(map)
    setPendingGoals(map)
    if (map['vision']) setVision(map['vision'].goal_statement ?? '')
  }, [])

  const loadSignals = useCallback(async () => {
    const res = await fetch('/api/mirror/signals?limit=60')
    const data = await res.json()
    setSignals(Array.isArray(data) ? data : [])
  }, [])

  const loadThoughts = useCallback(async () => {
    const res = await fetch('/api/mirror/thoughts')
    const data = await res.json()
    setThoughts(Array.isArray(data) ? data : [])
  }, [])

  const loadCached = useCallback(() => {
    try {
      const savedAssessment = localStorage.getItem('mirror_last_assessment')
      if (savedAssessment) {
        const { content, at } = JSON.parse(savedAssessment)
        setAssessment(content); setLastAssessedAt(at)
      }
      const savedActions = localStorage.getItem('mirror_last_actions')
      if (savedActions) {
        const parsed: ActionsPayload = JSON.parse(savedActions)
        if (Array.isArray(parsed?.pillars)) {
          setActions(parsed)
          setActionsAt(parsed.generated_at)
        } else {
          localStorage.removeItem('mirror_last_actions')
        }
      }
    } catch {}
  }, [])

  useEffect(() => { loadGoals(); loadSignals(); loadThoughts(); loadCached() }, [loadGoals, loadSignals, loadThoughts, loadCached])

  useEffect(() => {
    if (!visionSaved.current) { visionSaved.current = true; return }
    fetch('/api/mirror/goals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pillar: 'vision', goal_statement: debouncedVision, success_criteria: '', north_star_metric: '' }),
    })
  }, [debouncedVision])

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const handleGoalChange = (pillar: string, field: keyof Goal, value: string) => {
    setPendingGoals((prev) => ({
      ...prev,
      [pillar]: { ...(prev[pillar] ?? goals[pillar] ?? { pillar, goal_statement: '', success_criteria: '', north_star_metric: '', updated_at: '' }), [field]: value },
    }))
    if (saveTimers.current[pillar]) clearTimeout(saveTimers.current[pillar])
    saveTimers.current[pillar] = setTimeout(async () => {
      setSavingPillars((s) => new Set(s).add(pillar))
      const updated = { ...(pendingGoals[pillar] ?? goals[pillar] ?? {}), [field]: value, pillar }
      await fetch('/api/mirror/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      setGoals((prev) => ({ ...prev, [pillar]: { ...updated, updated_at: new Date().toISOString() } as Goal }))
      setSavingPillars((s) => { const n = new Set(s); n.delete(pillar); return n })
    }, 1500)
  }

  const submitCheckin = async () => {
    if (!checkin.trim()) return
    setCheckinSaving(true)
    await fetch('/api/mirror/signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'manual_checkin', content: checkin.trim(), pillar: checkinPillar || null }),
    })
    setCheckin(''); setCheckinPillar(''); setCheckinSaving(false)
    loadSignals()
  }

  const postThought = async () => {
    const content = thoughtDraft.trim()
    if (!content || content.length > THOUGHT_MAX_LENGTH) return
    setPostingThought(true)
    try {
      const res = await fetch('/api/mirror/thoughts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        const created: Thought = await res.json()
        setThoughts((prev) => [created, ...prev])
        setThoughtDraft('')
      }
    } finally {
      setPostingThought(false)
    }
  }

  const deleteThought = async (id: string) => {
    setThoughts((prev) => prev.filter((t) => t.id !== id))
    await fetch(`/api/mirror/thoughts/${id}`, { method: 'DELETE' })
  }

  const filterByHashtag = (tag: string) => {
    setThoughtFilter((prev) => (prev === tag ? null : tag))
  }

  const runActions = async () => {
    setActionsLoading(true)
    setActions(null)
    try {
      const res = await fetch('/api/mirror/actions', { method: 'POST' })
      const data: ActionsPayload = await res.json()
      if (!res.ok || !Array.isArray(data.pillars)) return
      setActions(data)
      setActionsAt(data.generated_at)
      localStorage.setItem('mirror_last_actions', JSON.stringify(data))
    } finally {
      setActionsLoading(false)
    }
  }

  const runAssessment = async () => {
    setAssessing(true)
    setAssessment('')
    setShowFullAssessment(true)
    let full = ''
    try {
      const res = await fetch('/api/mirror/assess', { method: 'POST' })
      if (!res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        full += chunk
        setAssessment((prev) => prev + chunk)
      }
      const now = new Date().toISOString()
      setLastAssessedAt(now)
      localStorage.setItem('mirror_last_assessment', JSON.stringify({ content: full, at: now }))
    } finally {
      setAssessing(false)
    }
  }

  const runBoth = async () => {
    setActionsLoading(true)
    setActions(null)
    setAssessing(true)
    setAssessment('')
    setRunError(null)

    const runActionsPart = async () => {
      try {
        const actionsRes = await fetch('/api/mirror/actions', { method: 'POST' })
        const actionsData: ActionsPayload & { error?: string } = await actionsRes.json()
        if (actionsRes.ok && Array.isArray(actionsData.pillars)) {
          setActions(actionsData)
          setActionsAt(actionsData.generated_at)
          localStorage.setItem('mirror_last_actions', JSON.stringify(actionsData))
        } else {
          throw new Error(actionsData.error || 'Failed to generate actions')
        }
      } finally {
        setActionsLoading(false)
      }
    }

    const runAssessmentPart = async () => {
      try {
        const res = await fetch('/api/mirror/assess', { method: 'POST' })
        if (!res.body) return
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let full = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          full += chunk
          setAssessment((prev) => prev + chunk)
        }
        const now = new Date().toISOString()
        setLastAssessedAt(now)
        localStorage.setItem('mirror_last_assessment', JSON.stringify({ content: full, at: now }))
      } finally {
        setAssessing(false)
      }
    }

    // Kick off both requests together instead of waiting for actions to
    // finish before starting the assessment stream.
    const results = await Promise.allSettled([runActionsPart(), runAssessmentPart()])
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => (r.reason instanceof Error ? r.reason.message : 'Assessment failed. Please try again.'))
    if (errors.length) setRunError(errors.join(' · '))
  }

  const addTask = async (title: string, pillar: string) => {
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, pillar, status: 'todo', source: 'mirror' }),
    })
  }

  const goalsFilledCount = PILLARS.filter((p) => {
    const g = pendingGoals[p] ?? goals[p]
    return g?.goal_statement?.trim()
  }).length

  const isRunning = actionsLoading || assessing
  const hasData = actions !== null
  const runAt = actionsAt ?? lastAssessedAt

  const allHashtags = Object.entries(
    thoughts.reduce<Record<string, number>>((acc, t) => {
      for (const tag of t.hashtags) acc[tag] = (acc[tag] ?? 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  const visibleThoughts = thoughtFilter
    ? thoughts.filter((t) => t.hashtags.includes(thoughtFilter))
    : thoughts

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#FAF9F6]">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 bg-white border-b border-[#E3E0D8] flex-shrink-0">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">🪞</span>
            <h1 className="text-base font-semibold text-[#1A1A1A]">Strategic Mirror</h1>
            {goalsFilledCount < 3 && (
              <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">
                {goalsFilledCount}/3 pillars defined
              </span>
            )}
          </div>
          <p className="text-xs text-[#9CA3AF] mt-0.5">Define your goals · see where you stand · take action</p>
        </div>
        <button
          onClick={runBoth}
          disabled={isRunning}
          className="flex items-center gap-1.5 bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {isRunning ? (
            <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Analyzing…</>
          ) : (
            <>⚡ Run Assessment</>
          )}
        </button>
      </div>

      {runError && !isRunning && (
        <div className="flex items-center gap-2 px-6 py-2 bg-red-50 border-b border-red-200 text-xs text-red-700 flex-shrink-0">
          <span>⚠️</span>
          <span>{runError}</span>
        </div>
      )}

      {/* Sub-nav */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-[#E3E0D8] bg-white flex-shrink-0">
        {([
          { id: 'coach', label: 'Coach', icon: '🔮', desc: runAt ? `Last run ${new Date(runAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Not yet run' },
          { id: 'intent', label: 'Intent', icon: '🎯', desc: `${goalsFilledCount}/3 pillars` },
          { id: 'signals', label: 'Signals', icon: '📶', desc: `${signals.length} captured` },
          { id: 'thoughts', label: 'Thoughts', icon: '💭', desc: `${thoughts.length} captured` },
        ] as { id: MirrorTab; label: string; icon: string; desc: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
              tab === t.id ? 'bg-[#1A1A1A] text-white font-medium' : 'text-[#6B6B6B] hover:bg-[#F5F3EE] hover:text-[#1A1A1A]'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            <span className={`text-xs ${tab === t.id ? 'text-white/60' : 'text-[#C4BFB5]'}`}>{t.desc}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── COACH TAB ──────────────────────────────────────────── */}
        {tab === 'coach' && (
          <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

            {/* Empty state */}
            {!hasData && !isRunning && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <span className="text-5xl mb-4">🔮</span>
                <h2 className="text-lg font-semibold text-[#1A1A1A] mb-2">Run your first assessment</h2>
                <p className="text-sm text-[#9CA3AF] max-w-sm mb-6">
                  The coach reads your goals, activity signals, task data, and recent reports —
                  then shows you where you stand and the top 3 moves per pillar.
                </p>
                {goalsFilledCount === 0 && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg mb-4">
                    Tip: Define your goals in the Intent tab first for a richer assessment.
                  </p>
                )}
                <button
                  onClick={runBoth}
                  className="bg-[#D4622A] hover:bg-[#C05520] text-white text-sm font-medium py-2.5 px-6 rounded-lg transition-colors"
                >
                  ⚡ Run Assessment
                </button>
              </div>
            )}

            {/* Loading skeleton */}
            {(actionsLoading && !actions) && (
              <div className="space-y-4">
                <div className="h-20 bg-white border border-[#E3E0D8] rounded-2xl animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[0,1,2].map((i) => <div key={i} className="h-72 bg-white border border-[#E3E0D8] rounded-2xl animate-pulse" />)}
                </div>
              </div>
            )}

            {/* Actions content */}
            {actions && (
              <>
                {/* Focus today banner */}
                <div className="bg-[#1A1A1A] rounded-2xl px-6 py-5 flex items-center gap-4">
                  <span className="text-2xl flex-shrink-0">⚡</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Focus Today</p>
                    <p className="text-white font-medium text-sm leading-relaxed">{actions.focus_today}</p>
                  </div>
                  {runAt && (
                    <p className="text-xs text-white/30 flex-shrink-0">
                      {new Date(runAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                    </p>
                  )}
                </div>

                {/* Vision pulse (if set) */}
                {vision && (
                  <div className="bg-white border border-[#E3E0D8] rounded-xl px-5 py-4 flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">🌟</span>
                    <div>
                      <p className="text-xs text-[#9CA3AF] uppercase tracking-wider mb-1">Your Vision</p>
                      <p className="text-sm text-[#374151] leading-relaxed">{vision}</p>
                    </div>
                  </div>
                )}

                {/* Pillar cards */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">Pillar Status & Top Actions</h2>
                    <p className="text-xs text-[#C4BFB5]">Hover an action to add it as a Task</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {actions.pillars.map((pillar) => (
                      <PillarCard key={pillar.pillar} data={pillar} onAddTask={addTask} />
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 px-1">
                  <p className="text-xs text-[#C4BFB5]">Urgency:</p>
                  {Object.entries(URGENCY_META).map(([k, v]) => (
                    <span key={k} className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
                      <span className={`w-2 h-2 rounded-full ${v.dot}`} />{v.label}
                    </span>
                  ))}
                  <p className="ml-4 text-xs text-[#C4BFB5]">Momentum:</p>
                  {Object.entries(MOMENTUM_META).map(([k, v]) => (
                    <span key={k} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${v.color}`}>
                      {v.icon} {v.label}
                    </span>
                  ))}
                </div>

                {/* Full assessment toggle */}
                <div className="border-t border-[#E3E0D8] pt-6">
                  <button
                    onClick={() => setShowFullAssessment((v) => !v)}
                    className="flex items-center gap-2 text-sm text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
                  >
                    <span className={`transition-transform ${showFullAssessment ? 'rotate-90' : ''}`}>▶</span>
                    {showFullAssessment ? 'Hide' : 'Show'} full coaching assessment
                    {lastAssessedAt && !assessing && (
                      <span className="text-xs text-[#C4BFB5]">
                        · {new Date(lastAssessedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                      </span>
                    )}
                  </button>

                  {showFullAssessment && (
                    <div className="mt-4 bg-white border border-[#E3E0D8] rounded-2xl px-8 py-8 shadow-sm">
                      {assessment ? (
                        <ReportDisplay content={assessment} streaming={assessing} />
                      ) : assessing ? (
                        <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
                          <span className="w-4 h-4 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin" />
                          Generating assessment…
                        </div>
                      ) : (
                        <p className="text-sm text-[#9CA3AF]">No assessment yet. Run Assessment to generate one.</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* If no actions but assessment is streaming */}
            {!actions && !actionsLoading && assessing && (
              <div className="bg-white border border-[#E3E0D8] rounded-2xl px-8 py-8 shadow-sm">
                <ReportDisplay content={assessment} streaming={assessing} />
              </div>
            )}
          </div>
        )}

        {/* ── INTENT TAB ─────────────────────────────────────────── */}
        {tab === 'intent' && (
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🌟</span>
                <h2 className="text-sm font-semibold text-[#1A1A1A]">Overall Vision</h2>
                <span className="text-xs text-[#9CA3AF]">Auto-saves</span>
              </div>
              <div className="bg-white border border-[#E3E0D8] rounded-xl px-5 py-4 shadow-sm">
                <textarea
                  value={vision}
                  onChange={(e) => setVision(e.target.value)}
                  placeholder="What is Intellina AI ultimately trying to achieve? Write the vision as if you're describing it 5 years from now."
                  rows={4}
                  className="w-full bg-transparent text-sm text-[#374151] placeholder-[#C4BFB5] resize-none focus:outline-none leading-relaxed"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">Pillar Goals</h2>
                <span className="text-xs text-[#C4BFB5]">Auto-saves as you type</span>
              </div>
              <div className="space-y-5">
                {PILLARS.map((pillar) => {
                  const g = pendingGoals[pillar] ?? goals[pillar] ?? { pillar, goal_statement: '', success_criteria: '', north_star_metric: '', constraints_context: '', updated_at: '' }
                  return (
                    <GoalCard key={pillar} pillar={pillar} goal={g}
                      onChange={(field, value) => handleGoalChange(pillar, field, value)}
                      saving={savingPillars.has(pillar)}
                    />
                  )
                })}
              </div>
            </div>
            {goalsFilledCount === 3 && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3">
                <span className="text-green-600 text-lg">✓</span>
                <div>
                  <p className="text-sm font-medium text-green-800">All 3 pillars defined</p>
                  <p className="text-xs text-green-600 mt-0.5">Run an assessment to see your progress, gaps, and top actions.</p>
                </div>
                <button onClick={runBoth} disabled={isRunning}
                  className="ml-auto text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                  Run Assessment →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── SIGNALS TAB ────────────────────────────────────────── */}
        {tab === 'signals' && (
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
            <div>
              <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">Manual Check-in</h2>
              <div className="bg-white border border-[#E3E0D8] rounded-xl p-4 shadow-sm">
                <textarea
                  value={checkin}
                  onChange={(e) => setCheckin(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitCheckin() }}
                  placeholder="What happened today? What moved? What's blocking you? (⌘+Enter to save)"
                  rows={3}
                  className="w-full bg-transparent text-sm text-[#374151] placeholder-[#C4BFB5] resize-none focus:outline-none leading-relaxed mb-3"
                />
                <div className="flex items-center gap-2">
                  <select value={checkinPillar} onChange={(e) => setCheckinPillar(e.target.value)}
                    className="text-xs text-[#6B6B6B] bg-[#F5F3EE] border border-[#E3E0D8] rounded-lg px-2 py-1.5 focus:outline-none">
                    <option value="">No pillar tag</option>
                    {PILLARS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button onClick={submitCheckin} disabled={!checkin.trim() || checkinSaving}
                    className="ml-auto bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium py-1.5 px-4 rounded-lg transition-colors">
                    {checkinSaving ? 'Saving…' : 'Save signal'}
                  </button>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">Activity Feed</h2>
                <span className="text-xs text-[#C4BFB5]">{signals.length} signals · used in next assessment</span>
              </div>
              {signals.length === 0 ? (
                <div className="bg-white border border-dashed border-[#E3E0D8] rounded-xl p-8 text-center">
                  <p className="text-sm text-[#9CA3AF]">No signals yet.</p>
                  <p className="text-xs text-[#C4BFB5] mt-1">Signals are captured automatically as you use the app.</p>
                </div>
              ) : (
                <div className="bg-white border border-[#E3E0D8] rounded-xl shadow-sm divide-y divide-[#F5F3EE]">
                  {signals.map((s) => (
                    <div key={s.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <SignalBadge type={s.type} />
                          {s.pillar && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${PILLAR_COLORS[s.pillar]?.badge ?? 'bg-[#F5F3EE] text-[#6B6B6B]'}`}>
                              {s.pillar}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#374151] leading-relaxed">{s.content}</p>
                      </div>
                      <span className="text-xs text-[#C4BFB5] flex-shrink-0 mt-0.5">
                        {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-[#C4BFB5] text-center pb-4">
              Signals are automatically captured when you generate reports, complete tasks, save notes, start chats, and run research.
            </p>
          </div>
        )}

        {/* ── THOUGHTS TAB ───────────────────────────────────────── */}
        {tab === 'thoughts' && (
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
            <div>
              <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">New Thought</h2>
              <div className="bg-white border border-[#E3E0D8] rounded-xl p-4 shadow-sm">
                <textarea
                  value={thoughtDraft}
                  onChange={(e) => setThoughtDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postThought() }}
                  placeholder="What's on your mind? Use #hashtags to tag it. (⌘+Enter to post)"
                  rows={3}
                  maxLength={THOUGHT_MAX_LENGTH}
                  className="w-full bg-transparent text-sm text-[#374151] placeholder-[#C4BFB5] resize-none focus:outline-none leading-relaxed mb-3"
                />
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${THOUGHT_MAX_LENGTH - thoughtDraft.length <= 20 ? 'text-amber-500' : 'text-[#C4BFB5]'}`}>
                    {thoughtDraft.length}/{THOUGHT_MAX_LENGTH}
                  </span>
                  <button onClick={postThought} disabled={!thoughtDraft.trim() || postingThought}
                    className="ml-auto bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium py-1.5 px-4 rounded-lg transition-colors">
                    {postingThought ? 'Posting…' : 'Post thought'}
                  </button>
                </div>
              </div>
            </div>

            {allHashtags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[#C4BFB5]">Filter:</span>
                {allHashtags.map(([tag, count]) => (
                  <button
                    key={tag}
                    onClick={() => filterByHashtag(tag)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      thoughtFilter === tag
                        ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                        : 'bg-white text-[#6B6B6B] border-[#E3E0D8] hover:bg-[#F5F3EE]'
                    }`}
                  >
                    #{tag} <span className={thoughtFilter === tag ? 'text-white/60' : 'text-[#C4BFB5]'}>{count}</span>
                  </button>
                ))}
                {thoughtFilter && (
                  <button onClick={() => setThoughtFilter(null)} className="text-xs text-[#9CA3AF] hover:text-[#1A1A1A] underline">
                    Clear filter
                  </button>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
                  {thoughtFilter ? `#${thoughtFilter}` : 'All Thoughts'}
                </h2>
                <span className="text-xs text-[#C4BFB5]">{visibleThoughts.length} · used in next assessment</span>
              </div>
              {visibleThoughts.length === 0 ? (
                <div className="bg-white border border-dashed border-[#E3E0D8] rounded-xl p-8 text-center">
                  <p className="text-sm text-[#9CA3AF]">{thoughtFilter ? `No thoughts tagged #${thoughtFilter}.` : 'No thoughts yet.'}</p>
                  <p className="text-xs text-[#C4BFB5] mt-1">Jot down whatever&apos;s on your mind — it feeds into your next coaching assessment.</p>
                </div>
              ) : (
                <div className="bg-white border border-[#E3E0D8] rounded-xl shadow-sm divide-y divide-[#F5F3EE]">
                  {visibleThoughts.map((t) => (
                    <ThoughtCard key={t.id} thought={t} onDelete={deleteThought} onHashtagClick={filterByHashtag} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
