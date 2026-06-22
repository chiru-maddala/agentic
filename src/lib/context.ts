import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Returns the extracted text of all uploaded context documents, concatenated
 * and labelled per file. Empty string when no documents exist. Inject this
 * into agent system prompts so the system always has the latest context.
 */
export async function getContextDocsText(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<string> {
  const { data } = await supabase
    .from('context_documents')
    .select('filename, content')
    .order('created_at', { ascending: true })

  if (!data || data.length === 0) return ''

  return data
    .map((d: { filename: string; content: string }) => `--- Document: ${d.filename} ---\n${d.content}`)
    .join('\n\n')
}
