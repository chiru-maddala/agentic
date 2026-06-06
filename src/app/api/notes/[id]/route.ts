import { getSupabase } from '@/lib/supabase'

export async function GET(
  _req: Request,
  ctx: RouteContext<'/api/notes/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const { data, error } = await supabase.from('notes').select('*').eq('id', id).single()
  if (error) return Response.json({ error: error.message }, { status: 404 })
  return Response.json(data)
}

export async function PUT(
  req: Request,
  ctx: RouteContext<'/api/notes/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const body = await req.json()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title !== undefined) update.title = body.title
  if (body.content !== undefined) update.content = body.content

  const { error } = await supabase
    .from('notes')
    .update(update)
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/notes/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
