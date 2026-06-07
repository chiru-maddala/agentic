import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

type ExtractedNode = {
  label: string
  type: 'concept' | 'technology' | 'organization' | 'theme'
  pillar: 'Learning AI' | 'Enterprise AI' | 'AI Infrastructure' | 'General'
  description: string
}

type ExtractedEdge = {
  source: string
  target: string
  relationship: 'related_to' | 'enables' | 'builds_on' | 'competes_with' | 'part_of'
}

type ExtractionResult = {
  nodes: ExtractedNode[]
  edges: ExtractedEdge[]
}

export async function POST(req: NextRequest) {
  const { reportId, content } = await req.json()
  if (!reportId || !content) {
    return NextResponse.json({ error: 'reportId and content required' }, { status: 400 })
  }

  const client = new Anthropic()
  const supabase = createAdminClient()

  // Extract strategic concepts from report
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `You are building a strategic knowledge graph for Intellina AI, a company with three pillars:
- **Learning AI**: AI for K-12 (Cypher, Morpheus, Zion, NEO, Matrix), Higher Ed (AutoCampus), Professional training (RED AI Academy)
- **Enterprise AI**: Orchea.ai — no-code agentic orchestration on Databricks, T2 Framework, RAG, guardrails
- **AI Infrastructure**: TerraNine.ai (space), MATRIX (on-ground compute)

From the report below, extract **8–15 strategic concepts, technologies, or organizations** that are directly relevant to Intellina's strategy. Ignore passing references or irrelevant mentions.

For each node provide:
- label: short name (2–4 words max, title case)
- type: one of concept | technology | organization | theme
- pillar: one of "Learning AI" | "Enterprise AI" | "AI Infrastructure" | "General"
- description: one sentence explaining relevance to Intellina

Also extract **5–12 edges** (relationships between the nodes you identified):
- source: node label
- target: node label
- relationship: one of related_to | enables | builds_on | competes_with | part_of

Return ONLY valid JSON in this exact shape — no markdown, no explanation:
{"nodes":[{"label":"...","type":"...","pillar":"...","description":"..."}],"edges":[{"source":"...","target":"...","relationship":"..."}]}

--- REPORT ---
${content.slice(0, 6000)}
--- END REPORT ---`,
      },
    ],
  })

  let extracted: ExtractionResult
  try {
    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    extracted = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Failed to parse extraction' }, { status: 500 })
  }

  const { nodes: extractedNodes, edges: extractedEdges } = extracted

  // Upsert nodes — increment mention_count on conflict
  const nodeResults: Record<string, string> = {} // label → id

  for (const n of extractedNodes) {
    const { data: existing } = await supabase
      .from('graph_nodes')
      .select('id, mention_count')
      .eq('label', n.label)
      .single()

    if (existing) {
      await supabase
        .from('graph_nodes')
        .update({ mention_count: existing.mention_count + 1, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      nodeResults[n.label] = existing.id
    } else {
      const { data: inserted } = await supabase
        .from('graph_nodes')
        .insert({ label: n.label, type: n.type, pillar: n.pillar, description: n.description })
        .select('id')
        .single()
      if (inserted) nodeResults[n.label] = inserted.id
    }
  }

  // Link nodes to this report
  const junctionRows = Object.values(nodeResults).map((node_id) => ({ report_id: reportId, node_id }))
  if (junctionRows.length > 0) {
    await supabase.from('report_nodes').upsert(junctionRows, { onConflict: 'report_id,node_id' })
  }

  // Upsert edges — increment weight on conflict
  for (const e of extractedEdges) {
    const srcId = nodeResults[e.source]
    const tgtId = nodeResults[e.target]
    if (!srcId || !tgtId || srcId === tgtId) continue

    const { data: existing } = await supabase
      .from('graph_edges')
      .select('id, weight')
      .eq('source_id', srcId)
      .eq('target_id', tgtId)
      .eq('relationship', e.relationship)
      .single()

    if (existing) {
      await supabase
        .from('graph_edges')
        .update({ weight: existing.weight + 1 })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('graph_edges')
        .insert({ source_id: srcId, target_id: tgtId, relationship: e.relationship })
    }
  }

  return NextResponse.json({ ok: true, nodes: Object.keys(nodeResults).length, edges: extractedEdges.length })
}
