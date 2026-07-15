import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'

export const maxDuration = 60

type Attendee = { id: string; name: string }

type SuggestedTask = {
  title: string
  description: string
  urgency: 'high' | 'medium' | 'low'
  person_id: string | null
}

export async function POST(
  _req: Request,
  ctx: RouteContext<'/api/meetings/[id]/extract-tasks'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params

  const { data: meeting, error } = await supabase
    .from('meetings')
    .select('*, meeting_people(people(*))')
    .eq('id', id)
    .single()

  if (error || !meeting) return Response.json({ error: error?.message ?? 'Meeting not found' }, { status: 404 })

  const attendees: Attendee[] = (meeting.meeting_people ?? [])
    .map((mp: { people: { id: string; name: string } | null }) => mp.people)
    .filter((p: Attendee | null): p is Attendee => !!p)
    .map((p: Attendee) => ({ id: p.id, name: p.name }))

  if (!meeting.notes || !meeting.notes.trim()) {
    return Response.json({ tasks: [] })
  }

  const attendeeList = attendees.length > 0
    ? attendees.map((a) => `- ${a.name} (id: ${a.id})`).join('\n')
    : 'None recorded.'

  const prompt = `You are helping Chiranjeevi (Chiru), Co-founder & CEO of Intellina AI, extract concrete action items from meeting notes.

Meeting title: ${meeting.title}
Pillar: ${meeting.pillar ?? 'Not tagged'}
Attendees:
${attendeeList}

Notes:
${meeting.notes}

Extract only concrete, actionable follow-ups clearly implied by the notes. Do not invent tasks that aren't grounded in the notes. If the notes mention an attendee by name doing something, set person_id to that attendee's id from the list above; otherwise set person_id to null. If nothing actionable is in the notes, return an empty array.

Respond with ONLY this JSON shape, no prose, no markdown fences:
{
  "tasks": [
    { "title": "...", "description": "...", "urgency": "high", "person_id": null }
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
    const attendeeIds = new Set(attendees.map((a) => a.id))
    tasks = tasks.map((t) => ({
      ...t,
      person_id: t.person_id && attendeeIds.has(t.person_id) ? t.person_id : null,
    }))
  } catch {
    console.error('[meetings/extract-tasks] Failed to parse model output', {
      stop_reason: msg.stop_reason,
      raw: raw.length > 2000 ? `${raw.slice(0, 1000)}…[truncated]…${raw.slice(-1000)}` : raw,
    })
    return Response.json({ error: 'Failed to parse suggested tasks' }, { status: 500 })
  }

  const { error: updateError } = await supabase
    .from('meetings')
    .update({ suggested_tasks: tasks })
    .eq('id', id)
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 })

  return Response.json({ tasks })
}
