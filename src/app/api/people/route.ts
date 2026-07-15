import { getSupabase } from '@/lib/supabase'
import { categoryForType } from '@/lib/signals'

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .order('name')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(req: Request) {
  const supabase = getSupabase()
  const body = await req.json()

  const { data, error } = await supabase
    .from('people')
    .insert({
      name: body.name,
      type: body.type ?? 'internal',
      role: body.role ?? null,
      company: body.company ?? null,
      email: body.email ?? null,
      primary_pillar: body.primary_pillar ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  void Promise.resolve(supabase.from('mirror_signals').insert({
    type: 'person_added',
    category: categoryForType('person_added'),
    content: `Added ${data.type} person: "${data.name}"`,
    pillar: data.primary_pillar ?? null,
    metadata: { person_id: data.id },
  })).catch(() => {})

  return Response.json(data)
}
