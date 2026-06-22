import { getSupabase } from '@/lib/supabase'
import { chunkText } from '@/lib/context'

export const maxDuration = 300

// Backfill full-text chunks for any documents that don't have them yet
// (e.g. documents uploaded before chunked retrieval was introduced).
export async function POST() {
  const supabase = getSupabase()

  const { data: docs, error } = await supabase
    .from('context_documents')
    .select('id, filename, content')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!docs || docs.length === 0) return Response.json({ reindexed: 0 })

  let reindexed = 0
  for (const doc of docs as { id: string; filename: string; content: string }[]) {
    const { count } = await supabase
      .from('context_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', doc.id)
    if ((count ?? 0) > 0) continue

    const chunks = chunkText(doc.content)
    if (chunks.length === 0) continue

    const { error: insErr } = await supabase.from('context_chunks').insert(
      chunks.map((content, chunk_index) => ({
        document_id: doc.id,
        filename: doc.filename,
        chunk_index,
        content,
      }))
    )
    if (insErr) return Response.json({ error: insErr.message }, { status: 500 })
    reindexed++
  }

  return Response.json({ reindexed })
}
