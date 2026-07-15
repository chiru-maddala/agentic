import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'
import { getRelevantContext } from '@/lib/context'

export const maxDuration = 300

export async function POST(
  req: Request,
  ctx: RouteContext<'/api/mirror/pillar-goals/[id]/plan-document'>
) {
  const supabase = getSupabase()
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const feedback: string | undefined = body?.feedback

  const { data: goal, error } = await supabase
    .from('mirror_pillar_goals')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !goal) return Response.json({ error: 'Goal not found' }, { status: 404 })

  const { data: ctxRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'business_context')
    .single()
  const businessContext = ctxRow?.value ?? ''
  const docsContext = await getRelevantContext(
    supabase,
    [goal.name, goal.pillar].filter(Boolean).join(' ')
  )

  const client = new Anthropic()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = ''
      try {
        const systemPrompt = [
          `You are an expert strategic planner helping Chiranjeevi (Chiru), Co-founder & CEO of Intellina AI, hit a specific measurable goal.`,
          `When given a goal, you produce a thorough, well-structured plan document — concrete phases, milestones, and the reasoning behind them. Not generic advice: name real levers specific to this goal and pillar.`,
          `Format your response as clean HTML (use h2, h3, p, ul, ol, strong, table tags as appropriate). Do not include <html>, <head>, or <body> tags.`,
          businessContext ? `\n\nBusiness Context:\n${businessContext}` : '',
          docsContext ? `\n\nReference Documents:\n${docsContext}` : '',
        ].join(' ')

        const userPrompt = feedback
          ? `Here is the current plan document for this goal:\n\n${goal.plan_document ?? ''}\n\nRevise it based on this feedback: ${feedback}\n\nProduce the full revised document (not just the changes).`
          : `Produce a plan document for this goal:\n\nGoal: ${goal.name}\nPillar: ${goal.pillar}\nTarget: ${goal.target_number ?? 'not set'} by ${goal.target_date ?? 'not set'}\nCurrent progress: ${goal.current_value ?? 'not logged yet'}`

        const anthropicStream = await client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
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
            .from('mirror_pillar_goals')
            .update({ plan_document: fullContent, plan_approved_at: null })
            .eq('id', id)
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
