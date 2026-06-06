import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'

export const maxDuration = 120

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, created_at, slide_count')
    .order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request) {
  const supabase = getSupabase()
  const { text } = await req.json()
  if (!text?.trim()) return Response.json({ error: 'No text provided' }, { status: 400 })

  const client = new Anthropic()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: `You create concise, engaging short presentations from source text. Output valid JSON only — no markdown fences, no commentary. The JSON must match this schema exactly:
{
  "title": "string",
  "slides": [
    {
      "type": "title" | "content" | "bullets" | "quote" | "summary",
      "heading": "string",
      "body": "string (optional, for content/quote/summary slides)",
      "bullets": ["string"] (optional, for bullets slides)
    }
  ]
}
Rules: 5-8 slides total. First slide type="title". Last slide type="summary". Keep each slide focused and readable. Use bullets slides for lists of 3-6 items. Use quote slides for key insights.`,
    messages: [
      {
        role: 'user',
        content: `Create a short course from this text:\n\n${text.slice(0, 3000)}`,
      },
    ],
  })

  let slides: unknown[]
  let title: string
  try {
    let raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    // Strip markdown code fences if Claude wraps the JSON anyway
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const parsed = JSON.parse(raw)
    title = parsed.title
    slides = parsed.slides
    if (!title || !Array.isArray(slides) || slides.length === 0) {
      throw new Error('Invalid structure')
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return Response.json({ error: `Failed to parse course structure: ${msg}` }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('courses')
    .insert({ title, slides: JSON.stringify(slides), slide_count: slides.length })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
