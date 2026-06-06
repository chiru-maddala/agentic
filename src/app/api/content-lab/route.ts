import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('content_lab')
    .select('id, type, title, concept, status, platform, word_count, keywords, created_at')
    .order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request) {
  const supabase = getSupabase()
  const body = await req.json()
  const { type, title, concept, platform, word_count, keywords } = body
  if (!type || !title || !concept) {
    return Response.json({ error: 'type, title and concept are required' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('content_lab')
    .insert({ type, title, concept, platform: platform ?? null, word_count: word_count ?? null, keywords: keywords ?? [], status: 'pending' })
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
