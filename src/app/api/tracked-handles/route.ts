import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('tracked_handles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request) {
  const supabase = getSupabase()
  const body = await req.json()
  const handle = String(body.handle ?? '').trim().replace(/^@/, '')
  const pillar = body.pillar ? String(body.pillar) : null

  if (!handle) return Response.json({ error: 'Handle is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('tracked_handles')
    .insert({ handle, pillar })
    .select()
    .single()

  if (error) {
    const message = error.code === '23505' ? `@${handle} is already tracked` : error.message
    return Response.json({ error: message }, { status: 400 })
  }
  return Response.json(data)
}

export async function PATCH(req: Request) {
  const supabase = getSupabase()
  const body = await req.json()
  const { id, active } = body
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('tracked_handles')
    .update({ active })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(req: Request) {
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase.from('tracked_handles').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
