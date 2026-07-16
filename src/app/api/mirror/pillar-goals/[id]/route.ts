import { getSupabase } from '@/lib/supabase'
import { categoryForType } from '@/lib/signals'

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
  if (body.plan_document !== undefined) update.plan_document = body.plan_document
  if (body.current_value !== undefined) {
    update.current_value = body.current_value
    update.current_value_updated_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('mirror_pillar_goals')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (body.current_value !== undefined) {
    void Promise.resolve(supabase.from('mirror_signals').insert({
      type: 'goal_progress_updated',
      category: categoryForType('goal_progress_updated'),
      content: `Updated progress on "${data.name}": ${body.current_value ?? 0}${data.target_number != null ? ` / ${data.target_number}` : ''}`,
      pillar: data.pillar ?? null,
      metadata: { goal_id: data.id },
    })).catch(() => {})
  }

  return Response.json(data)
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
