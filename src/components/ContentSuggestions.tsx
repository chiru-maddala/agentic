'use client'

import { useState } from 'react'

type Suggestion = { title: string; concept: string }
type Suggestions = { blog_posts: Suggestion[]; social_posts: Suggestion[] }

function AddedToast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-[#1A1A1A] text-white text-sm px-4 py-2.5 rounded-xl shadow-lg animate-fade-in">
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
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/${reportId}/suggestions`, { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSuggestions(data)
    } catch (e) {
      showToast('Failed to generate suggestions')
    } finally {
      setLoading(false)
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
          <p className="text-xs text-[#9CA3AF] mt-0.5">AI-generated content ideas based on today&apos;s signals</p>
        </div>
        <div className="flex items-center gap-2">
          {suggestions && (
            <button
              onClick={onNavigateToLab}
              className="text-xs text-[#D4622A] hover:underline"
            >
              Open Content Lab →
            </button>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            {loading ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              suggestions ? 'Regenerate' : '✦ Generate Ideas'
            )}
          </button>
        </div>
      </div>

      {suggestions && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Blog Posts */}
          <div>
            <h3 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider mb-3">📝 Blog Post Ideas</h3>
            <div className="space-y-2">
              {suggestions.blog_posts.map((item, i) => {
                const key = `article-${item.title}`
                return (
                  <div
                    key={i}
                    className="bg-white border border-[#E3E0D8] rounded-xl p-3.5 flex items-start gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1A1A1A] leading-snug">{item.title}</p>
                      <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">{item.concept}</p>
                    </div>
                    <button
                      onClick={() => addToLab('article', item)}
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
              })}
            </div>
          </div>

          {/* Social Posts */}
          <div>
            <h3 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider mb-3">📣 Social Media Post Ideas</h3>
            <div className="space-y-2">
              {suggestions.social_posts.map((item, i) => {
                const key = `social-${item.title}`
                return (
                  <div
                    key={i}
                    className="bg-white border border-[#E3E0D8] rounded-xl p-3.5 flex items-start gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1A1A1A] leading-snug">{item.title}</p>
                      <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">{item.concept}</p>
                    </div>
                    <button
                      onClick={() => addToLab('social', item)}
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
              })}
            </div>
          </div>
        </div>
      )}

      {toast && <AddedToast message={toast} />}
    </div>
  )
}
