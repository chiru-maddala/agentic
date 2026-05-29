import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, title, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request) {
  const supabase = getSupabase()
  const body = await req.json()
  const title = body.title ?? 'New Chat'

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ title })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
