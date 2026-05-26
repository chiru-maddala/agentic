import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'chirans@gmail.com'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, approved } = await request.json()
  if (!id || typeof approved !== 'boolean') {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_profiles')
    .update({ approved })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
