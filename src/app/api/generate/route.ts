import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'
import { fetchRecentTweets } from '@/lib/twitter'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompt'

export const maxDuration = 60

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

      const anthropicStream = await client.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
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

      await supabase.from('reports').insert({ date: today, content: fullContent })

      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
