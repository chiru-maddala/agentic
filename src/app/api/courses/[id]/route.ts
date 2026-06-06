import { getSupabase } from '@/lib/supabase'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const { data, error } = await supabase.from('courses').select('*').eq('id', id).single()
  if (error) return Response.json({ error: error.message }, { status: 404 })
  return Response.json(data)
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
