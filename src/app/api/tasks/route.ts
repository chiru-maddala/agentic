import { getSupabase } from '@/lib/supabase'
import { categoryForType } from '@/lib/signals'

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request) {
  const supabase = getSupabase()
  const body = await req.json()

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: body.title,
      description: body.description ?? null,
      pillar: body.pillar ?? 'General',
      status: body.status ?? 'todo',
      source: body.source ?? 'manual',
      report_id: body.report_id ?? null,
      person_id: body.person_id ?? null,
      meeting_id: body.meeting_id ?? null,
      goal_id: body.goal_id ?? null,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Auto-signal capture (fire-and-forget)
  void Promise.resolve(supabase.from('mirror_signals').insert({
    type: 'task_created',
    category: categoryForType('task_created'),
    content: `Created task: "${data.title}"`,
    pillar: data.pillar ?? null,
    metadata: { task_id: data.id, source: data.source },
  })).catch(() => {})

  return Response.json(data)
}
