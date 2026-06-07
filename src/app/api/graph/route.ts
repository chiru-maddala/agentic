import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createAdminClient()

  const [{ data: nodes }, { data: edges }] = await Promise.all([
    supabase
      .from('graph_nodes')
      .select('id, label, type, pillar, description, mention_count, created_at')
      .order('mention_count', { ascending: false }),
    supabase
      .from('graph_edges')
      .select('id, source_id, target_id, relationship, weight'),
  ])

  return NextResponse.json({ nodes: nodes ?? [], edges: edges ?? [] })
}
