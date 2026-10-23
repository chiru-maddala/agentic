import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'
import { generateSearchQueries, fetchRecentTweets, type TwitterSource } from '@/lib/twitter'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompt'
import { categoryForType } from '@/lib/signals'
import { stripLoneSurrogates } from '@/lib/text'
import { PILLAR_META, PILLARS, isPillar, parseReportScope, pillarsForScope, type Pillar, type ReportScope } from '@/lib/pillars'

export const maxDuration = 300

// Handles with no pillar apply to every report; the rest only to their own pillar.
async function fetchTrackedHandles(scope: ReportScope): Promise<string[]> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('tracked_handles')
    .select('handle, pillar')
    .eq('active', true)

  const wanted = pillarsForScope(scope)
  return (data ?? [])
    .filter((row) => !isPillar(row.pillar) || wanted.includes(row.pillar))
    .map((row) => row.handle)
}

// Only look at recent reports for the same scope, so "avoid repeating" coverage
// stays scoped to what that pillar's reports have already said.
async function fetchCoveredTopics(scope: ReportScope): Promise<string> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('reports')
    .select('content')
    .eq('vertical', scope)
    .order('created_at', { ascending: false })
    .limit(5)

  if (!data || data.length === 0) return ''

  // Extract the Priority Actions and section headers from each report as a compact coverage summary
  return data
    .map((r, i) => {
      const content: string = r.content ?? ''
      const headings = [...content.matchAll(/^#{1,3} .+/gm)].map((m) => m[0]).join(', ')
      const actions = content.match(/Priority Actions[^]*?(?=\n#{1,3} |$)/i)?.[0]?.slice(0, 400) ?? ''
      return `Report ${i + 1}: ${headings}\n${actions}`
    })
    .join('\n\n')
}

// ─── Cross-module signal extraction ────────────────────────────────────────
// After each report is saved, parse per-topic insights and push them into
// mirror_signals, tagged with their pillar, so the Strategic Mirror Coach has
// granular context.

// Grab the text under a `##`/`###` heading that mentions `label`, up to the next heading.
function extractSection(content: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = content.search(new RegExp(`^#{2,4}\\s.*${escaped}`, 'im'))
  if (match === -1) return ''
  const slice = content.slice(match)
  const firstNewline = slice.indexOf('\n')
  if (firstNewline === -1) return ''
  const end = slice.slice(firstNewline).search(/\n#{1,4}\s/)
  return end === -1 ? slice : slice.slice(0, firstNewline + end)
}

function extractBulletInsights(sectionText: string, maxItems = 4): string[] {
  return sectionText
    .split('\n')
    .filter((l) => /^[-*•]\s/.test(l)) // top-level bullets only; sub-bullets are "why it matters" / actions
    .map((l) => l.replace(/^[-*•]\s*/, '').replace(/\*\*/g, '').trim())
    .filter((l) => l.length > 20) // skip trivially short fragments
    .slice(0, maxItems)
}

async function extractAndInsertSignals(
  content: string,
  reportId: string,
  date: string,
  scope: ReportScope,
): Promise<void> {
  const supabase = getSupabase()
  const signals: {
    type: string
    category: ReturnType<typeof categoryForType>
    content: string
    pillar: Pillar | null
    metadata: Record<string, unknown>
  }[] = []

  // One summary signal per report (event log)
  signals.push({
    type: 'report_generated',
    category: categoryForType('report_generated'),
    content: `Daily intelligence report generated for ${date}${scope === 'All' ? '' : ` (${scope})`}`,
    pillar: scope === 'All' ? null : scope,
    metadata: { report_id: reportId, date, scope },
  })

  // Per-topic insight signals, tagged with the pillar the topic belongs to
  for (const pillar of pillarsForScope(scope)) {
    for (const topic of PILLAR_META[pillar].topics) {
      const insights = extractBulletInsights(extractSection(content, topic.label))
      for (const insight of insights) {
        signals.push({
          type: 'report_insight',
          category: categoryForType('report_insight'),
          content: insight,
          pillar,
          metadata: { report_id: reportId, date, topic: topic.label },
        })
      }
    }
  }

  // Extract "Why it matters for AI Ready School" items as strategic signals
  const whyMatters = [...content.matchAll(/Why it matters for AI Ready School[:\s]+([^\n]+)/gi)]
  for (const m of whyMatters.slice(0, 6)) {
    const text = m[1].replace(/\*\*/g, '').trim()
    if (text.length > 20) {
      signals.push({
        type: 'report_strategic',
        category: categoryForType('report_strategic'),
        content: text,
        pillar: scope === 'All' ? null : scope,
        metadata: { report_id: reportId, date, scope },
      })
    }
  }

  if (signals.length > 0) {
    await supabase.from('mirror_signals').insert(signals)
  }
}

// Priority Actions in a combined report are prefixed "[AI Education]" or
// "[Education with AI]"; a single-pillar report's actions all belong to that pillar.
function parseActionPillar(line: string, scope: ReportScope): { title: string; pillar: Pillar | 'General' } {
  const text = line.replace(/^[-*•]\s*/, '').replace(/\*\*/g, '').trim()
  const tagged = text.match(/^\[([^\]]+)\]\s*/)
  if (tagged && PILLARS.includes(tagged[1] as Pillar)) {
    return { title: text.slice(tagged[0].length).slice(0, 200), pillar: tagged[1] as Pillar }
  }
  return { title: text.slice(0, 200), pillar: scope === 'All' ? 'General' : scope }
}

// ───────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]

  const body = await req.json().catch(() => ({}))
  const scope = parseReportScope((body as { scope?: unknown })?.scope)

  const coveredTopics = await fetchCoveredTopics(scope).catch(() => '')
  const trackedHandles = await fetchTrackedHandles(scope).catch(() => [])

  let tweets: string
  let twitterSources: TwitterSource[] = []
  try {
    const queries = await generateSearchQueries(coveredTopics, scope).catch(() => null)
    const result = await fetchRecentTweets(queries ?? undefined, trackedHandles)
    tweets = result.text
    twitterSources = result.sources
  } catch {
    tweets = 'Live Twitter data unavailable. Generating from current AI landscape knowledge.'
  }

  const client = new Anthropic()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = ''
      try {
        const anthropicStream = await client.messages.stream({
          model: 'claude-sonnet-4-6',
          // A combined report covers both pillars, so it gets more room.
          max_tokens: scope === 'All' ? 10000 : 8000,
          system: stripLoneSurrogates(buildSystemPrompt(scope)),
          messages: [
            {
              role: 'user',
              content: stripLoneSurrogates(buildUserPrompt(tweets, today, coveredTopics || undefined, scope)),
            },
          ],
        })

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            const text = chunk.delta.text
            fullContent += text
            controller.enqueue(encoder.encode(text))
          }
        }

        if (fullContent) {
          const { data: report } = await supabase
            .from('reports')
            .insert({ date: today, content: fullContent, sources: twitterSources, vertical: scope })
            .select()
            .single()

          // Auto-extract tasks from Priority Actions section
          if (report) {
            // Auto-signal capture: extract per-section insights and inject into mirror_signals
            void extractAndInsertSignals(fullContent, report.id, today, scope).catch(() => {})
            const actionsMatch = fullContent.match(/Priority Actions[^]*?(?=\n#{1,3} |$)/i)
            if (actionsMatch) {
              const lines = actionsMatch[0].split('\n').filter((l) => /^[-*•]\s/.test(l.trim()))
              const taskInserts = lines.slice(0, 10).map((line) => {
                const { title, pillar } = parseActionPillar(line, scope)
                return { title, pillar, source: 'report', report_id: report.id }
              })
              if (taskInserts.length > 0) {
                await supabase.from('tasks').insert(taskInserts)
              }
            }

          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        controller.enqueue(encoder.encode(`\n\n⚠️ Error: ${msg}`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
