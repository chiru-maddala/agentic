import { getSupabase } from '@/lib/supabase'
import { VERTICALS } from '@/lib/prompt'

export async function GET(req: Request) {
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const vertical = searchParams.get('vertical')

  let query = supabase
    .from('reports')
    .select('id, date, created_at, vertical')
    .order('created_at', { ascending: false })
    .limit(30)

  if (vertical && (VERTICALS as string[]).includes(vertical)) {
    query = query.eq('vertical', vertical)
  }

  const { data, error } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}
