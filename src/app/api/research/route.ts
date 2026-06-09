import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase-admin'
import { buildSystemPrompt } from '@/lib/prompt'

export const maxDuration = 300

async function fetchUrlContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IntelliRadar/1.0)' },
      signal: AbortSignal.timeout(15000),
    })
    const html = await res.text()
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return text.slice(0, 12000)
  } catch {
    return `[Could not fetch content from ${url}]`
  }
}

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('research_reports')
    .select('id, title, sources, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: Request) {
  const supabase = createAdminClient()

  // PDFs are uploaded client-side to Supabase Storage; we receive only metadata + public URLs
  const body = await request.json() as {
    title: string
    urls: string[]
    pdfs: { name: string; storagePath: string; publicUrl: string }[]
  }

  const { title = 'Research Analysis', urls = [], pdfs = [] } = body

  type Source = { type: 'pdf' | 'url'; name: string; url: string; storage_path?: string }
  const sources: Source[] = []
  const pdfBlocks: Anthropic.DocumentBlockParam[] = []

  // Download each PDF from its public URL and base64-encode for Claude
  for (const pdf of pdfs) {
    sources.push({ type: 'pdf', name: pdf.name, url: pdf.publicUrl, storage_path: pdf.storagePath })
    try {
      const res = await fetch(pdf.publicUrl)
      const buffer = Buffer.from(await res.arrayBuffer())
      pdfBlocks.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
        title: pdf.name,
      } as Anthropic.DocumentBlockParam)
    } catch {
      // Source is recorded; Claude just won't have the binary content
    }
  }

  // Fetch URL content server-side
  const urlContents: { url: string; content: string }[] = []
  for (const url of urls) {
    sources.push({ type: 'url', name: url, url })
    urlContents.push({ url, content: await fetchUrlContent(url) })
  }

  const today = new Date().toISOString().split('T')[0]
  let textContent = `Today is ${today}. The user has submitted research material for analysis.\n\n`

  if (pdfBlocks.length > 0) {
    textContent += `There are ${pdfBlocks.length} PDF document(s) attached. Please read and analyze them thoroughly.\n\n`
  }

  if (urlContents.length > 0) {
    textContent += `--- WEB SOURCES ---\n`
    for (const { url, content } of urlContents) {
      textContent += `\nURL: ${url}\nContent:\n${content}\n\n`
    }
    textContent += `--- END WEB SOURCES ---\n\n`
  }

  textContent += `Analyze all provided materials and generate a structured research intelligence report in the same format as the Daily Research Report. Extract key signals, insights, and recommended actions relevant to Intellina's three pillars (Learning AI, Enterprise AI, AI Infrastructure). Be specific and cite the source material directly.`

  const userContent: Anthropic.ContentBlockParam[] = [
    ...pdfBlocks,
    { type: 'text', text: textContent },
  ]

  const client = new Anthropic()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = ''
      try {
        const anthropicStream = await client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          system: buildSystemPrompt(),
          messages: [{ role: 'user', content: userContent }],
        })

        for await (const chunk of anthropicStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            fullContent += chunk.delta.text
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }

        if (fullContent) {
          await supabase.from('research_reports').insert({ title, content: fullContent, sources })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        controller.enqueue(encoder.encode(`\n\n⚠️ Error: ${msg}`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
