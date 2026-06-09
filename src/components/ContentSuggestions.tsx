'use client'

import { useEffect, useState } from 'react'

type Pillar = 'Learning AI' | 'Enterprise AI' | 'AI Infrastructure' | 'General'
type Suggestion = { title: string; concept: string; pillar?: Pillar }
type Suggestions = { blog_posts: Suggestion[]; social_posts: Suggestion[] }

const PILLARS: Pillar[] = ['Learning AI', 'Enterprise AI', 'AI Infrastructure', 'General']
const PILLAR_COLORS: Record<Pillar, string> = {
  'Learning AI': 'bg-blue-50 text-blue-700 border-blue-200',
  'Enterprise AI': 'bg-purple-50 text-purple-700 border-purple-200',
  'AI Infrastructure': 'bg-amber-50 text-amber-700 border-amber-200',
  'General': 'bg-[#F5F3EE] text-[#6B6B6B] border-[#E3E0D8]',
}

function groupByPillar(items: Suggestion[]): Record<Pillar, Suggestion[]> {
  const groups: Record<Pillar, Suggestion[]> = { 'Learning AI': [], 'Enterprise AI': [], 'AI Infrastructure': [], 'General': [] }
  for (const item of items) {
    const p = (item.pillar && groups[item.pillar] !== undefined) ? item.pillar : 'General'
    groups[p].push(item)
  }
  return groups
}

function AddedToast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-[#1A1A1A] text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
      {message}
    </div>
  )
}

export default function ContentSuggestions({
  reportId,
  onNavigateToLab,
}: {
  reportId: string
  onNavigateToLab: () => void
}) {
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [added, setAdded] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // Load saved suggestions for this report on mount
  useEffect(() => {
    setLoading(true)
    setSuggestions(null)
    setAdded({})
    fetch(`/api/reports/${reportId}/suggestions`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.blog_posts) setSuggestions(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [reportId])

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/reports/${reportId}/suggestions`, { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSuggestions(data)
    } catch {
      showToast('Failed to generate suggestions')
    } finally {
      setGenerating(false)
    }
  }

  const addToLab = async (type: 'article' | 'social', item: Suggestion) => {
    const key = `${type}-${item.title}`
    try {
      const res = await fetch('/api/content-lab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title: item.title, concept: item.concept }),
      })
      if (!res.ok) throw new Error()
      setAdded((prev) => ({ ...prev, [key]: true }))
      showToast(`Added "${item.title.slice(0, 40)}…" to Content Lab`)
    } catch {
      showToast('Failed to add to Content Lab')
    }
  }

  return (
    <div className="mt-10 border-t border-[#E3E0D8] pt-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-[#1A1A1A]">🧪 Content Lab Suggestions</h2>
          <p className="text-xs text-[#9CA3AF] mt-0.5">AI-generated content ideas based on this report&apos;s signals</p>
        </div>
        <div className="flex items-center gap-2">
          {suggestions && (
            <button onClick={onNavigateToLab} className="text-xs text-[#D4622A] hover:underline">
              Open Content Lab →
            </button>
          )}
          <button
            onClick={generate}
            disabled={generating || loading}
            className="flex items-center gap-1.5 text-xs bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            {generating ? (
              <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating…</>
            ) : suggestions ? 'Regenerate' : '✦ Generate Ideas'}
          </button>
        </div>
      </div>

      {/* Loading saved suggestions */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-[#9CA3AF] py-4">
          <span className="w-3 h-3 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin" />
          Loading suggestions…
        </div>
      )}

      {!loading && suggestions && (() => {
        const blogGroups = groupByPillar(suggestions.blog_posts)
        const socialGroups = groupByPillar(suggestions.social_posts)

        const renderCard = (item: Suggestion, type: 'article' | 'social', i: number) => {
          const key = `${type}-${item.title}`
          return (
            <div key={i} className="bg-white border border-[#E3E0D8] rounded-xl p-3.5 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A1A1A] leading-snug">{item.title}</p>
                <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">{item.concept}</p>
              </div>
              <button
                onClick={() => addToLab(type, item)}
                disabled={added[key]}
                className={`flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                  added[key]
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-[#FEF3EC] text-[#D4622A] border-[#F5D3BC] hover:bg-[#D4622A] hover:text-white'
                }`}
              >
                {added[key] ? '✓ Added' : '+ Add to Lab'}
              </button>
            </div>
          )
        }

        const renderPillarGroup = (groups: Record<Pillar, Suggestion[]>, type: 'article' | 'social') => (
          <>
            {PILLARS.map((pillar) => {
              const items = groups[pillar]
              if (items.length === 0) return null
              return (
                <div key={pillar} className="mb-4">
                  <div className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border mb-2 ${PILLAR_COLORS[pillar]}`}>
                    {pillar}
                  </div>
                  <div className="space-y-2">
                    {items.map((item, i) => renderCard(item, type, i))}
                  </div>
                </div>
              )
            })}
          </>
        )

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <h3 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider mb-3">📝 Blog Post Ideas</h3>
              {renderPillarGroup(blogGroups, 'article')}
            </div>
            <div>
              <h3 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider mb-3">📣 Social Media Post Ideas</h3>
              {renderPillarGroup(socialGroups, 'social')}
            </div>
          </div>
        )
      })()}

      {toast && <AddedToast message={toast} />}
    </div>
  )
}
