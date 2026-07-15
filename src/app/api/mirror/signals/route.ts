import { getSupabase } from '@/lib/supabase'
import { categoryForType } from '@/lib/signals'

export async function GET(req: Request) {
  const supabase = getSupabase()
  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get('limit') ?? '60')
  const { data, error } = await supabase
    .from('mirror_signals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: Request) {
  const supabase = getSupabase()
  const body = await req.json()
  const type = body.type ?? 'manual_checkin'
  const { error } = await supabase.from('mirror_signals').insert({
    type,
    category: categoryForType(type),
    content: body.content,
    pillar: body.pillar ?? null,
    metadata: body.metadata ?? {},
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
