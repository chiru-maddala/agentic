import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'
import { getRelevantContext } from '@/lib/context'
import { categoryForType } from '@/lib/signals'

export const maxDuration = 300

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase()
  const { id } = await ctx.params

  const { data: task, error } = await supabase.from('tasks').select('*').eq('id', id).single()
  if (error || !task) return Response.json({ error: 'Task not found' }, { status: 404 })

  // Load business context if configured
  const { data: ctxRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'business_context')
    .single()
  const businessContext = ctxRow?.value ?? ''
  const docsContext = await getRelevantContext(
    supabase,
    [task.title, task.description, task.pillar].filter(Boolean).join(' ')
  )

  const client = new Anthropic()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = ''
      try {
        const systemPrompt = [
          `You are an expert AI research and strategy assistant. When given a task, you produce a thorough, well-structured document that completes or addresses the task.`,
          `Format your response as clean HTML (use h2, h3, p, ul, ol, strong, table tags as appropriate). Do not include <html>, <head>, or <body> tags. Be comprehensive, actionable, and professional.`,
          businessContext ? `\n\nBusiness Context:\n${businessContext}` : '',
          docsContext ? `\n\nReference Documents:\n${docsContext}` : '',
        ].join(' ')

        const anthropicStream = await client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 16000,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `Please complete the following task and produce a detailed document as the output:\n\nTask: ${task.title}${task.description ? `\n\nDetails: ${task.description}` : ''}\n\nCategory: ${task.pillar}`,
            },
          ],
        })

        for await (const chunk of anthropicStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const text = chunk.delta.text
            fullContent += text
            controller.enqueue(encoder.encode(text))
          }
        }

        if (fullContent) {
          await supabase
            .from('tasks')
            .update({ document_content: fullContent, status: 'done' })
            .eq('id', id)

          // Auto-signal capture (fire-and-forget)
          void Promise.resolve(supabase.from('mirror_signals').insert({
            type: 'task_completed',
            category: categoryForType('task_completed'),
            content: `Completed task: "${task.title}"`,
            pillar: task.pillar ?? null,
            metadata: { task_id: task.id },
          })).catch(() => {})
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Accel-Buffering': 'no' },
  })
}
