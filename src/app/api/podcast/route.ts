import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('podcast_episodes')
    .select('id, title, created_at')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}
