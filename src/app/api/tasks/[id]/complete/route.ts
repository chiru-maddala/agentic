import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'

export const maxDuration = 120

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase()
  const { id } = await ctx.params

  const { data: task, error } = await supabase.from('tasks').select('*').eq('id', id).single()
  if (error || !task) return Response.json({ error: 'Task not found' }, { status: 404 })

  const client = new Anthropic()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: `You are an expert AI research and strategy assistant. When given a task, you produce a thorough, well-structured document that completes or addresses the task. Format your response as clean HTML (use h2, h3, p, ul, ol, strong, table tags as appropriate). Do not include <html>, <head>, or <body> tags. Be comprehensive, actionable, and professional.`,
    messages: [
      {
        role: 'user',
        content: `Please complete the following task and produce a detailed document as the output:\n\nTask: ${task.title}${task.description ? `\n\nDetails: ${task.description}` : ''}\n\nCategory: ${task.pillar}`,
      },
    ],
  })

  const documentContent = message.content[0].type === 'text' ? message.content[0].text : ''

  const { error: updateError } = await supabase
    .from('tasks')
    .update({ document_content: documentContent, status: 'done' })
    .eq('id', id)

  if (updateError) return Response.json({ error: updateError.message }, { status: 500 })
  return Response.json({ success: true })
}
