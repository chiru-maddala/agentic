import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'
import { categoryForType } from '@/lib/signals'

export const maxDuration = 300

export async function POST() {
  try {
    return await generateAssessment()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate assessment'
    return new Response(`⚠️ Assessment error: ${message}`, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

async function generateAssessment(): Promise<Response> {
  const supabase = getSupabase()

  // Fetch all context in parallel
  const [goalsRes, signalsRes, tasksRes, reportsRes, thoughtsRes] = await Promise.all([
    supabase.from('mirror_pillar_goals').select('*').order('pillar').order('created_at'),
    supabase
      .from('mirror_signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('tasks')
      .select('title, status, pillar, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('reports')
      .select('date, content')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('mirror_thoughts')
      .select('content, hashtags, created_at')
      .order('created_at', { ascending: false })
      .limit(40),
  ])

  const goals = goalsRes.data ?? []
  const signals = signalsRes.data ?? []
  const tasks = tasksRes.data ?? []
  const reports = reportsRes.data ?? []
  const thoughts = thoughtsRes.data ?? []

  // Goals context — structured measurable goals per pillar (Name, Target Number, Target Date)
  const GOAL_PILLARS = ['Learning AI', 'Enterprise AI', 'AI Infrastructure']
  const goalsContext = GOAL_PILLARS.map((p) => {
    const pillarGoals = goals.filter((g) => g.pillar === p)
    if (pillarGoals.length === 0) return `**${p}**: No measurable goals set.`
    const lines = pillarGoals
      .map((g) => `- ${g.name} (target: ${g.target_number ?? '?'} by ${g.target_date ?? 'no date set'})`)
      .join('\n')
    return `**${p}**\n${lines}`
  }).join('\n\n')

  // Signals context
  // World Signals = external intelligence (reports, research) — what's happening
  // outside Intellina that's relevant to it.
  // Actions = evidence of what Chiru actually did (check-ins, tasks, notes, chats).
  const category = (s: typeof signals[number]) => s.category ?? categoryForType(s.type)
  const worldSignals = signals.filter((s) => category(s) === 'world')
  const actionSignals = signals.filter((s) => category(s) === 'action')
  const chatInsights = actionSignals.filter((s) => s.type === 'chat_insight')
  const otherActions = actionSignals.filter((s) => s.type !== 'chat_insight')

  const formatSignal = (s: typeof signals[number]) =>
    `[${new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}]${s.pillar ? ` [${s.pillar}]` : ''} ${s.content}`

  const signalsContext = [
    worldSignals.length > 0
      ? `### World Signals (external intelligence — reports & research)\n${worldSignals.map(formatSignal).join('\n')}`
      : '',
    chatInsights.length > 0
      ? `### Actions — CEO's Own Words (from Chat Sessions)\n${chatInsights.map(formatSignal).join('\n')}`
      : '',
    otherActions.length > 0
      ? `### Actions — Activity Log (check-ins, tasks, notes)\n${otherActions.map(formatSignal).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n') || 'No signals recorded yet.'

  // Thoughts context — raw, unstructured, in-the-moment notes with hashtags
  const thoughtsContext = thoughts.length > 0
    ? thoughts.map((t) =>
        `[${new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}] ${t.content}`
      ).join('\n')
    : 'None recorded yet.'

  // Task health
  const PILLARS = ['Learning AI', 'Enterprise AI', 'AI Infrastructure']
  const taskSummary = PILLARS.map((p) => {
    const pt = tasks.filter((t) => t.pillar === p)
    const done = pt.filter((t) => t.status === 'done').length
    const inProgress = pt.filter((t) => t.status === 'in-progress').length
    const todo = pt.filter((t) => t.status === 'todo').length
    return `${p}: ${pt.length} total (${done} done, ${inProgress} in-progress, ${todo} todo)`
  }).join('\n')

  const recentTasks = tasks
    .filter((t) => t.status !== 'done')
    .slice(0, 10)
    .map((t) => `- [${t.status}] ${t.title} (${t.pillar})`)
    .join('\n')

  // Report topics
  const reportContext =
    reports.length > 0
      ? reports
          .map((r, i) => {
            const headings = [...r.content.matchAll(/^#{1,2} .+/gm)]
              .map((m) => m[0].replace(/^#{1,2} /, ''))
              .slice(0, 4)
              .join(' · ')
            return `Report ${i + 1} (${r.date}): ${headings}`
          })
          .join('\n')
      : 'No reports generated yet.'

  const systemPrompt = `You are a strategic coach and trusted advisor for Chiranjeevi (Chiru), Co-founder & CEO of Intellina AI. You have been watching closely — you know his goals, you've seen his activity, and you have full context on the company's three pillars: Learning AI, Enterprise AI, and AI Infrastructure.

Your job is to give an honest, specific, and actionable coaching assessment. Not a summary — a mirror. Name what you see. Call out the gaps without being harsh. Point to the highest-leverage moves. Ground every observation in the actual signals and data you have — never be vague, never be generic.

You have two categories of signals, plus Thoughts:
- **World Signals**: External intelligence auto-extracted from daily research reports and research runs, tagged by pillar where relevant. These represent what's happening in the world outside Intellina — market moves, competitor activity, trends — not anything Chiru did himself.
- **Actions**: Evidence of what Chiru actually did — manual check-ins, tasks created and completed, notes saved, and things he said in chat sessions ("CEO's Own Words"). Within Actions, weigh **completions more heavily than creations**: creating a task signals intent and direction, but completing one is real, executed progress. A pillar with many tasks created and few completed is not "active" — it's stalled.
- **Thoughts**: Short, spontaneous, unfiltered notes Chiru jots down in the moment — often tagged with hashtags. These are raw and unstructured, but they capture things he wouldn't otherwise write down: reactions, half-formed ideas, frustrations, sparks of interest. Treat these as high-signal, low-polish — the rawest window into what's actually on his mind day to day.

Use all of these in combination. Pay special attention to what Chiru says in his own words from chat and in his thoughts — it often reveals priorities, anxieties, or opportunities that don't appear anywhere else. When you spot a gap between what the World Signals are indicating (an opportunity, a threat, a trend) and what the Actions show, name it explicitly. That gap is where the coaching is.

If goals are not yet defined, work from the Actions to infer what Chiru seems to be prioritising, and note explicitly that the goals need to be set.`

  const userPrompt = `Here is the full context for this assessment:

## STATED GOALS
${goalsContext}

## SIGNALS (recent, most recent first)
${signalsContext}

## SPONTANEOUS THOUGHTS (recent, most recent first)
${thoughtsContext}

## TASK HEALTH BY PILLAR
${taskSummary}

## ACTIVE TASKS (not yet done)
${recentTasks || 'None.'}

---

Generate a Strategic Mirror Assessment. Use this exact structure:

### 🎯 Overall Momentum
2–3 sentences on the overall trajectory. Is progress accelerating, coasting, or drifting? Be direct.

### 📊 Pillar Health
For each pillar, give:
- A momentum signal: **↑ Accelerating** | **↗ Building** | **→ Steady** | **↘ Slowing** | **↓ Drifting**
- 2–3 sentences of honest assessment grounded in the signals and tasks above
- The single most important thing happening (or not happening) in this pillar right now

### 🔍 Gaps & Blind Spots
3–5 specific, named gaps between stated goals and observed activity. Each gap must cite evidence — a signal, a task pattern, or an absence. Be honest. What is being said but not done? What is important but getting no attention?

### 🚀 Top 3 Recommendations
The 3 highest-leverage moves right now. Specific and actionable. Ordered by urgency.

### ⚡ Focus for Today
The single most important thing Chiru should work on today to make meaningful progress. One sentence. No hedging.

### 💡 Coach's Observation
One candid observation Chiru might not be seeing himself — a pattern, a risk, or a hidden opportunity in the signals. This is the thing a good advisor would say privately over coffee.`

  const client = new Anthropic()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = ''
      try {
        const anthropicStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 3000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        })

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            fullContent += chunk.delta.text
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }

        if (fullContent) {
          await supabase
            .from('mirror_assessments')
            .insert({ content: fullContent })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        controller.enqueue(encoder.encode(`\n\n⚠️ Assessment error: ${msg}`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
