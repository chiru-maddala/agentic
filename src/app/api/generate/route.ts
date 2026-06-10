import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'
import { generateSearchQueries, fetchRecentTweets } from '@/lib/twitter'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompt'

export const maxDuration = 300

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

export async function POST() {
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]

  const coveredTopics = await fetchCoveredTopics().catch(() => '')

  let tweets: string
  try {
    const queries = await generateSearchQueries(coveredTopics).catch(() => null)
    tweets = await fetchRecentTweets(queries ?? undefined)
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
            .insert({ date: today, content: fullContent })
            .select()
            .single()

          // Auto-extract tasks from Priority Actions section
          if (report) {
            // Auto-signal capture (fire-and-forget)
            const firstHeading = fullContent.match(/^#{1,2} (.+)/m)?.[1] ?? 'Daily Intelligence Report'
            void Promise.resolve(supabase.from('mirror_signals').insert({
              type: 'report_generated',
              content: `Generated report: "${firstHeading}"`,
              pillar: null,
              metadata: { report_id: report.id, date: today },
            })).catch(() => {})
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
