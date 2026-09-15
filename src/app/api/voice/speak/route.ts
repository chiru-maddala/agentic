import { getOpenAI, stripForSpeech, TTS_MODEL, TTS_VOICE } from '@/lib/voice'

export const maxDuration = 60

export async function POST(req: Request) {
  const { text } = await req.json() as { text?: string }
  const clean = stripForSpeech(text ?? '')

  if (!clean) return Response.json({ error: 'No text provided' }, { status: 400 })

  try {
    const openai = getOpenAI()
    const response = await openai.audio.speech.create({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: clean,
    })
    const buffer = Buffer.from(await response.arrayBuffer())
    return new Response(buffer, { headers: { 'Content-Type': 'audio/mpeg' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Speech generation failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
