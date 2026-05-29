import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('notes')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request) {
  const supabase = getSupabase()
  const body = await req.json()

  const { data, error } = await supabase
    .from('notes')
    .insert({ title: body.title ?? 'Untitled Note', content: body.content ?? '' })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
