'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Phase = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking' | 'error'

type CapturedEntity = {
  table: 'tasks' | 'notes' | 'mirror_thoughts' | 'meetings'
  id: string
  label: string
}

type Props = {
  pageContext: string
}

const UNDO_PATH: Record<CapturedEntity['table'], string> = {
  tasks: '/api/tasks',
  notes: '/api/notes',
  mirror_thoughts: '/api/mirror/thoughts',
  meetings: '/api/meetings',
}

const ENTITY_LABEL: Record<CapturedEntity['table'], string> = {
  tasks: 'task',
  notes: 'note',
  mirror_thoughts: 'thought',
  meetings: 'meeting',
}

const UNDO_TIMEOUT_MS = 8000

export default function VoiceCapture({ pageContext }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [transcript, setTranscript] = useState('')
  const [reply, setReply] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [created, setCreated] = useState<CapturedEntity | null>(null)
  const [undone, setUndone] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop())
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    }
  }, [])

  const reset = useCallback((delay = 0) => {
    const clear = () => {
      setPhase('idle')
      setTranscript('')
      setReply('')
      setErrorMsg('')
      setCreated(null)
      setUndone(false)
    }
    if (delay > 0) {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
      undoTimerRef.current = setTimeout(clear, delay)
    } else {
      clear()
    }
  }, [])

  const fail = useCallback((message: string) => {
    setErrorMsg(message)
    setPhase('error')
    reset(4000)
  }, [reset])

  const runPipeline = useCallback(async (blob: Blob) => {
    try {
      setPhase('transcribing')
      const form = new FormData()
      form.append('audio', blob, 'capture.webm')
      const transcribeRes = await fetch('/api/voice/transcribe', { method: 'POST', body: form })
      const transcribeData = await transcribeRes.json()
      if (!transcribeRes.ok) throw new Error(transcribeData.error ?? 'Transcription failed')
      const text = (transcribeData.text ?? '').trim()
      if (!text) throw new Error('Didn\'t catch anything — try again')
      setTranscript(text)

      setPhase('thinking')
      const commandRes = await fetch('/api/voice/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, pageContext }),
      })
      const commandData = await commandRes.json()
      if (!commandRes.ok) throw new Error(commandData.error ?? 'Command failed')
      setReply(commandData.reply ?? '')
      if (commandData.created) setCreated(commandData.created)

      setPhase('speaking')
      const speakRes = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commandData.reply ?? '' }),
      })
      if (speakRes.ok) {
        const audioBlob = await speakRes.blob()
        const url = URL.createObjectURL(audioBlob)
        const audio = new Audio(url)
        audioRef.current = audio
        audio.onended = () => {
          URL.revokeObjectURL(url)
          reset(commandData.created ? UNDO_TIMEOUT_MS : 1500)
        }
        audio.onerror = () => reset(commandData.created ? UNDO_TIMEOUT_MS : 1500)
        await audio.play()
      } else {
        reset(commandData.created ? UNDO_TIMEOUT_MS : 1500)
      }
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Something went wrong')
    }
  }, [pageContext, reset, fail])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        void runPipeline(blob)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setPhase('recording')
    } catch {
      fail('Microphone access denied')
    }
  }, [runPipeline, fail])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
  }, [])

  const handleClick = () => {
    if (phase === 'idle') { void startRecording(); return }
    if (phase === 'recording') { stopRecording(); return }
    if (phase === 'speaking') {
      audioRef.current?.pause()
      reset(created ? UNDO_TIMEOUT_MS : 0)
    }
  }

  const handleUndo = async () => {
    if (!created) return
    try {
      await fetch(`${UNDO_PATH[created.table]}/${created.id}`, { method: 'DELETE' })
      setUndone(true)
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
      undoTimerRef.current = setTimeout(() => reset(), 1500)
    } catch {
      // best-effort — leave the chip up so the user can retry
    }
  }

  const busy = phase === 'transcribing' || phase === 'thinking'
  const statusText =
    phase === 'recording' ? 'Listening… tap to stop'
    : phase === 'transcribing' ? 'Transcribing…'
    : phase === 'thinking' ? 'Thinking…'
    : phase === 'speaking' ? (reply || 'Speaking…')
    : phase === 'error' ? errorMsg
    : ''

  return (
    <>
      {(phase !== 'idle') && (
        <div className="fixed bottom-24 right-24 z-50 max-w-xs bg-white border border-[#E3E0D8] rounded-xl shadow-lg px-3.5 py-3 text-sm text-[#1A1A1A]">
          {transcript && phase !== 'recording' && (
            <p className="text-xs text-[#9CA3AF] mb-1 italic">&quot;{transcript}&quot;</p>
          )}
          <p className={phase === 'error' ? 'text-red-600' : 'text-[#1A1A1A]'}>{statusText}</p>
          {created && !undone && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-[#6B6B6B]">Saved {ENTITY_LABEL[created.table]}: {created.label}</span>
              <button
                onClick={handleUndo}
                className="text-xs font-medium text-[#D4622A] hover:text-[#C05520] underline flex-shrink-0"
              >
                Undo
              </button>
            </div>
          )}
          {created && undone && (
            <p className="mt-2 text-xs text-[#6B6B6B]">Removed.</p>
          )}
        </div>
      )}

      <button
        onClick={handleClick}
        disabled={busy}
        title={phase === 'idle' ? 'Talk to IntelliRadar' : statusText}
        className={`
          fixed bottom-24 right-6 z-50 w-14 h-14 rounded-full shadow-xl
          flex items-center justify-center transition-all duration-200
          hover:scale-105 active:scale-95 disabled:cursor-wait disabled:opacity-80
          ${phase === 'recording' ? 'bg-red-500 animate-pulse'
            : phase === 'speaking' ? 'bg-[#1A1A1A]'
            : busy ? 'bg-[#6B6B6B]'
            : phase === 'error' ? 'bg-red-500'
            : 'bg-white border border-[#E3E0D8] hover:bg-[#F5F3EE]'}
        `}
      >
        {busy ? (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg
            width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke={phase === 'idle' ? '#1A1A1A' : 'white'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>
    </>
  )
}
