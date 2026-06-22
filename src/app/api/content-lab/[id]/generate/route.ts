import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'
import { getContextDocsText } from '@/lib/context'

export const maxDuration = 300

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = getSupabase()

  // Fetch the content lab item
  const { data: item, error: fetchErr } = await supabase
    .from('content_lab')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchErr || !item) return Response.json({ error: 'Not found' }, { status: 404 })

  // Fetch business context
  const { data: settings } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['business_context'])
  const businessCtxRaw = settings?.find((s: { key: string }) => s.key === 'business_context')?.value ?? ''
  const docsContext = await getContextDocsText(supabase)
  const businessCtx = [businessCtxRaw, docsContext ? `Reference Documents:\n${docsContext}` : '']
    .filter(Boolean)
    .join('\n\n')

  const client = new Anthropic()

  let systemPrompt = ''
  let userPrompt = ''

  if (item.type === 'article') {
    const keywords = Array.isArray(item.keywords) && item.keywords.length > 0
      ? `Target keywords: ${item.keywords.join(', ')}.`
      : ''
    const wordTarget = item.word_count ? `Target word count: approximately ${item.word_count} words.` : ''
    systemPrompt = `You are an expert B2B content writer for an AI company. Write authoritative, insightful blog articles. Use clear headings (##), subheadings (###), bullet points where helpful. Output well-formatted Markdown only — no preamble or commentary.${businessCtx ? `\n\nBusiness context:\n${businessCtx}` : ''}`
    userPrompt = `Write a blog article about: "${item.title}"\n\nConcept: ${item.concept}\n${wordTarget}\n${keywords}`
  } else {
    // social post
    const platform = item.platform ?? 'LinkedIn'
    const platformGuide: Record<string, string> = {
      LinkedIn: 'Professional tone, 150-300 words, use line breaks for readability, 3-5 relevant hashtags, end with a thought-provoking question or CTA.',
      Instagram: 'Engaging visual-first caption, 100-200 words, enthusiastic but authentic tone, 10-15 relevant hashtags, use emojis sparingly.',
      YouTube: 'Video script outline or description, 200-400 words, hook in first 2 sentences, structured sections (Intro / Main Points / CTA), SEO-friendly.',
    }
    const guide = platformGuide[platform] ?? platformGuide.LinkedIn
    systemPrompt = `You are a social media expert for an AI company. Create high-performing ${platform} content. ${guide}${businessCtx ? `\n\nBusiness context:\n${businessCtx}` : ''}`
    userPrompt = `Create a ${platform} post about: "${item.title}"\n\nConcept: ${item.concept}\n\nAlso provide a brief "Creative Direction" section after the post with notes on imagery, tone, and posting timing.`
  }

  // Stream response
  const encoder = new TextEncoder()
  let full = ''

  const stream = new ReadableStream({
    async start(controller) {
      const msgStream = client.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })

      for await (const chunk of msgStream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          full += chunk.delta.text
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }

      // Save generated content
      await supabase
        .from('content_lab')
        .update({ generated_content: full, status: 'ready' })
        .eq('id', id)

      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Accel-Buffering': 'no' },
  })
}
