import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'

export const maxDuration = 300

export async function POST() {
  const supabase = getSupabase()

  // Fetch all context in parallel
  const [goalsRes, signalsRes, tasksRes, reportsRes] = await Promise.all([
    supabase.from('mirror_goals').select('*'),
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
  ])

  const goals = goalsRes.data ?? []
  const signals = signalsRes.data ?? []
  const tasks = tasksRes.data ?? []
  const reports = reportsRes.data ?? []

  // Goals context
  const goalsContext =
    goals.length > 0
      ? goals
          .map(
            (g) =>
              `**${g.pillar}**\nGoal: ${g.goal_statement || '(not set)'}\nSuccess looks like: ${g.success_criteria || '(not set)'}\nNorth Star Metric: ${g.north_star_metric || '(not set)'}`
          )
          .join('\n\n')
      : 'No goals defined yet.'

  // Signals context
  const signalsContext =
    signals.length > 0
      ? signals
          .map(
            (s) =>
              `[${new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}] [${s.type}]${s.pillar ? ` [${s.pillar}]` : ''} ${s.content}`
          )
          .join('\n')
      : 'No signals recorded yet.'

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

If goals are not yet defined, work from the activity signals to infer what Chiru seems to be prioritising, and note explicitly that the goals need to be set.`

  const userPrompt = `Here is the full context for this assessment:

## STATED GOALS
${goalsContext}

## ACTIVITY SIGNALS (recent, most recent first)
${signalsContext}

## TASK HEALTH BY PILLAR
${taskSummary}

## ACTIVE TASKS (not yet done)
${recentTasks || 'None.'}

## RECENT INTELLIGENCE REPORT TOPICS
${reportContext}

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
