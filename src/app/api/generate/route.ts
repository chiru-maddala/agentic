import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'
import { generateSearchQueries, fetchRecentTweets, type TwitterSource } from '@/lib/twitter'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompt'
import { categoryForType } from '@/lib/signals'

export const maxDuration = 300

async function fetchTrackedHandles(): Promise<string[]> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('tracked_handles')
    .select('handle')
    .eq('active', true)

  return (data ?? []).map((row) => row.handle)
}

async function fetchCoveredTopics(): Promise<string> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('reports')
    .select('content')
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
// After each report is saved, parse per-pillar insights and push them into
// mirror_signals so the Strategic Mirror Coach has granular, tagged context.

const PILLAR_PATTERNS: { pillar: string; patterns: RegExp[] }[] = [
  {
    pillar: 'Learning AI',
    patterns: [/📚.*?Learning AI Pillar/i, /Learning AI Pillar/i],
  },
  {
    pillar: 'Enterprise AI',
    patterns: [/🤖.*?Enterprise AI/i, /Enterprise AI Pillar/i, /Orchea/i],
  },
  {
    pillar: 'AI Infrastructure',
    patterns: [/☁️.*?AI Infrastructure/i, /AI Infrastructure Pillar/i],
  },
]

function extractSection(content: string, sectionPatterns: RegExp[]): string {
  for (const pattern of sectionPatterns) {
    const match = content.search(pattern)
    if (match === -1) continue
    // Grab text from section start up to next ## heading
    const slice = content.slice(match)
    const end = slice.search(/\n#{1,2} /m)
    return end === -1 ? slice : slice.slice(0, end)
  }
  return ''
}

function extractBulletInsights(sectionText: string, maxItems = 4): string[] {
  return sectionText
    .split('\n')
    .filter((l) => /^[-*•]\s/.test(l.trim()))
    .map((l) => l.replace(/^[-*•]\s*/, '').replace(/\*\*/g, '').trim())
    .filter((l) => l.length > 20) // skip trivially short fragments
    .slice(0, maxItems)
}

async function extractAndInsertPillarSignals(
  content: string,
  reportId: string,
  date: string,
): Promise<void> {
  const supabase = getSupabase()
  const signals: {
    type: string
    category: ReturnType<typeof categoryForType>
    content: string
    pillar: string | null
    metadata: Record<string, unknown>
  }[] = []

  // One summary signal per report (event log)
  signals.push({
    type: 'report_generated',
    category: categoryForType('report_generated'),
    content: `Daily intelligence report generated for ${date}`,
    pillar: null,
    metadata: { report_id: reportId, date },
  })

  // Per-pillar insight signals
  for (const { pillar, patterns } of PILLAR_PATTERNS) {
    const section = extractSection(content, patterns)
    if (!section) continue
    const insights = extractBulletInsights(section)
    for (const insight of insights) {
      signals.push({
        type: 'report_insight',
        category: categoryForType('report_insight'),
        content: insight,
        pillar,
        metadata: { report_id: reportId, date },
      })
    }
  }

  // Extract "Why it matters for Intellina" items as strategic signals
  const whyMatters = [...content.matchAll(/Why it matters for Intellina[:\s]+([^\n]+)/gi)]
  for (const m of whyMatters.slice(0, 6)) {
    const text = m[1].replace(/\*\*/g, '').trim()
    if (text.length > 20) {
      signals.push({
        type: 'report_strategic',
        category: categoryForType('report_strategic'),
        content: text,
        pillar: null,
        metadata: { report_id: reportId, date },
      })
    }
  }

  if (signals.length > 0) {
    await supabase.from('mirror_signals').insert(signals)
  }
}

// ───────────────────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]

  const coveredTopics = await fetchCoveredTopics().catch(() => '')
  const trackedHandles = await fetchTrackedHandles().catch(() => [])

  let tweets: string
  let twitterSources: TwitterSource[] = []
  try {
    const queries = await generateSearchQueries(coveredTopics).catch(() => null)
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
          max_tokens: 8000,
          system: buildSystemPrompt(),
          messages: [
            { role: 'user', content: buildUserPrompt(tweets, today, coveredTopics || undefined) },
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
            .insert({ date: today, content: fullContent, sources: twitterSources })
            .select()
            .single()

          // Auto-extract tasks from Priority Actions section
          if (report) {
            // Auto-signal capture: extract per-pillar insights and inject into mirror_signals
            void extractAndInsertPillarSignals(fullContent, report.id, today).catch(() => {})
            const actionsMatch = fullContent.match(/Priority Actions[^]*?(?=\n#{1,3} |$)/i)
            if (actionsMatch) {
              const lines = actionsMatch[0].split('\n').filter((l) => /^[-*•]\s/.test(l.trim()))
              const pillarMap: Record<string, string> = {
                'learning': 'Learning AI',
                'cypher': 'Learning AI',
                'morpheus': 'Learning AI',
                'autocampus': 'Learning AI',
                'orchea': 'Enterprise AI',
                'enterprise': 'Enterprise AI',
                'databricks': 'Enterprise AI',
                'terranine': 'AI Infrastructure',
                'matrix': 'AI Infrastructure',
                'infrastructure': 'AI Infrastructure',
              }
              const taskInserts = lines.slice(0, 10).map((line) => {
                const title = line.replace(/^[-*•]\s*/, '').trim().slice(0, 200)
                const lower = title.toLowerCase()
                const pillar = Object.entries(pillarMap).find(([k]) => lower.includes(k))?.[1] ?? 'General'
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
