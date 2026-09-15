import OpenAI from 'openai'

let client: OpenAI | null = null

export function getOpenAI() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  }
  return client
}

export const TRANSCRIBE_MODEL = 'whisper-1'
export const TTS_MODEL = 'gpt-4o-mini-tts'
export const TTS_VOICE = 'alloy'

// Strip markdown/emoji before sending text to TTS so it isn't read aloud literally
export function stripForSpeech(text: string): string {
  return text
    .replace(/[#*_`~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}
