import { getSupabase } from '@/lib/supabase'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('content_lab')
    .select('id, type, title, concept, platform, generated_content, created_at')
    .eq('id', id)
    .single()
  if (error || !data) return Response.json({ error: 'Not found' }, { status: 404 })
  if (!data.generated_content) return Response.json({ error: 'Content not yet generated' }, { status: 404 })
  return Response.json(data)
}
