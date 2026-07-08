import { getSupabase } from '@/lib/supabase'

export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/mirror/thoughts/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const { error } = await supabase.from('mirror_thoughts').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
