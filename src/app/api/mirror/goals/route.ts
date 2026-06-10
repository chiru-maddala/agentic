import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('mirror_goals')
    .select('*')
    .order('pillar')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function PUT(req: Request) {
  const supabase = getSupabase()
  const body = await req.json()
  const { error } = await supabase
    .from('mirror_goals')
    .upsert(
      { ...body, updated_at: new Date().toISOString() },
      { onConflict: 'pillar' }
    )
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
