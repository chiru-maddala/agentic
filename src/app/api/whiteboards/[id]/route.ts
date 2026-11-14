import { getSupabase } from '@/lib/supabase'

export async function GET(
  _req: Request,
  ctx: RouteContext<'/api/whiteboards/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const { data, error } = await supabase
    .from('whiteboards')
    .select('id, title, data, thumbnail, created_at, updated_at')
    .eq('id', id)
    .single()
  if (error) return Response.json({ error: error.message }, { status: 404 })
  return Response.json(data)
}

export async function PUT(
  req: Request,
  ctx: RouteContext<'/api/whiteboards/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const body = await req.json()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string') update.title = body.title.trim() || 'Untitled board'
  if (body.data !== undefined) update.data = body.data
  if (body.thumbnail !== undefined) update.thumbnail = body.thumbnail

  const { error } = await supabase.from('whiteboards').update(update).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/whiteboards/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const { error } = await supabase.from('whiteboards').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
