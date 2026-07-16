import { getSupabase } from '@/lib/supabase'
import { categoryForType } from '@/lib/signals'

export async function GET(
  _req: Request,
  ctx: RouteContext<'/api/mirror/pillar-goals/[id]/achievements'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const { data, error } = await supabase
    .from('goal_achievements')
    .select('*')
    .eq('goal_id', id)
    .order('achieved_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(
  req: Request,
  ctx: RouteContext<'/api/mirror/pillar-goals/[id]/achievements'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const body = await req.json()
  if (!body.title?.trim()) return Response.json({ error: 'Title is required' }, { status: 400 })

  const { data: achievement, error } = await supabase
    .from('goal_achievements')
    .insert({
      goal_id: id,
      title: body.title.trim(),
      location: body.location?.trim() || null,
      notes: body.notes?.trim() || null,
      achieved_at: body.achieved_at || new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()
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

  void Promise.resolve(supabase.from('mirror_signals').insert({
    type: 'goal_achievement_added',
    category: categoryForType('goal_achievement_added'),
    content: `Logged achievement on "${goal.name}": ${achievement.title}`,
    pillar: goal.pillar ?? null,
    metadata: { goal_id: id, achievement_id: achievement.id },
  })).catch(() => {})

  return Response.json({ achievement, goal })
}
