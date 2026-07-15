import { getSupabase } from '@/lib/supabase'

export async function PATCH(
  req: Request,
  ctx: RouteContext<'/api/meetings/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const body = await req.json()

  const update: Record<string, unknown> = {}
  if (body.title !== undefined) update.title = body.title
  if (body.meeting_date !== undefined) update.meeting_date = body.meeting_date
  if (body.pillar !== undefined) update.pillar = body.pillar
  if (body.notes !== undefined) update.notes = body.notes
  if (body.goal_id !== undefined) update.goal_id = body.goal_id

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from('meetings').update(update).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  if (Array.isArray(body.person_ids)) {
    const personIds: string[] = body.person_ids
    await supabase.from('meeting_people').delete().eq('meeting_id', id)
    if (personIds.length > 0) {
      const { error: linkError } = await supabase
        .from('meeting_people')
        .insert(personIds.map((person_id) => ({ meeting_id: id, person_id })))
      if (linkError) return Response.json({ error: linkError.message }, { status: 500 })
    }
  }

  return Response.json({ success: true })
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/meetings/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const { error } = await supabase.from('meetings').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
