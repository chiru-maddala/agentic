import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>

/**
 * Returns the extracted text of all uploaded context documents, concatenated
 * and labelled per file. Empty string when no documents exist.
 *
 * Prefer `getRelevantContext` for query-driven prompts — this full dump is only
 * appropriate when there is no query to retrieve against.
 */
export async function getContextDocsText(supabase: DB): Promise<string> {
  const { data } = await supabase
    .from('context_documents')
    .select('filename, content')
    .order('created_at', { ascending: true })

  if (!data || data.length === 0) return ''

  return data
    .map((d: { filename: string; content: string }) => `--- Document: ${d.filename} ---\n${d.content}`)
    .join('\n\n')
}

/**
 * Split a document into overlapping chunks suitable for full-text retrieval.
 * Splits on paragraph boundaries, packing into ~CHUNK_SIZE windows with a small
 * overlap so context isn't lost across boundaries.
 */
export function chunkText(text: string, chunkSize = 1200, overlap = 150): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if (current && current.length + para.length + 2 > chunkSize) {
      chunks.push(current)
      // start next chunk with a tail-overlap of the previous one
      current = overlap > 0 ? current.slice(-overlap) + '\n\n' + para : para
    } else {
      current = current ? `${current}\n\n${para}` : para
    }
  }
  if (current.trim()) chunks.push(current)

  // Hard-split any oversized chunk (e.g. a single huge paragraph)
  const result: string[] = []
  for (const c of chunks) {
    if (c.length <= chunkSize * 1.5) {
      result.push(c)
    } else {
      for (let i = 0; i < c.length; i += chunkSize - overlap) {
        result.push(c.slice(i, i + chunkSize))
      }
    }
  }
  return result
}

/**
 * Retrieve the most relevant context-document chunks for a query via Postgres
 * full-text search. Returns a labelled, prompt-ready string, or '' if nothing
 * matches (or there are no documents).
 */
export async function getRelevantContext(
  supabase: DB,
  query: string,
  matchCount = 6
): Promise<string> {
  const trimmed = query?.trim()
  if (!trimmed) return ''

  const { data, error } = await supabase.rpc('match_context_chunks', {
    query_text: trimmed,
    match_count: matchCount,
  })

  if (error || !data || data.length === 0) return ''

  const byFile = new Map<string, string[]>()
  for (const row of data as { filename: string; content: string }[]) {
    const arr = byFile.get(row.filename) ?? []
    arr.push(row.content)
    byFile.set(row.filename, arr)
  }

  return [...byFile.entries()]
    .map(([filename, parts]) => `--- Document: ${filename} ---\n${parts.join('\n…\n')}`)
    .join('\n\n')
}
