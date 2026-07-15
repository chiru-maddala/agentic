import { getSupabase } from '@/lib/supabase'
import { categoryForType } from '@/lib/signals'

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
  if (body.person_id !== undefined) update.person_id = body.person_id
  if (body.meeting_id !== undefined) update.meeting_id = body.meeting_id

  let justCompleted: { title: string; pillar: string | null } | null = null
  if (body.status === 'done') {
    const { data: existing } = await supabase
      .from('tasks')
      .select('title, pillar, status')
      .eq('id', id)
      .single()
    if (existing && existing.status !== 'done') {
      justCompleted = { title: existing.title, pillar: existing.pillar ?? null }
    }
  }

  const { error } = await supabase.from('tasks').update(update).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (justCompleted) {
    // Auto-signal capture (fire-and-forget)
    void Promise.resolve(supabase.from('mirror_signals').insert({
      type: 'task_completed',
      category: categoryForType('task_completed'),
      content: `Completed task: "${justCompleted.title}"`,
      pillar: justCompleted.pillar,
      metadata: { task_id: id },
    })).catch(() => {})
  }

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
