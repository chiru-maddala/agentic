import { getSupabase } from '@/lib/supabase'

export async function PATCH(
  req: Request,
  ctx: RouteContext<'/api/tasks/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const body = await req.json()

  const update: Record<string, unknown> = {}
  if (body.status !== undefined) update.status = body.status
  if (body.title !== undefined) update.title = body.title
  if (body.description !== undefined) update.description = body.description
  if (body.pillar !== undefined) update.pillar = body.pillar

  const { error } = await supabase.from('tasks').update(update).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/tasks/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
