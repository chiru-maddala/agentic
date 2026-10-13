import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'
import { categoryForType } from '@/lib/signals'
import { computeGoalPacing } from '@/lib/goals'

const PACING_LABEL: Record<string, string> = {
  'no-target': '',
  'no-progress': ' — no progress logged yet',
  ahead: ' — AHEAD OF PACE',
  'on-pace': ' — on pace',
  behind: ' — BEHIND PACE',
  overdue: ' — OVERDUE',
}

export const maxDuration = 120

export type SuggestedAction = {
  title: string
  description: string
  urgency: 'high' | 'medium' | 'low'
}

export type ActionsPayload = {
  focus_today: string
  momentum: 'accelerating' | 'building' | 'steady' | 'slowing' | 'drifting'
  momentum_note: string
  progress_pct: number
  actions: SuggestedAction[]
  generated_at: string
}

export async function POST() {
  try {
    return await generateActions()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate actions'
    return Response.json({ error: message }, { status: 500 })
  }
}

async function generateActions(): Promise<Response> {
  const supabase = getSupabase()

  const [goalsRes, signalsRes, tasksRes, reportsRes, thoughtsRes] = await Promise.all([
    supabase.from('mirror_pillar_goals').select('*').order('created_at'),
    supabase.from('mirror_signals').select('*').order('created_at', { ascending: false }).limit(60),
    supabase.from('tasks').select('title, status, created_at').order('created_at', { ascending: false }),
    supabase.from('reports').select('date, content').order('created_at', { ascending: false }).limit(3),
    supabase.from('mirror_thoughts').select('content, hashtags, created_at').order('created_at', { ascending: false }).limit(30),
  ])

  const goals = goalsRes.data ?? []
  const signals = signalsRes.data ?? []
  const tasks = tasksRes.data ?? []
  const reports = reportsRes.data ?? []
  const thoughts = thoughtsRes.data ?? []

  // Task progress across all K-12 work
  const done = tasks.filter((t) => t.status === 'done').length
  const inProgress = tasks.filter((t) => t.status === 'in-progress').length
  const todo = tasks.filter((t) => t.status === 'todo').length
  const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0

  const goalsContext = goals.length > 0
    ? goals
        .map((g) => {
          const pacing = computeGoalPacing(g)
          return `- ${g.name}: ${g.current_value ?? 0}/${g.target_number ?? '?'} (target: ${g.target_date ?? 'no date set'})${PACING_LABEL[pacing.status]}`
        })
        .join('\n')
    : 'No measurable goals set.'

  const formatSignal = (s: typeof signals[number]) =>
    `[${new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}] [${s.type}] ${s.content}`

  const recentSignals = signals.slice(0, 40)
  const worldSignals = recentSignals.filter((s) => (s.category ?? categoryForType(s.type)) === 'world')
  const actionSignals = recentSignals.filter((s) => (s.category ?? categoryForType(s.type)) === 'action')

  const signalsContext = [
    worldSignals.length > 0 ? `World Signals (external intelligence):\n${worldSignals.map(formatSignal).join('\n')}` : '',
    actionSignals.length > 0 ? `Actions (what Chiru actually did — completions carry more weight than creations):\n${actionSignals.map(formatSignal).join('\n')}` : '',
  ].filter(Boolean).join('\n\n')

  const thoughtsContext = thoughts.length > 0
    ? thoughts.map((t) =>
        `[${new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}] ${t.content}`
      ).join('\n')
    : 'None recorded yet.'

  const openTasks = tasks.filter((t) => t.status !== 'done').slice(0, 8).map((t) => `  - [${t.status}] ${t.title}`).join('\n')
  const taskContext = `${tasks.length} total (${done} done, ${inProgress} in-progress, ${todo} todo)\n${openTasks}`

  const reportHeadings = reports.map((r) => {
    const h = [...r.content.matchAll(/^#{1,2} .+/gm)].map((m) => m[0].replace(/^#{1,2} /, '')).slice(0, 4).join(' · ')
    return `${r.date}: ${h}`
  }).join('\n')

  const prompt = `You are a strategic coach for Chiranjeevi (Chiru), Co-founder & CEO of Intellina AI. His focus is AI Ready School, the company's K-12 offering: Learnia (Morpheus teaching system, NEO student co-pilot, Trinity teacher co-pilot, Zion AI tool suite), K12 Skill Center (on-campus programs and certifications), and Matrix (agentic school management platform).

GOALS:
${goalsContext}

SIGNALS (recent):
${signalsContext || 'None yet.'}

SPONTANEOUS THOUGHTS (recent, raw and unfiltered — often the truest signal of what's actually on his mind):
${thoughtsContext}

TASK STATUS:
${taskContext}

RECENT REPORT TOPICS:
${reportHeadings || 'None yet.'}

TASK PROGRESS:
${pct}% done (${done}/${tasks.length} tasks)

---

Respond with ONLY valid JSON matching this exact schema (no markdown, no explanation):

{
  "focus_today": "The single most important thing Chiru should do today. One crisp sentence.",
  "momentum": "steady",
  "momentum_note": "2 sentences of honest, specific assessment grounded in the signals and tasks.",
  "progress_pct": 35,
  "actions": [
    {
      "title": "Short action title (5-10 words, imperative verb)",
      "description": "1 sentence why this is the highest-leverage move right now",
      "urgency": "high"
    },
    { "title": "...", "description": "...", "urgency": "medium" },
    { "title": "...", "description": "...", "urgency": "low" }
  ]
}

momentum must be one of: accelerating, building, steady, slowing, drifting
urgency must be one of: high, medium, low
progress_pct should reflect actual task completion data, adjusted by recent signal activity
Actions must be specific to the goals and signals — never generic. Name real AI Ready School products, deadlines, or gaps you can see in the data.`

  const client = new Anthropic()
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  // Strip markdown fences, then take the outermost {...} block in case the
  // model added leading/trailing prose around the JSON.
  const fenceStripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const braceMatch = fenceStripped.match(/\{[\s\S]*\}/)
  const json = braceMatch ? braceMatch[0] : fenceStripped

  try {
    const payload: ActionsPayload = { ...JSON.parse(json), generated_at: new Date().toISOString() }
    return Response.json(payload)
  } catch {
    console.error('[mirror/actions] Failed to parse model output', {
      stop_reason: msg.stop_reason,
      raw: raw.length > 2000 ? `${raw.slice(0, 1000)}…[truncated]…${raw.slice(-1000)}` : raw,
    })
    return Response.json({ error: 'Failed to parse actions', raw }, { status: 500 })
  }
}
