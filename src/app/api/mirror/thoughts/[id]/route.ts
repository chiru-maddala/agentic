import { getSupabase } from '@/lib/supabase'
import { MAX_LENGTH, extractHashtags } from '../route'

export async function PUT(
  req: Request,
  ctx: RouteContext<'/api/mirror/thoughts/[id]'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const body = await req.json()
  const content = typeof body.content === 'string' ? body.content.trim() : ''

  if (!content) return Response.json({ error: 'Thought cannot be empty' }, { status: 400 })
  if (content.length > MAX_LENGTH) return Response.json({ error: `Thought exceeds ${MAX_LENGTH} characters` }, { status: 400 })

  const { data, error } = await supabase
    .from('mirror_thoughts')
    .update({ content, hashtags: extractHashtags(content) })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

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
