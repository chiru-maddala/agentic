import { getSupabase } from '@/lib/supabase'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('content_lab')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return Response.json({ error: error.message }, { status: 404 })
  return Response.json(data)
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = getSupabase()
  const body = await req.json()
  // Only allow updating these fields
  const allowed = ['word_count', 'keywords', 'platform', 'generated_content', 'status']
  const update: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in body) update[k] = body[k]
  }
  const { data, error } = await supabase.from('content_lab').update(update).eq('id', id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = getSupabase()
  const { error } = await supabase.from('content_lab').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
