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

  const prompt = `You are a competitive intelligence researcher. Research the company "${competitor.name}" (${competitor.website}) and find their named clients and published case studies.

Return a JSON object with this exact structure:
{
  "clients": [
    {
      "name": "Company Name",
      "industry": "Industry",
      "company_size": "Enterprise / Mid-market / SMB",
      "geography": "Region or Country",
      "notes": "Any context about why they are a client"
    }
  ],
  "case_studies": [
    {
      "title": "Concise title describing the outcome",
      "client_name": "The client company name (must match one of the clients above, or null if anonymous)",
      "pillar": "Learning AI OR Enterprise AI OR AI Infrastructure OR null",
      "industry": "Industry",
      "function": "Business function e.g. Operations, Sales, Customer Service",
      "tools": ["tool1", "tool2"],
      "outcome_metric": "Specific measurable outcome e.g. 40% cost reduction",
      "source_url": "URL to the case study page or press release",
      "notes": "Brief summary of what happened"
    }
  ]
}

Rules:
- Only include real, verifiable clients that ${competitor.name} publicly claims
- For "pillar", use STRICT definitions — the case study must explicitly involve AI/ML to qualify:
  • "Learning AI" = AI used for employee training, upskilling, learning platforms, AI tutors, personalized education
  • "Enterprise AI" = AI agents, LLMs, generative AI, AI copilots, AI-powered automation, chatbots, NLP deployed in business workflows
  • "AI Infrastructure" = GPU compute, AI model training infrastructure, MLOps platforms, vector databases, model serving, AI-specific data pipelines
  • null = general IT, cloud migration, ERP, networking, managed services, cybersecurity, or any case study that does NOT specifically involve AI or ML — set to null even if it involves technology or infrastructure
- When in doubt between a pillar and null, choose null. Do NOT map general "cloud" or "IT infrastructure" to "AI Infrastructure".
- Include up to 15 clients and up to 10 case studies
- Prefer case studies with specific, measurable outcomes
- Return ONLY valid JSON, no explanation`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })

  let parsed: { clients: Record<string, string>[]; case_studies: Record<string, unknown>[] }
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({ error: 'Invalid JSON from AI' }, { status: 500 })
  }

  // Insert clients first, build name→id map
  const clientNameToId: Record<string, string> = {}
  const clientsToInsert = (parsed.clients ?? []).map(c => ({ ...c, competitor_id: id }))

  if (clientsToInsert.length > 0) {
    const { data: insertedClients } = await supabase
      .from('competitor_clients')
      .upsert(clientsToInsert, { onConflict: 'competitor_id,name', ignoreDuplicates: false })
      .select('id, name')
    ;(insertedClients ?? []).forEach((c: { id: string; name: string }) => { clientNameToId[c.name] = c.id })
  }

  // Insert case studies, linking client_id where name matches
  const caseStudiesToInsert = (parsed.case_studies ?? []).map(cs => {
    const clientId = cs.client_name ? clientNameToId[cs.client_name as string] ?? null : null
    const { client_name, ...rest } = cs
    void client_name
    return { ...rest, competitor_id: id, client_id: clientId }
  })

  if (caseStudiesToInsert.length > 0) {
    await supabase.from('competitor_case_studies').insert(caseStudiesToInsert)
  }

  // Fetch final state
  const [{ data: clients }, { data: caseStudies }] = await Promise.all([
    supabase.from('competitor_clients').select('*').eq('competitor_id', id).order('created_at'),
    supabase.from('competitor_case_studies').select('*, competitor_clients(name)').eq('competitor_id', id).order('created_at'),
  ])

  return NextResponse.json({
    clients: clients ?? [],
    case_studies: caseStudies ?? [],
    summary: {
      clients_added: clientsToInsert.length,
      case_studies_added: caseStudiesToInsert.length,
    },
  })
}
