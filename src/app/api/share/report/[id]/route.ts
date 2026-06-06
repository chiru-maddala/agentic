import { getSupabase } from '@/lib/supabase'

// Public endpoint — no auth required. Exposes report date + content only.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase()
  const { id } = await ctx.params

  const { data, error } = await supabase
    .from('reports')
    .select('id, date, content, created_at')
    .eq('id', id)
    .single()

  if (error || !data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(data)
}
