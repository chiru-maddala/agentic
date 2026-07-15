import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('mirror_pillar_goals')
    .select('*')
    .order('pillar')
    .order('created_at')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: Request) {
  const supabase = getSupabase()
  const body = await req.json()

  const { data, error } = await supabase
    .from('mirror_pillar_goals')
    .insert({
      pillar: body.pillar,
      name: body.name,
      target_number: body.target_number ?? null,
      target_date: body.target_date ?? null,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
