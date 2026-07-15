import { getSupabase } from '@/lib/supabase'

export async function PATCH(
  req: Request,
  ctx: RouteContext<'/api/people/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const body = await req.json()

  const update: Record<string, unknown> = {}
  if (body.name !== undefined) update.name = body.name
  if (body.type !== undefined) update.type = body.type
  if (body.role !== undefined) update.role = body.role
  if (body.company !== undefined) update.company = body.company
  if (body.email !== undefined) update.email = body.email
  if (body.primary_pillar !== undefined) update.primary_pillar = body.primary_pillar
  if (body.notes !== undefined) update.notes = body.notes
  if (body.status_note !== undefined) {
    update.status_note = body.status_note
    update.status_updated_at = new Date().toISOString()
  }

  const { error } = await supabase.from('people').update(update).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/people/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const { error } = await supabase.from('people').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
