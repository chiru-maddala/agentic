import { getSupabase } from '@/lib/supabase'

export async function GET(
  _req: Request,
  ctx: RouteContext<'/api/chat/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', id)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/chat/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params

  const { error } = await supabase.from('chat_sessions').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}

export async function PATCH(
  req: Request,
  ctx: RouteContext<'/api/chat/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const body = await req.json()

  const { error } = await supabase
    .from('chat_sessions')
    .update({ title: body.title })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
