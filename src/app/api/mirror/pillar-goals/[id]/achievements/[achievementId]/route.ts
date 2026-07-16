import { getSupabase } from '@/lib/supabase'

export async function PATCH(
  req: Request,
  ctx: RouteContext<'/api/mirror/pillar-goals/[id]/achievements/[achievementId]'>
) {
  const supabase = getSupabase()
  const { achievementId } = await ctx.params
  const body = await req.json()

  const update: Record<string, unknown> = {}
  if (body.title !== undefined) update.title = body.title.trim()
  if (body.location !== undefined) update.location = body.location?.trim() || null
  if (body.notes !== undefined) update.notes = body.notes?.trim() || null
  if (body.achieved_at !== undefined) update.achieved_at = body.achieved_at

  const { data, error } = await supabase
    .from('goal_achievements')
    .update(update)
    .eq('id', achievementId)
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/mirror/pillar-goals/[id]/achievements/[achievementId]'>
) {
  const supabase = getSupabase()
  const { id, achievementId } = await ctx.params

  const { error } = await supabase.from('goal_achievements').delete().eq('id', achievementId)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { count } = await supabase
    .from('goal_achievements')
    .select('*', { count: 'exact', head: true })
    .eq('goal_id', id)

  const { data: goal, error: goalError } = await supabase
    .from('mirror_pillar_goals')
    .update({ current_value: count ?? 0, current_value_updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (goalError) return Response.json({ error: goalError.message }, { status: 500 })

  return Response.json({ success: true, goal })
}
