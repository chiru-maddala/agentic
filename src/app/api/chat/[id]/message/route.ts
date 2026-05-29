import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'
import { buildSystemPrompt } from '@/lib/prompt'

export const maxDuration = 300

export async function POST(
  req: Request,
  ctx: RouteContext<'/api/chat/[id]/message'>
) {
  const supabase = getSupabase()
  const { id: sessionId } = await ctx.params
  const { message } = await req.json()

  // Save user message
  await supabase.from('chat_messages').insert({
    session_id: sessionId,
    role: 'user',
    content: message,
  })

  // Load all reports for context
  const { data: reports } = await supabase
    .from('reports')
    .select('date, content')
    .order('created_at', { ascending: false })
    .limit(10)

  // Load conversation history
  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  const reportsContext = reports && reports.length > 0
    ? '\n\n### Recent Intelligence Reports:\n' +
      reports.map((r) => `**Report ${r.date}:**\n${r.content}`).join('\n\n---\n\n')
    : ''

  const systemPrompt = buildSystemPrompt() +
    '\n\nYou are now acting as an interactive assistant. Answer questions, provide analysis, and help with strategy based on the intelligence reports and your knowledge.' +
    reportsContext

  const messages = (history ?? []).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const client = new Anthropic()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = ''
      try {
        const anthropicStream = await client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          system: systemPrompt,
          messages,
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
          await supabase.from('chat_messages').insert({
            session_id: sessionId,
            role: 'assistant',
            content: fullContent,
          })

          // Auto-title session from first exchange
          const { data: msgCount } = await supabase
            .from('chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('session_id', sessionId)

          if ((msgCount as unknown as number) <= 2) {
            const titleSnippet = message.slice(0, 60)
            await supabase
              .from('chat_sessions')
              .update({ title: titleSnippet })
              .eq('id', sessionId)
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
