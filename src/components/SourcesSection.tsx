'use client'

import { useCallback, useEffect, useState } from 'react'

type TrackedHandle = {
  id: string
  handle: string
  pillar: string | null
  active: boolean
  created_at: string
}

const PILLARS = ['Learning AI', 'Enterprise AI', 'AI Infrastructure']

const PILLAR_STYLES: Record<string, string> = {
  'Learning AI': 'bg-[#EEF6FF] text-[#2563EB] border-[#CFE2FF]',
  'Enterprise AI': 'bg-[#FEF3EC] text-[#D4622A] border-[#F5D3BC]',
  'AI Infrastructure': 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]',
}

export default function SourcesSection() {
  const [handles, setHandles] = useState<TrackedHandle[]>([])
  const [loading, setLoading] = useState(true)
  const [newHandle, setNewHandle] = useState('')
  const [newPillar, setNewPillar] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/tracked-handles')
      const data = await res.json()
      if (Array.isArray(data)) setHandles(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const addHandle = async () => {
    const handle = newHandle.trim().replace(/^@/, '')
    if (!handle) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/tracked-handles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, pillar: newPillar || null }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setHandles((prev) => [data, ...prev])
      setNewHandle('')
      setNewPillar('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add handle')
    } finally {
      setAdding(false)
    }
  }

  const toggleActive = async (h: TrackedHandle) => {
    setHandles((prev) => prev.map((x) => (x.id === h.id ? { ...x, active: !x.active } : x)))
    await fetch('/api/tracked-handles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: h.id, active: !h.active }),
    })
  }

  const remove = async (id: string) => {
    setHandles((prev) => prev.filter((h) => h.id !== id))
    await fetch(`/api/tracked-handles?id=${id}`, { method: 'DELETE' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm text-[#9CA3AF]">Loading…</span>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#FAF9F6]">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-[#1A1A1A]">Sources</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            Known Twitter/X handles checked first for relevant, recent tweets before the daily report falls back to keyword search.
          </p>
        </div>

        <div className="bg-white border border-[#E3E0D8] rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-[#E3E0D8] flex flex-col sm:flex-row gap-2">
            <input
              value={newHandle}
              onChange={(e) => setNewHandle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addHandle() }}
              placeholder="handle (e.g. sama)"
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-[#E3E0D8] bg-[#FAF9F6] focus:outline-none focus:bg-white transition-colors"
            />
            <select
              value={newPillar}
              onChange={(e) => setNewPillar(e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border border-[#E3E0D8] bg-[#FAF9F6] text-[#374151] focus:outline-none focus:bg-white transition-colors"
            >
              <option value="">No pillar</option>
              {PILLARS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button
              onClick={addHandle}
              disabled={adding || !newHandle.trim()}
              className="flex-shrink-0 text-xs font-medium px-4 py-2 rounded-lg bg-[#D4622A] hover:bg-[#C05520] text-white disabled:opacity-50 transition-colors"
            >
              {adding ? 'Adding…' : '+ Add Handle'}
            </button>
          </div>

          <div className="px-5 py-4">
            {error && (
              <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            {handles.length === 0 ? (
              <p className="text-xs text-[#9CA3AF]">No tracked handles yet. Add one above.</p>
            ) : (
              <ul className="space-y-2">
                {handles.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-sm text-[#1A1A1A] ${h.active ? '' : 'opacity-40'}`}>@{h.handle}</span>
                      {h.pillar && (
                        <span className={`text-xs border px-2 py-0.5 rounded-full flex-shrink-0 ${PILLAR_STYLES[h.pillar] ?? 'bg-[#F3F1EC] text-[#6B6B6B] border-[#E3E0D8]'}`}>
                          {h.pillar}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        onClick={() => toggleActive(h)}
                        className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
                          h.active
                            ? 'text-green-700 hover:bg-green-50'
                            : 'text-[#9CA3AF] hover:bg-[#F3F1EC]'
                        }`}
                      >
                        {h.active ? 'Active' : 'Paused'}
                      </button>
                      <button
                        onClick={() => remove(h.id)}
                        className="text-xs text-[#9CA3AF] hover:text-red-600 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
