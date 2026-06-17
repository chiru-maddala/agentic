import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120

type Params = { params: Promise<{ id: string; csId: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { csId } = await params
  const supabase = getSupabase()

  const { data: cs } = await supabase
    .from('competitor_case_studies')
    .select('title, source_url, outcome_metric, industry, function, tools, notes')
    .eq('id', csId)
    .single()

  if (!cs) return NextResponse.json({ error: 'Case study not found' }, { status: 404 })
  if (!cs.source_url) return NextResponse.json({ error: 'No source URL on this case study' }, { status: 400 })

  // Fetch the page content
  let pageText = ''
  try {
    const res = await fetch(cs.source_url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IntelliRadar/1.0)' },
      signal: AbortSignal.timeout(15000),
    })
    const html = await res.text()
    // Strip HTML tags to get readable text
    pageText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 12000)
  } catch {
    // If fetch fails, ask Claude to summarize from what we know
    pageText = `Could not fetch the page. Known info: Title: ${cs.title}, Outcome: ${cs.outcome_metric}, Industry: ${cs.industry}`
  }

  const anthropic = new Anthropic()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          stream: true,
          messages: [{
            role: 'user',
            content: `You are a competitive intelligence analyst. Below is the raw content from a case study page. Extract and present the key information in a clean, structured format.

Case Study Title: ${cs.title}
Source URL: ${cs.source_url}

Raw Page Content:
${pageText}

Present a structured summary with these sections:
## Overview
Brief 2-3 sentence summary of what the company did and achieved.

## The Challenge
What problem were they trying to solve?

## The Solution
What was implemented? What tools/technologies were used?

## Results & Outcomes
Specific measurable results (metrics, percentages, time saved, cost reduced, etc.)

## Key Takeaways
2-3 bullet points on what makes this case study relevant from a competitive intelligence perspective.

Be specific and factual. If information is not available in the page content, say so briefly rather than fabricating.`,
          }],
        })

        for await (const chunk of response) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
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

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
