import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'

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

  const [goalsRes, signalsRes, tasksRes, reportsRes] = await Promise.all([
    supabase.from('mirror_goals').select('*'),
    supabase.from('mirror_signals').select('*').order('created_at', { ascending: false }).limit(60),
    supabase.from('tasks').select('title, status, pillar, created_at').order('created_at', { ascending: false }),
    supabase.from('reports').select('date, content').order('created_at', { ascending: false }).limit(3),
  ])

  const goals = goalsRes.data ?? []
  const signals = signalsRes.data ?? []
  const tasks = tasksRes.data ?? []
  const reports = reportsRes.data ?? []

  const PILLARS = ['Learning AI', 'Enterprise AI', 'AI Infrastructure']

  // Compute task progress per pillar
  const taskStats = PILLARS.map((p) => {
    const pt = tasks.filter((t) => t.pillar === p)
    const done = pt.filter((t) => t.status === 'done').length
    const total = pt.length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return { pillar: p, done, inProgress: pt.filter((t) => t.status === 'in-progress').length, todo: pt.filter((t) => t.status === 'todo').length, total, pct }
  })

  const goalsMap = Object.fromEntries(goals.map((g) => [g.pillar, g]))
  const vision = goalsMap['vision']?.goal_statement ?? ''

  const goalsContext = PILLARS.map((p) => {
    const g = goalsMap[p]
    if (!g) return `**${p}**: No goal defined.`
    return `**${p}**\nGoal: ${g.goal_statement || '(not set)'}\nSuccess: ${g.success_criteria || '(not set)'}\nNorth Star: ${g.north_star_metric || '(not set)'}\nConstraints: ${g.constraints_context || '(not set)'}`
  }).join('\n\n')

  const signalsContext = signals.slice(0, 40).map((s) =>
    `[${new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}] [${s.type}]${s.pillar ? ` [${s.pillar}]` : ''} ${s.content}`
  ).join('\n')

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

Vision: ${vision || '(not set)'}

GOALS:
${goalsContext}

ACTIVITY SIGNALS (recent):
${signalsContext || 'None yet.'}

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
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  // Strip markdown fences if present
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  try {
    const payload: ActionsPayload = { ...JSON.parse(json), generated_at: new Date().toISOString() }
    return Response.json(payload)
  } catch {
    return Response.json({ error: 'Failed to parse actions', raw }, { status: 500 })
  }
}
