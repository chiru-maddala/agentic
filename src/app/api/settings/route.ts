import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('settings').select('key, value')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  // Return as a key→value map
  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.key] = row.value
  return Response.json(map)
}

export async function PUT(req: Request) {
  const supabase = getSupabase()
  const body: Record<string, string> = await req.json()
  const rows = Object.entries(body).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }))

  const { error } = await supabase
    .from('settings')
    .upsert(rows, { onConflict: 'key' })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
