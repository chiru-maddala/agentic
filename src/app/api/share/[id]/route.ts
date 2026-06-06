import { getSupabase } from '@/lib/supabase'

// Public endpoint — no auth required. Only exposes task title + document_content.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase()
  const { id } = await ctx.params

  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, document_content, created_at')
    .eq('id', id)
    .not('document_content', 'is', null)
    .single()

  if (error || !data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(data)
}
