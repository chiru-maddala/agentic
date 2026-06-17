import { getSupabase } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = getSupabase()

  const { data: competitor, error } = await supabase
    .from('competitors')
    .select('name, website')
    .eq('id', id)
    .single()

  if (error || !competitor) return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })

  const anthropic = new Anthropic()

  const prompt = `You are a competitive intelligence analyst. Research the company "${competitor.name}" (website: ${competitor.website}) and return a JSON object with the latest information.

Return ONLY a valid JSON object with these fields (all optional, use null if unknown):
{
  "description": "1-2 sentence company description",
  "founding_year": 2020,
  "hq": "City, Country",
  "funding_stage": "Series B / Bootstrapped / Public / etc",
  "total_raised": "$50M",
  "team_size": "50-100",
  "pricing_model": "Per seat / Usage-based / Enterprise contract / etc",
  "positioning": "Their main value prop / tagline",
  "target_industries": ["Healthcare", "Finance"],
  "target_company_size": ["Enterprise", "Mid-market"],
  "geographies": ["North America", "Europe"],
  "tech_stack": ["OpenAI", "AWS", "Pinecone"],
  "differentiators": ["Key differentiator 1", "Key differentiator 2"],
  "content_themes": ["AI automation", "Cost reduction"],
  "pillars": ["Learning AI", "Enterprise AI", "AI Infrastructure"]
}

For "pillars", only include values from: ["Learning AI", "Enterprise AI", "AI Infrastructure"] — these are Intellina AI's three focus areas. Map the competitor's focus to whichever pillars they compete in.

Base your response on publicly available information about this company. Return ONLY the JSON, no explanation.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({ error: 'Invalid JSON from AI' }, { status: 500 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('competitors')
    .update({ ...parsed, last_refreshed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json(updated)
}
