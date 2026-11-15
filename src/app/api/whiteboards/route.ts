import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('whiteboards')
    .select('id, title, thumbnail, is_public, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request) {
  const supabase = getSupabase()
  const body = await req.json().catch(() => ({}))

  const { data, error } = await supabase
    .from('whiteboards')
    .insert({ title: body.title?.trim() || 'Untitled board', data: { shapes: [] } })
    .select('id, title, thumbnail, is_public, created_at, updated_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
