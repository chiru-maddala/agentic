'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReportDisplay from './ReportDisplay'

type MirrorTab = 'intent' | 'coach' | 'signals'

type Goal = {
  pillar: string
  goal_statement: string
  success_criteria: string
  north_star_metric: string
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

const PILLAR_COLORS: Record<string, { border: string; badge: string; icon: string }> = {
  'Learning AI':       { border: 'border-blue-200',   badge: 'bg-blue-50 text-blue-700',   icon: '📚' },
  'Enterprise AI':     { border: 'border-violet-200', badge: 'bg-violet-50 text-violet-700', icon: '🤖' },
  'AI Infrastructure': { border: 'border-amber-200',  badge: 'bg-amber-50 text-amber-700',  icon: '☁️' },
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
function GoalCard({
  pillar,
  goal,
  onChange,
  saving,
}: {
  pillar: string
  goal: Goal
  onChange: (field: keyof Goal, value: string) => void
  saving: boolean
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
        <Field
          label="Goal"
          placeholder={`What do you want to achieve with ${pillar}? Be specific — what does winning look like in 12 months?`}
          value={goal.goal_statement}
          onChange={(v) => onChange('goal_statement', v)}
          rows={3}
        />
        <Field
          label="Success looks like"
          placeholder="Describe the future state concretely. What would you see, hear, or measure if this goal were fully achieved?"
          value={goal.success_criteria}
          onChange={(v) => onChange('success_criteria', v)}
          rows={2}
        />
        <Field
          label="North Star Metric"
          placeholder="The one number that tells you it's working (e.g. '500 paying schools', '10 enterprise customers', '3 contracts signed')"
          value={goal.north_star_metric}
          onChange={(v) => onChange('north_star_metric', v)}
          rows={1}
          mono
        />
      </div>
    </div>
  )
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  rows,
  mono,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  rows: number
  mono?: boolean
}) {
  return (
    <div className="px-5 py-3">
      <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider mb-1.5">{label}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full bg-transparent text-sm text-[#374151] placeholder-[#C4BFB5] resize-none focus:outline-none leading-relaxed ${mono ? 'font-mono' : ''}`}
      />
    </div>
  )
}

// ─── Signals Feed ─────────────────────────────────────────────────────────────
function SignalBadge({ type }: { type: string }) {
  const meta = SIGNAL_META[type] ?? { label: type, color: 'bg-[#F5F3EE] text-[#6B6B6B]', icon: '•' }
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
      <span>{meta.icon}</span>
      {meta.label}
    </span>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function MirrorSection() {
  const [tab, setTab] = useState<MirrorTab>('intent')
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

  // Vision (stored as 'vision' pillar)
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

  const loadLastAssessment = useCallback(async () => {
    // We don't have a dedicated endpoint, but we can check via a simple workaround:
    // Try to load the latest assessment from the assess API's saved output
    // For now we track it in local state across sessions via localStorage
    const saved = localStorage.getItem('mirror_last_assessment')
    if (saved) {
      try {
        const { content, at } = JSON.parse(saved)
        setAssessment(content)
        setLastAssessedAt(at)
      } catch {}
    }
  }, [])

  useEffect(() => {
    loadGoals()
    loadSignals()
    loadLastAssessment()
  }, [loadGoals, loadSignals, loadLastAssessment])

  // Auto-save vision
  useEffect(() => {
    if (!visionSaved.current) { visionSaved.current = true; return }
    fetch('/api/mirror/goals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pillar: 'vision', goal_statement: debouncedVision, success_criteria: '', north_star_metric: '' }),
    })
  }, [debouncedVision])

  // Auto-save pillar goals with debounce
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
    setCheckin('')
    setCheckinPillar('')
    setCheckinSaving(false)
    loadSignals()
  }

  const runAssessment = async () => {
    setAssessing(true)
    setAssessment('')
    setTab('coach')
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

  const goalsFilledCount = PILLARS.filter((p) => {
    const g = pendingGoals[p] ?? goals[p]
    return g?.goal_statement?.trim()
  }).length

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
          <p className="text-xs text-[#9CA3AF] mt-0.5">Define your goals · run an assessment · track your momentum</p>
        </div>
        <button
          onClick={runAssessment}
          disabled={assessing}
          className="flex items-center gap-1.5 bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {assessing ? (
            <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Assessing…</>
          ) : (
            <>🔮 Run Assessment</>
          )}
        </button>
      </div>

      {/* Sub-nav */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-[#E3E0D8] bg-white flex-shrink-0">
        {([
          { id: 'intent', label: 'Intent', icon: '🎯', desc: 'Your goals' },
          { id: 'coach', label: 'Coach', icon: '🔮', desc: lastAssessedAt ? `Last run ${new Date(lastAssessedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Not yet run' },
          { id: 'signals', label: 'Signals', icon: '📶', desc: `${signals.length} captured` },
        ] as { id: MirrorTab; label: string; icon: string; desc: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
              tab === t.id
                ? 'bg-[#1A1A1A] text-white font-medium'
                : 'text-[#6B6B6B] hover:bg-[#F5F3EE] hover:text-[#1A1A1A]'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            <span className={`text-xs ${tab === t.id ? 'text-white/60' : 'text-[#C4BFB5]'}`}>{t.desc}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── INTENT TAB ─────────────────────────────────────────── */}
        {tab === 'intent' && (
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

            {/* Vision */}
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
                  placeholder="What is Intellina AI ultimately trying to achieve? Write the vision as if you're describing it 5 years from now — what does the world look like because Intellina exists?"
                  rows={4}
                  className="w-full bg-transparent text-sm text-[#374151] placeholder-[#C4BFB5] resize-none focus:outline-none leading-relaxed"
                />
              </div>
            </div>

            {/* Pillar goals */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">Pillar Goals</h2>
                <span className="text-xs text-[#C4BFB5]">Auto-saves as you type</span>
              </div>
              <div className="space-y-5">
                {PILLARS.map((pillar) => {
                  const g = pendingGoals[pillar] ?? goals[pillar] ?? { pillar, goal_statement: '', success_criteria: '', north_star_metric: '', updated_at: '' }
                  return (
                    <GoalCard
                      key={pillar}
                      pillar={pillar}
                      goal={g}
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
                  <p className="text-xs text-green-600 mt-0.5">
                    Run an assessment to see your progress, gaps, and what to focus on.
                  </p>
                </div>
                <button
                  onClick={runAssessment}
                  disabled={assessing}
                  className="ml-auto text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  Run Assessment →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── COACH TAB ──────────────────────────────────────────── */}
        {tab === 'coach' && (
          <div className="max-w-3xl mx-auto px-6 py-8">
            {!assessment && !assessing ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <span className="text-5xl mb-4">🔮</span>
                <h2 className="text-lg font-semibold text-[#1A1A1A] mb-2">No assessment yet</h2>
                <p className="text-sm text-[#9CA3AF] max-w-xs mb-6">
                  The coach reads your goals, activity signals, tasks, and recent reports — then tells you where you're making progress, where you're drifting, and what to focus on.
                </p>
                {goalsFilledCount === 0 && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg mb-4">
                    Tip: Define your goals in the Intent tab first for a richer assessment. The coach can also work from your activity alone.
                  </p>
                )}
                <button
                  onClick={runAssessment}
                  className="bg-[#D4622A] hover:bg-[#C05520] text-white text-sm font-medium py-2.5 px-6 rounded-lg transition-colors"
                >
                  🔮 Run my first assessment
                </button>
              </div>
            ) : (
              <div>
                {lastAssessedAt && !assessing && (
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-xs text-[#9CA3AF]">
                      Assessment from {new Date(lastAssessedAt).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                    </p>
                    <button
                      onClick={runAssessment}
                      className="text-xs text-[#D4622A] hover:underline"
                    >
                      Run again →
                    </button>
                  </div>
                )}
                <div className="bg-white border border-[#E3E0D8] rounded-2xl px-8 py-8 shadow-sm">
                  <ReportDisplay content={assessment} streaming={assessing} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SIGNALS TAB ────────────────────────────────────────── */}
        {tab === 'signals' && (
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

            {/* Manual check-in */}
            <div>
              <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">Manual Check-in</h2>
              <div className="bg-white border border-[#E3E0D8] rounded-xl p-4 shadow-sm">
                <textarea
                  value={checkin}
                  onChange={(e) => setCheckin(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitCheckin() }}
                  placeholder="What happened today? What moved? What's blocking you? What surprised you? (⌘+Enter to save)"
                  rows={3}
                  className="w-full bg-transparent text-sm text-[#374151] placeholder-[#C4BFB5] resize-none focus:outline-none leading-relaxed mb-3"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={checkinPillar}
                    onChange={(e) => setCheckinPillar(e.target.value)}
                    className="text-xs text-[#6B6B6B] bg-[#F5F3EE] border border-[#E3E0D8] rounded-lg px-2 py-1.5 focus:outline-none"
                  >
                    <option value="">No pillar tag</option>
                    {PILLARS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button
                    onClick={submitCheckin}
                    disabled={!checkin.trim() || checkinSaving}
                    className="ml-auto bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium py-1.5 px-4 rounded-lg transition-colors"
                  >
                    {checkinSaving ? 'Saving…' : 'Save signal'}
                  </button>
                </div>
              </div>
            </div>

            {/* Signal feed */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">Activity Feed</h2>
                <span className="text-xs text-[#C4BFB5]">{signals.length} signals · used in next assessment</span>
              </div>

              {signals.length === 0 ? (
                <div className="bg-white border border-dashed border-[#E3E0D8] rounded-xl p-8 text-center">
                  <p className="text-sm text-[#9CA3AF]">No signals yet.</p>
                  <p className="text-xs text-[#C4BFB5] mt-1">Signals are captured automatically as you use the app, or you can add them manually above.</p>
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
      </div>
    </div>
  )
}
