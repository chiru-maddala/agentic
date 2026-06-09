import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'

export const maxDuration = 120

// GET — return saved suggestions for this report
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = getSupabase()
  const { data } = await supabase
    .from('report_suggestions')
    .select('blog_posts, social_posts')
    .eq('report_id', id)
    .single()
  if (!data) return Response.json(null)
  return Response.json(data)
}

// POST — generate fresh suggestions and save to DB
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = getSupabase()

  const { data: report, error } = await supabase
    .from('reports')
    .select('content')
    .eq('id', id)
    .single()
  if (error || !report) return Response.json({ error: 'Report not found' }, { status: 404 })

  const { data: settings } = await supabase
    .from('settings')
    .select('key, value')
    .eq('key', 'business_context')
  const businessCtx = settings?.[0]?.value ?? ''

  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: `You extract content marketing ideas from AI intelligence reports. Output valid JSON only — no markdown fences.
The JSON must match exactly:
{
  "blog_posts": [
    { "title": "string", "concept": "string (1-2 sentences)", "pillar": "Learning AI | Enterprise AI | AI Infrastructure | General" }
  ],
  "social_posts": [
    { "title": "string", "concept": "string (1-2 sentences)", "pillar": "Learning AI | Enterprise AI | AI Infrastructure | General" }
  ]
}
Rules: 3-5 blog post ideas, 3-5 social post ideas. Assign each idea to its most relevant Intellina pillar (Learning AI, Enterprise AI, AI Infrastructure, or General). Tie each idea to market signals in the report. Make titles punchy and specific.${businessCtx ? `\n\nBusiness context:\n${businessCtx}` : ''}`,
    messages: [
      {
        role: 'user',
        content: `Extract content lab suggestions from this daily AI intelligence report:\n\n${report.content.slice(0, 4000)}`,
      },
    ],
  })

  let raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try {
    const parsed = JSON.parse(raw)

    // Persist — upsert so regenerate overwrites previous
    await supabase
      .from('report_suggestions')
      .upsert(
        { report_id: id, blog_posts: parsed.blog_posts, social_posts: parsed.social_posts },
        { onConflict: 'report_id' }
      )

    return Response.json(parsed)
  } catch {
    return Response.json({ error: 'Failed to parse suggestions' }, { status: 500 })
  }
}
