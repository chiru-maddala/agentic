import { getOpenAI, TRANSCRIBE_MODEL } from '@/lib/voice'

export const maxDuration = 60

export async function POST(req: Request) {
  const formData = await req.formData()
  const audio = formData.get('audio')

  if (!(audio instanceof File) || audio.size === 0) {
    return Response.json({ error: 'No audio provided' }, { status: 400 })
  }

  try {
    const openai = getOpenAI()
    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: TRANSCRIBE_MODEL,
    })
    return Response.json({ text: transcription.text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
