import { getSupabase } from '@/lib/supabase'
import { isReportScope } from '@/lib/pillars'

export async function GET(req: Request) {
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const scope = searchParams.get('vertical')

  let query = supabase
    .from('reports')
    .select('id, date, created_at, vertical')
    .order('created_at', { ascending: false })
    .limit(30)

  if (isReportScope(scope)) {
    query = query.eq('vertical', scope)
  }

  const { data, error } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}
