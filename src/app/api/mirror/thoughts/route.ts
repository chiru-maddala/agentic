import { getSupabase } from '@/lib/supabase'

export type Thought = {
  id: string
  content: string
  hashtags: string[]
  created_at: string
}

const MAX_LENGTH = 280

function extractHashtags(content: string): string[] {
  const matches = content.match(/#[a-zA-Z0-9_]+/g) ?? []
  return [...new Set(matches.map((h) => h.slice(1).toLowerCase()))]
}

export async function GET(req: Request) {
  const supabase = getSupabase()
  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get('limit') ?? '200')
  const hashtag = url.searchParams.get('hashtag')

  let query = supabase
    .from('mirror_thoughts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (hashtag) query = query.contains('hashtags', [hashtag.toLowerCase()])

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: Request) {
  const supabase = getSupabase()
  const body = await req.json()
  const content = typeof body.content === 'string' ? body.content.trim() : ''

  if (!content) return Response.json({ error: 'Thought cannot be empty' }, { status: 400 })
  if (content.length > MAX_LENGTH) return Response.json({ error: `Thought exceeds ${MAX_LENGTH} characters` }, { status: 400 })

  const { data, error } = await supabase
    .from('mirror_thoughts')
    .insert({ content, hashtags: extractHashtags(content) })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
