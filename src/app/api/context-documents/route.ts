import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'
import { chunkText } from '@/lib/context'

export const maxDuration = 300

// List uploaded context documents (without their full text payload)
export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('context_documents')
    .select('id, filename, char_count, created_at')
    .order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

// Upload a PDF: extract its text with Claude, then persist the extracted text
export async function POST(req: Request) {
  const { filename, data } = (await req.json()) as { filename?: string; data?: string }
  if (!filename || !data) {
    return Response.json({ error: 'filename and data (base64) are required' }, { status: 400 })
  }

  const client = new Anthropic()

  let extracted = ''
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data },
            },
            {
              type: 'text',
              text: 'Extract the full text content of this PDF as clean Markdown. Preserve headings, lists, and tables. Output only the document content — no preamble, commentary, or summary.',
            },
          ],
        },
      ],
    })
    extracted = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to read PDF'
    return Response.json({ error: msg }, { status: 500 })
  }

  if (!extracted) {
    return Response.json({ error: 'No text could be extracted from this PDF' }, { status: 422 })
  }

  const supabase = getSupabase()
  const { data: row, error } = await supabase
    .from('context_documents')
    .insert({ filename, content: extracted, char_count: extracted.length })
    .select('id, filename, char_count, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Split the document into chunks for full-text retrieval
  const chunks = chunkText(extracted)
  if (chunks.length > 0) {
    const { error: chunkErr } = await supabase.from('context_chunks').insert(
      chunks.map((content, chunk_index) => ({
        document_id: row.id,
        filename,
        chunk_index,
        content,
      }))
    )
    if (chunkErr) return Response.json({ error: chunkErr.message }, { status: 500 })
  }

  return Response.json(row)
}

// Delete a context document by id
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 })

  const supabase = getSupabase()
  const { error } = await supabase.from('context_documents').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
