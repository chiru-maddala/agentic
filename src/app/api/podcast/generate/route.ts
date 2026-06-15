import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'

export const maxDuration = 300

const SYSTEM_PROMPT = `You are the research assistant for "The AI Sense" — a podcast hosted by the CEO of Intellina AI, focused on the MARS framework: Mission for AI, Robotics and Space.

The MARS Framework covers:
- **M — Mission for AI**: Agentic AI, LLMs, enterprise AI orchestration, learning AI, AI strategy, AI governance, and real-world deployment.
- **A — Autonomy & Robotics**: Physical AI, humanoid robots, autonomous systems, embodied intelligence, robotics breakthroughs.
- **R — Reality & Infrastructure**: AI infrastructure, compute, data centers, edge AI, space-based AI, satellite networks, energy for AI.
- **S — Signals & Society**: Societal impact, policy, future of work, AI ethics, human-AI collaboration, and emerging signals from research and industry.

Your role: Generate podcast episode prep content that is sharp, timely, and conversation-ready — not academic. The host is technically sharp but speaks to a broad audience of AI-curious professionals.`

const USER_PROMPT = `Generate a podcast episode prep sheet for "The AI Sense" for today's recording session.

Structure your response as follows:

## 🎙️ The AI Sense — Episode Prep
**Date:** [Today's Date]
**Framework:** MARS (Mission for AI, Robotics and Space)

---

## 🔟 Top 10 Talking Points

For each point, provide:
- **[Number]. [Punchy Topic Title]** *(MARS pillar: M/A/R/S)*
  - **The Signal**: What's happening (1-2 sentences, specific and current)
  - **Why It Matters**: The deeper implication for AI, robotics, or space
  - **Podcast Angle**: A provocative question or framing that will spark conversation

---

## 🎤 Episode Brief & Script Guide

### Opening Hook (30 seconds)
A punchy 2-3 sentence opener the host can read verbatim or riff from.

### Recommended Episode Arc (3-act structure)
- **Act 1 – The Setup** (~5 min): Which 2-3 talking points to open with and why
- **Act 2 – The Deep Dive** (~15 min): The meatiest 3-4 points to explore
- **Act 3 – The Signal** (~5 min): The forward-looking point(s) to close on

### Closing Line
A memorable 1-2 sentence sign-off the host can adapt.

---

## ⚡ Quick Stats & Quotables
3-5 specific data points, stats, or quotes from recent AI/robotics/space news that can be dropped into conversation naturally.

---
Keep the tone: sharp, curious, slightly contrarian. This is for a CEO who thinks in systems and speaks to practitioners.`

export async function POST() {
  const supabase = getSupabase()
  const anthropic = new Anthropic()

  const today = new Date().toISOString().split('T')[0]

  const encoder = new TextEncoder()
  let fullContent = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: USER_PROMPT.replace('[Today\'s Date]', today) }],
          stream: true,
        })

        for await (const chunk of response) {
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
            const title = `The AI Sense — ${new Date(today).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`

          await supabase
            .from('podcast_episodes')
            .insert({ title, content: fullContent })
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
