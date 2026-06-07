import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export const maxDuration = 120

type ExtractedNode = {
  label: string
  type: 'concept' | 'technology' | 'organization' | 'theme'
  pillar: 'Learning AI' | 'Enterprise AI' | 'AI Infrastructure' | 'General'
  description: string
  mention_count: number
}

type ExtractedEdge = {
  source: string
  target: string
  relationship: 'related_to' | 'enables' | 'builds_on' | 'competes_with' | 'part_of'
  weight: number
}

type ExtractionResult = {
  nodes: ExtractedNode[]
  edges: ExtractedEdge[]
}

export async function POST() {
  const supabase = createAdminClient()
  const client = new Anthropic()

  // ── 1. Fetch all content sources ─────────────────────────────────────────

  const [
    { data: reports },
    { data: notes },
    { data: tasks },
    { data: contentLab },
  ] = await Promise.all([
    supabase.from('reports').select('content').order('created_at', { ascending: false }).limit(20),
    supabase.from('notes').select('title, content').order('updated_at', { ascending: false }).limit(30),
    supabase.from('tasks').select('title, description, pillar'),
    supabase.from('content_lab').select('title, concept, keywords, generated_content').limit(30),
  ])

  // ── 2. Build condensed context ────────────────────────────────────────────

  const sections: string[] = []

  if (reports?.length) {
    const reportText = reports
      .map((r) => r.content?.slice(0, 1500) ?? '')
      .filter(Boolean)
      .join('\n\n---\n\n')
    sections.push(`## REPORTS (${reports.length})\n${reportText}`)
  }

  if (notes?.length) {
    const noteText = notes
      .map((n) => `**${n.title}**\n${n.content?.slice(0, 500) ?? ''}`)
      .filter((t) => t.trim())
      .join('\n\n')
    sections.push(`## NOTES (${notes.length})\n${noteText}`)
  }

  if (tasks?.length) {
    const taskText = tasks
      .map((t) => `[${t.pillar}] ${t.title}${t.description ? ': ' + t.description : ''}`)
      .join('\n')
    sections.push(`## TASKS (${tasks.length})\n${taskText}`)
  }

  if (contentLab?.length) {
    const labText = contentLab
      .map((c) => `**${c.title}** (${c.concept})\nKeywords: ${(c.keywords ?? []).join(', ')}\n${c.generated_content?.slice(0, 400) ?? ''}`)
      .filter(Boolean)
      .join('\n\n')
    sections.push(`## CONTENT LAB (${contentLab.length})\n${labText}`)
  }

  if (sections.length === 0) {
    return NextResponse.json({ ok: true, nodes: 0, edges: 0, message: 'No content to process' })
  }

  const combinedContext = sections.join('\n\n═══\n\n').slice(0, 12000)

  // ── 3. Extract with Claude ────────────────────────────────────────────────

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: `You are building a strategic knowledge graph for Intellina AI, a company with three pillars:
- **Learning AI**: AI for K-12 (Cypher, Morpheus, Zion, NEO, Matrix), Higher Ed (AutoCampus), Professional training (RED AI Academy)
- **Enterprise AI**: Orchea.ai — no-code agentic orchestration on Databricks, T2 Framework, RAG, guardrails
- **AI Infrastructure**: TerraNine.ai (space compute), MATRIX (on-ground compute)

From ALL the content below (reports, notes, tasks, content lab), extract **15–30 strategic concepts, technologies, or organizations** that are directly relevant to Intellina's strategy. Ignore passing references or noise.

For each node:
- label: short name (2–5 words, title case, be consistent — same concept = same label)
- type: concept | technology | organization | theme
- pillar: "Learning AI" | "Enterprise AI" | "AI Infrastructure" | "General"
- description: one sentence on its relevance to Intellina
- mention_count: how many times it meaningfully appears across all sources (integer ≥ 1)

Also extract **10–20 edges**:
- source: node label
- target: node label
- relationship: related_to | enables | builds_on | competes_with | part_of
- weight: 1–5 (higher = stronger connection based on how often they co-appear)

Return ONLY valid JSON — no markdown, no explanation:
{"nodes":[{"label":"...","type":"...","pillar":"...","description":"...","mention_count":1}],"edges":[{"source":"...","target":"...","relationship":"...","weight":1}]}

--- ALL CONTENT ---
${combinedContext}
--- END CONTENT ---`,
      },
    ],
  })

  let extracted: ExtractionResult
  try {
    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    // Strip any accidental markdown code fences
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    extracted = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Failed to parse Claude extraction' }, { status: 500 })
  }

  // ── 4. Full rebuild — clear and reinsert ─────────────────────────────────
  // Delete in order: edges → report_nodes → nodes (cascade handles children)
  await supabase.from('graph_edges').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('report_nodes').delete().neq('report_id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('graph_nodes').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  // Insert nodes
  const nodeRows = extracted.nodes.map((n) => ({
    label: n.label,
    type: n.type,
    pillar: n.pillar,
    description: n.description,
    mention_count: Math.max(1, n.mention_count ?? 1),
  }))

  const { data: insertedNodes } = await supabase
    .from('graph_nodes')
    .insert(nodeRows)
    .select('id, label')

  const labelToId: Record<string, string> = {}
  for (const n of insertedNodes ?? []) {
    labelToId[n.label] = n.id
  }

  // Insert edges
  const edgeRows = extracted.edges
    .map((e) => ({
      source_id: labelToId[e.source],
      target_id: labelToId[e.target],
      relationship: e.relationship,
      weight: Math.max(1, e.weight ?? 1),
    }))
    .filter((e) => e.source_id && e.target_id && e.source_id !== e.target_id)

  if (edgeRows.length > 0) {
    await supabase.from('graph_edges').insert(edgeRows)
  }

  return NextResponse.json({
    ok: true,
    nodes: nodeRows.length,
    edges: edgeRows.length,
  })
}
