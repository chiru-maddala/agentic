import { getSupabase } from '@/lib/supabase'

export async function PATCH(
  req: Request,
  ctx: RouteContext<'/api/mirror/pillar-goals/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const body = await req.json()

  const update: Record<string, unknown> = {}
  if (body.name !== undefined) update.name = body.name
  if (body.target_number !== undefined) update.target_number = body.target_number
  if (body.target_date !== undefined) update.target_date = body.target_date

  const { error } = await supabase.from('mirror_pillar_goals').update(update).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/mirror/pillar-goals/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const { error } = await supabase.from('mirror_pillar_goals').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
