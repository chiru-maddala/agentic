import { getSupabase } from '@/lib/supabase'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('research_reports')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 404 })
  return Response.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabase()

  // Fetch sources to clean up storage
  const { data } = await supabase
    .from('research_reports')
    .select('sources')
    .eq('id', id)
    .single()

  if (data?.sources) {
    const pdfs = (data.sources as Array<{ type: string; storage_path?: string }>)
      .filter((s) => s.type === 'pdf' && s.storage_path)
      .map((s) => s.storage_path!)

    if (pdfs.length > 0) {
      await supabase.storage.from('research-pdfs').remove(pdfs)
    }
  }

  const { error } = await supabase.from('research_reports').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
