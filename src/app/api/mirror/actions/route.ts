import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'
import { categoryForType } from '@/lib/signals'

export const maxDuration = 120

export type PillarAction = {
  title: string
  description: string
  urgency: 'high' | 'medium' | 'low'
  pillar: string
}

export type PillarStatus = {
  pillar: string
  momentum: 'accelerating' | 'building' | 'steady' | 'slowing' | 'drifting'
  momentum_note: string
  progress_pct: number
  actions: PillarAction[]
}

export type ActionsPayload = {
  focus_today: string
  pillars: PillarStatus[]
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
    supabase.from('mirror_pillar_goals').select('*').order('pillar').order('created_at'),
    supabase.from('mirror_signals').select('*').order('created_at', { ascending: false }).limit(60),
    supabase.from('tasks').select('title, status, pillar, created_at').order('created_at', { ascending: false }),
    supabase.from('reports').select('date, content').order('created_at', { ascending: false }).limit(3),
    supabase.from('mirror_thoughts').select('content, hashtags, created_at').order('created_at', { ascending: false }).limit(30),
  ])

  const goals = goalsRes.data ?? []
  const signals = signalsRes.data ?? []
  const tasks = tasksRes.data ?? []
  const reports = reportsRes.data ?? []
  const thoughts = thoughtsRes.data ?? []

  const PILLARS = ['Learning AI', 'Enterprise AI', 'AI Infrastructure']

  // Compute task progress per pillar
  const taskStats = PILLARS.map((p) => {
    const pt = tasks.filter((t) => t.pillar === p)
    const done = pt.filter((t) => t.status === 'done').length
    const total = pt.length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return { pillar: p, done, inProgress: pt.filter((t) => t.status === 'in-progress').length, todo: pt.filter((t) => t.status === 'todo').length, total, pct }
  })

  const goalsContext = PILLARS.map((p) => {
    const pillarGoals = goals.filter((g) => g.pillar === p)
    if (pillarGoals.length === 0) return `**${p}**: No measurable goals set.`
    const lines = pillarGoals
      .map((g) => `- ${g.name} (target: ${g.target_number ?? '?'} by ${g.target_date ?? 'no date set'})`)
      .join('\n')
    return `**${p}**\n${lines}`
  }).join('\n\n')

  const formatSignal = (s: typeof signals[number]) =>
    `[${new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}] [${s.type}]${s.pillar ? ` [${s.pillar}]` : ''} ${s.content}`

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

  const taskContext = PILLARS.map((p) => {
    const s = taskStats.find((t) => t.pillar === p)!
    const open = tasks.filter((t) => t.pillar === p && t.status !== 'done').slice(0, 5).map((t) => `  - [${t.status}] ${t.title}`).join('\n')
    return `${p}: ${s.total} total (${s.done} done, ${s.inProgress} in-progress, ${s.todo} todo)\n${open}`
  }).join('\n\n')

  const reportHeadings = reports.map((r) => {
    const h = [...r.content.matchAll(/^#{1,2} .+/gm)].map((m) => m[0].replace(/^#{1,2} /, '')).slice(0, 4).join(' · ')
    return `${r.date}: ${h}`
  }).join('\n')

  const prompt = `You are a strategic coach for Chiranjeevi (Chiru), Co-founder & CEO of Intellina AI.

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
${taskStats.map((s) => `${s.pillar}: ${s.pct}% done (${s.done}/${s.total} tasks)`).join('\n')}

---

Respond with ONLY valid JSON matching this exact schema (no markdown, no explanation):

{
  "focus_today": "The single most important thing Chiru should do today. One crisp sentence.",
  "pillars": [
    {
      "pillar": "Learning AI",
      "momentum": "steady",
      "momentum_note": "2 sentences of honest, specific assessment grounded in the signals and tasks.",
      "progress_pct": 35,
      "actions": [
        {
          "title": "Short action title (5-10 words, imperative verb)",
          "description": "1 sentence why this is the highest-leverage move right now",
          "urgency": "high",
          "pillar": "Learning AI"
        },
        { "title": "...", "description": "...", "urgency": "medium", "pillar": "Learning AI" },
        { "title": "...", "description": "...", "urgency": "low", "pillar": "Learning AI" }
      ]
    },
    {
      "pillar": "Enterprise AI",
      "momentum": "...",
      "momentum_note": "...",
      "progress_pct": 0,
      "actions": [...]
    },
    {
      "pillar": "AI Infrastructure",
      "momentum": "...",
      "momentum_note": "...",
      "progress_pct": 0,
      "actions": [...]
    }
  ]
}

momentum must be one of: accelerating, building, steady, slowing, drifting
urgency must be one of: high, medium, low
progress_pct should reflect actual task completion data, adjusted by recent signal activity
Actions must be specific to the goals and signals — never generic. Name real products, deadlines, or gaps you can see in the data.`

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
