import { getSupabase } from '@/lib/supabase'
import { categoryForType } from '@/lib/signals'

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('meetings')
    .select('*, meeting_people(people(*))')
    .order('meeting_date', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: Request) {
  const supabase = getSupabase()
  const body = await req.json()
  const personIds: string[] = Array.isArray(body.person_ids) ? body.person_ids : []

  const { data: meeting, error } = await supabase
    .from('meetings')
    .insert({
      title: body.title,
      meeting_date: body.meeting_date,
      pillar: body.pillar ?? null,
      notes: body.notes ?? null,
      goal_id: body.goal_id ?? null,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (personIds.length > 0) {
    const { error: linkError } = await supabase
      .from('meeting_people')
      .insert(personIds.map((person_id) => ({ meeting_id: meeting.id, person_id })))
    if (linkError) return Response.json({ error: linkError.message }, { status: 500 })
  }

  void Promise.resolve(supabase.from('mirror_signals').insert({
    type: 'meeting_added',
    category: categoryForType('meeting_added'),
    content: `Logged meeting: "${meeting.title}"`,
    pillar: meeting.pillar ?? null,
    metadata: { meeting_id: meeting.id, person_ids: personIds },
  })).catch(() => {})

  const { data: full } = await supabase
    .from('meetings')
    .select('*, meeting_people(people(*))')
    .eq('id', meeting.id)
    .single()

  return Response.json(full ?? meeting)
}
