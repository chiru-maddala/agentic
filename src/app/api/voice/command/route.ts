import Anthropic from '@anthropic-ai/sdk'
import { buildVoiceSystemPrompt } from '@/lib/prompt'
import { CAPTURE_TOOLS, executeCaptureTool, type CapturedEntity } from '@/lib/actionTools'

export const maxDuration = 60

const MAX_TOOL_ITERATIONS = 3

export async function POST(req: Request) {
  const { text, pageContext } = await req.json() as { text?: string; pageContext?: string }
  const message = (text ?? '').trim()

  if (!message) return Response.json({ error: 'No text provided' }, { status: 400 })

  const systemPrompt =
    buildVoiceSystemPrompt() +
    (pageContext ? `\n\n**Current page context:** The user is currently viewing the ${pageContext}` : '')

  const client = new Anthropic()
  let messages: Anthropic.MessageParam[] = [{ role: 'user', content: message }]
  let reply = ''
  let created: CapturedEntity | undefined

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        tools: CAPTURE_TOOLS,
      })

      const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text')
      reply += textBlocks.map((b) => b.text).join(' ')

      if (response.stop_reason !== 'tool_use') break

      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of toolUseBlocks) {
        const result = await executeCaptureTool(block.name, block.input as Record<string, unknown>, { source: 'voice' })
        if (result.created) created = result.created
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result.text })
      }

      messages = [
        ...messages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ]
    }

    if (!reply) reply = created ? `Saved: ${created.label}.` : 'Sorry, I didn\'t catch that.'

    return Response.json({ reply: reply.trim(), created })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Voice command failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
