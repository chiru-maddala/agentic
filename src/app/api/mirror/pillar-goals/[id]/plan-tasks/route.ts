import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'

export const maxDuration = 60

type SuggestedTask = {
  title: string
  description: string
  urgency: 'high' | 'medium' | 'low'
}

export async function POST(
  _req: Request,
  ctx: RouteContext<'/api/mirror/pillar-goals/[id]/plan-tasks'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params

  const { data: goal, error } = await supabase
    .from('mirror_pillar_goals')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !goal) return Response.json({ error: error?.message ?? 'Goal not found' }, { status: 404 })
  if (!goal.plan_approved_at) return Response.json({ error: 'Approve the plan before extracting tasks' }, { status: 400 })

  const { data: existingTasks } = await supabase
    .from('tasks')
    .select('title')
    .eq('goal_id', id)
  const existingTitles = (existingTasks ?? []).map((t) => `- ${t.title}`).join('\n') || 'None yet.'

  const prompt = `You are helping Chiranjeevi (Chiru), Co-founder & CEO of Intellina AI, turn an approved goal plan into concrete next-step tasks.

Goal: ${goal.name}
Pillar: ${goal.pillar}
Target: ${goal.target_number ?? 'not set'} by ${goal.target_date ?? 'not set'}
Current progress: ${goal.current_value ?? 'not logged yet'}

Approved plan document (HTML):
${goal.plan_document}

Tasks already created for this goal (do not duplicate these):
${existingTitles}

Extract 3-8 concrete, actionable tasks directly grounded in the plan document above. Do not invent anything not implied by the plan.

Respond with ONLY this JSON shape, no prose, no markdown fences:
{
  "tasks": [
    { "title": "...", "description": "...", "urgency": "high" }
  ]
}

urgency must be one of: high, medium, low`

  const client = new Anthropic()
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const fenceStripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const braceMatch = fenceStripped.match(/\{[\s\S]*\}/)
  const json = braceMatch ? braceMatch[0] : fenceStripped

  let tasks: SuggestedTask[] = []
  try {
    const parsed = JSON.parse(json)
    tasks = Array.isArray(parsed.tasks) ? parsed.tasks : []
  } catch {
    console.error('[pillar-goals/plan-tasks] Failed to parse model output', {
      stop_reason: msg.stop_reason,
      raw: raw.length > 2000 ? `${raw.slice(0, 1000)}…[truncated]…${raw.slice(-1000)}` : raw,
    })
    return Response.json({ error: 'Failed to parse suggested tasks' }, { status: 500 })
  }

  const { error: updateError } = await supabase
    .from('mirror_pillar_goals')
    .update({ suggested_plan: tasks })
    .eq('id', id)
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 })

  return Response.json({ tasks })
}
