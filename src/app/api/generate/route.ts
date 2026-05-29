import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'
import { fetchRecentTweets } from '@/lib/twitter'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompt'

export const maxDuration = 300

export async function POST() {
  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]

  let tweets: string
  try {
    tweets = await fetchRecentTweets()
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
            { role: 'user', content: buildUserPrompt(tweets, today) },
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
          await supabase.from('reports').insert({ date: today, content: fullContent })
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
