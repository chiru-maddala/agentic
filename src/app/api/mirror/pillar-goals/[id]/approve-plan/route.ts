import { getSupabase } from '@/lib/supabase'

export async function POST(
  _req: Request,
  ctx: RouteContext<'/api/mirror/pillar-goals/[id]/approve-plan'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params

  const { data: goal } = await supabase
    .from('mirror_pillar_goals')
    .select('plan_document')
    .eq('id', id)
    .single()
  if (!goal?.plan_document) {
    return Response.json({ error: 'No plan document to approve yet' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('mirror_pillar_goals')
    .update({ plan_approved_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
