'use client'

import { useEffect, useState, useCallback } from 'react'

const PILLARS = ['Learning AI', 'Enterprise AI', 'AI Infrastructure']

const PILLAR_COLORS: Record<string, string> = {
  'Learning AI': 'bg-blue-50 text-blue-700 border-blue-200',
  'Enterprise AI': 'bg-purple-50 text-purple-700 border-purple-200',
  'AI Infrastructure': 'bg-amber-50 text-amber-700 border-amber-200',
}

type Competitor = {
  id: string
  name: string
  website: string
  description?: string
  founding_year?: number
  hq?: string
  funding_stage?: string
  total_raised?: string
  team_size?: string
  pricing_model?: string
  positioning?: string
  target_industries?: string[]
  target_company_size?: string[]
  geographies?: string[]
  tech_stack?: string[]
  differentiators?: string[]
  content_themes?: string[]
  pillars?: string[]
  share_id?: string
  last_refreshed_at?: string
  created_at: string
}

type Client = {
  id: string
  competitor_id: string
  name: string
  industry?: string
  company_size?: string
  geography?: string
  notes?: string
}

type CaseStudy = {
  id: string
  competitor_id: string
  client_id?: string
  title: string
  pillar?: string
  industry?: string
  function?: string
  tools?: string[]
  outcome_metric?: string
  source_url?: string
  notes?: string
  competitor_clients?: { name: string } | null
}

// ── Tag input helper ──────────────────────────────────────────────────────────
function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('')
  const add = () => {
    const trimmed = input.trim()
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed])
    setInput('')
  }
  return (
    <div className="flex flex-wrap gap-1.5 p-2 border border-[#E3E0D8] rounded-lg bg-white min-h-[40px]">
      {value.map(v => (
        <span key={v} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-[#F5F3EE] border border-[#E3E0D8] rounded text-[#374151]">
          {v}
          <button onClick={() => onChange(value.filter(x => x !== v))} className="text-[#9CA3AF] hover:text-red-500">×</button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
        onBlur={add}
        placeholder={placeholder ?? 'Type and press Enter'}
        className="flex-1 min-w-[120px] text-xs outline-none bg-transparent text-[#1A1A1A] placeholder-[#C4BFB5]"
      />
    </div>
  )
}

// ── Add Competitor Modal ──────────────────────────────────────────────────────
function AddCompetitorModal({ onClose, onAdded }: { onClose: () => void; onAdded: (c: Competitor) => void }) {
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim() || !website.trim()) return
    setSaving(true)
    const res = await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), website: website.trim() }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return
    onAdded(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-[#E3E0D8] p-6 w-full max-w-md shadow-xl">
        <h2 className="text-base font-semibold text-[#1A1A1A] mb-4">Add Competitor</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#6B6B6B] mb-1 block">Company Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Accenture AI"
              className="w-full text-sm border border-[#E3E0D8] rounded-lg px-3 py-2 outline-none focus:border-[#D4622A] text-[#1A1A1A]" />
          </div>
          <div>
            <label className="text-xs text-[#6B6B6B] mb-1 block">Website</label>
            <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..."
              className="w-full text-sm border border-[#E3E0D8] rounded-lg px-3 py-2 outline-none focus:border-[#D4622A] text-[#1A1A1A]" />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="text-sm px-4 py-2 text-[#6B6B6B] hover:text-[#1A1A1A]">Cancel</button>
          <button onClick={submit} disabled={saving || !name.trim() || !website.trim()}
            className="text-sm px-4 py-2 bg-[#D4622A] text-white rounded-lg disabled:opacity-50 hover:bg-[#C4531B]">
            {saving ? 'Adding…' : 'Add Competitor'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Competitor List ───────────────────────────────────────────────────────────
function CompetitorList({ competitors, onSelect, onAdded }: {
  competitors: Competitor[]
  onSelect: (c: Competitor) => void
  onAdded: (c: Competitor) => void
}) {
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[#1A1A1A]">Competitive Intelligence</h1>
          <p className="text-sm text-[#6B6B6B] mt-0.5">{competitors.length} {competitors.length === 1 ? 'competitor' : 'competitors'} tracked</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-sm px-4 py-2 bg-[#D4622A] text-white rounded-lg hover:bg-[#C4531B]">
          <span className="text-base leading-none">+</span> Add Competitor
        </button>
      </div>

      {competitors.length === 0 ? (
        <div className="text-center py-16 text-[#9CA3AF]">
          <p className="text-sm">No competitors yet.</p>
          <p className="text-xs mt-1">Add one to start tracking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {competitors.map(c => (
            <button key={c.id} onClick={() => onSelect(c)}
              className="w-full text-left bg-white border border-[#E3E0D8] rounded-xl p-5 hover:border-[#D4622A]/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1A1A1A]">{c.name}</p>
                  <p className="text-xs text-[#D4622A] mt-0.5 truncate">{c.website}</p>
                  {c.description && <p className="text-sm text-[#6B6B6B] mt-1.5 line-clamp-2">{c.description}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end flex-shrink-0 max-w-[200px]">
                  {(c.pillars ?? []).map(p => (
                    <span key={p} className={`text-xs px-2 py-0.5 rounded-full border ${PILLAR_COLORS[p] ?? ''}`}>{p}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 mt-3 text-xs text-[#9CA3AF]">
                {c.hq && <span>{c.hq}</span>}
                {c.funding_stage && <span>{c.funding_stage}</span>}
                {c.total_raised && <span>{c.total_raised}</span>}
                {c.last_refreshed_at && <span>Refreshed {new Date(c.last_refreshed_at).toLocaleDateString()}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {showAdd && <AddCompetitorModal onClose={() => setShowAdd(false)} onAdded={onAdded} />}
    </div>
  )
}

// ── Fetch Panel (split screen) ────────────────────────────────────────────────
function FetchPanel({ cs, competitorId, onClose }: { cs: CaseStudy; competitorId: string; onClose: () => void }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setContent('')
    setLoading(true)
    fetch(`/api/competitors/${competitorId}/case-studies/${cs.id}/fetch`, { method: 'POST' })
      .then(async res => {
        if (!res.body) { setLoading(false); return }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          setContent(prev => prev + decoder.decode(value))
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [cs.id, competitorId])

  return (
    <div className="flex flex-col h-full border-l border-[#E3E0D8] bg-white">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#E3E0D8] flex-shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#1A1A1A] truncate">{cs.title}</p>
          {cs.source_url && (
            <a href={cs.source_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-[#D4622A] hover:underline truncate block">{cs.source_url}</a>
          )}
        </div>
        <button onClick={onClose} className="ml-3 text-[#9CA3AF] hover:text-[#1A1A1A] text-lg leading-none flex-shrink-0">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && !content && (
          <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
            <span className="w-3 h-3 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin" />
            Fetching case study…
          </div>
        )}
        {content && (
          <div className="prose prose-sm max-w-none
            prose-headings:text-[#1A1A1A] prose-headings:font-semibold prose-headings:text-sm
            prose-p:text-[#374151] prose-p:leading-relaxed prose-p:text-sm
            prose-strong:text-[#1A1A1A]
            prose-li:text-[#374151] prose-li:text-sm
            prose-h2:mt-5 prose-h2:mb-2">
            {content.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <h2 key={i} className="text-sm font-semibold text-[#1A1A1A] mt-5 mb-2">{line.replace('## ', '')}</h2>
              if (line.startsWith('- ')) return <li key={i} className="text-sm text-[#374151] ml-4 list-disc">{line.replace('- ', '')}</li>
              if (line.trim() === '') return <div key={i} className="h-2" />
              return <p key={i} className="text-sm text-[#374151] leading-relaxed">{line}</p>
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Competitor Detail ─────────────────────────────────────────────────────────
function CompetitorDetail({ competitor: initial, onBack, onUpdated, onDeleted }: {
  competitor: Competitor
  onBack: () => void
  onUpdated: (c: Competitor) => void
  onDeleted: (id: string) => void
}) {
  const [competitor, setCompetitor] = useState(initial)
  const [tab, setTab] = useState<'profile' | 'clients' | 'case-studies'>('profile')
  const [clients, setClients] = useState<Client[]>([])
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [researching, setResearching] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(competitor)
  const [saving, setSaving] = useState(false)
  const [fetchPanel, setFetchPanel] = useState<CaseStudy | null>(null)

  // Client form
  const [showClientForm, setShowClientForm] = useState(false)
  const [clientDraft, setClientDraft] = useState<Partial<Client>>({})
  const [savingClient, setSavingClient] = useState(false)

  // Case study form
  const [showCsForm, setShowCsForm] = useState(false)
  const [csDraft, setCsDraft] = useState<Partial<CaseStudy>>({ tools: [] })
  const [savingCs, setSavingCs] = useState(false)

  const loadClients = useCallback(async () => {
    const res = await fetch(`/api/competitors/${competitor.id}/clients`)
    if (res.ok) setClients(await res.json())
  }, [competitor.id])

  const loadCaseStudies = useCallback(async () => {
    const res = await fetch(`/api/competitors/${competitor.id}/case-studies`)
    if (res.ok) setCaseStudies(await res.json())
  }, [competitor.id])

  useEffect(() => { loadClients(); loadCaseStudies() }, [loadClients, loadCaseStudies])

  const refresh = async () => {
    setRefreshing(true)
    const res = await fetch(`/api/competitors/${competitor.id}/refresh`, { method: 'POST' })
    if (res.ok) {
      const updated = await res.json()
      setCompetitor(updated)
      setDraft(updated)
      onUpdated(updated)
    }
    setRefreshing(false)
  }

  const research = async () => {
    setResearching(true)
    const res = await fetch(`/api/competitors/${competitor.id}/research`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setClients(data.clients ?? [])
      setCaseStudies(data.case_studies ?? [])
      // Switch to clients tab to show results
      setTab('clients')
    }
    setResearching(false)
  }

  const share = () => {
    const url = `${window.location.origin}/share/competitor/${competitor.share_id}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const saveProfile = async () => {
    setSaving(true)
    const res = await fetch(`/api/competitors/${competitor.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    if (res.ok) {
      const updated = await res.json()
      setCompetitor(updated)
      onUpdated(updated)
      setEditing(false)
    }
    setSaving(false)
  }

  const deleteCompetitor = async () => {
    if (!confirm(`Delete ${competitor.name}? This cannot be undone.`)) return
    await fetch(`/api/competitors/${competitor.id}`, { method: 'DELETE' })
    onDeleted(competitor.id)
    onBack()
  }

  const addClient = async () => {
    if (!clientDraft.name?.trim()) return
    setSavingClient(true)
    const res = await fetch(`/api/competitors/${competitor.id}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clientDraft),
    })
    if (res.ok) { await loadClients(); setShowClientForm(false); setClientDraft({}) }
    setSavingClient(false)
  }

  const deleteClient = async (clientId: string) => {
    await fetch(`/api/competitors/${competitor.id}/clients?clientId=${clientId}`, { method: 'DELETE' })
    setClients(prev => prev.filter(c => c.id !== clientId))
  }

  const addCaseStudy = async () => {
    if (!csDraft.title?.trim()) return
    setSavingCs(true)
    const res = await fetch(`/api/competitors/${competitor.id}/case-studies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(csDraft),
    })
    if (res.ok) { await loadCaseStudies(); setShowCsForm(false); setCsDraft({ tools: [] }) }
    setSavingCs(false)
  }

  const deleteCaseStudy = async (csId: string) => {
    await fetch(`/api/competitors/${competitor.id}/case-studies?csId=${csId}`, { method: 'DELETE' })
    setCaseStudies(prev => prev.filter(cs => cs.id !== csId))
    if (fetchPanel?.id === csId) setFetchPanel(null)
  }

  return (
    <div className={`flex gap-0 ${fetchPanel ? 'divide-x divide-[#E3E0D8]' : ''}`}>
      {/* Main content */}
      <div className={`flex-1 min-w-0 ${fetchPanel ? 'pr-0' : ''}`}>
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={onBack} className="text-sm text-[#6B6B6B] hover:text-[#1A1A1A] flex items-center gap-1">
          ← Back
        </button>
        <span className="text-[#E3E0D8]">/</span>
        <span className="text-sm font-medium text-[#1A1A1A]">{competitor.name}</span>
        <div className="ml-auto flex gap-2 flex-wrap">
          <button onClick={share}
            className="text-sm px-3 py-1.5 border border-[#E3E0D8] rounded-lg text-[#6B6B6B] hover:border-[#D4622A]/40 hover:text-[#D4622A] transition-colors">
            {copied ? '✓ Copied' : 'Share'}
          </button>
          <button onClick={refresh} disabled={refreshing || researching}
            className="text-sm px-3 py-1.5 border border-[#E3E0D8] rounded-lg text-[#6B6B6B] hover:border-[#D4622A]/40 hover:text-[#D4622A] transition-colors disabled:opacity-50">
            {refreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
          <button onClick={research} disabled={researching || refreshing}
            className="text-sm px-3 py-1.5 bg-[#D4622A] text-white rounded-lg hover:bg-[#C4531B] disabled:opacity-50 flex items-center gap-1.5 transition-colors">
            {researching ? (
              <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Researching…</>
            ) : (
              <>🔍 Research</>
            )}
          </button>
          <button onClick={deleteCompetitor}
            className="text-sm px-3 py-1.5 border border-red-200 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
            Delete
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="flex items-start gap-3 mb-1 flex-wrap">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">{competitor.name}</h1>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {(competitor.pillars ?? []).map(p => (
            <span key={p} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${PILLAR_COLORS[p] ?? ''}`}>{p}</span>
          ))}
        </div>
      </div>
      <a href={competitor.website} target="_blank" rel="noopener noreferrer"
        className="text-sm text-[#D4622A] hover:underline">{competitor.website}</a>
      {competitor.last_refreshed_at && (
        <p className="text-xs text-[#9CA3AF] mt-1">Last refreshed {new Date(competitor.last_refreshed_at).toLocaleString()}</p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mt-6 border-b border-[#E3E0D8]">
        {(['profile', 'clients', 'case-studies'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-sm px-4 py-2 capitalize transition-colors ${tab === t ? 'border-b-2 border-[#D4622A] text-[#D4622A] font-medium' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'}`}>
            {t === 'case-studies' ? `Case Studies (${caseStudies.length})` : t === 'clients' ? `Clients (${clients.length})` : 'Profile'}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="mt-6 space-y-6">
          <div className="flex justify-end">
            {editing ? (
              <div className="flex gap-2">
                <button onClick={() => { setEditing(false); setDraft(competitor) }}
                  className="text-sm px-3 py-1.5 text-[#6B6B6B] hover:text-[#1A1A1A]">Cancel</button>
                <button onClick={saveProfile} disabled={saving}
                  className="text-sm px-4 py-1.5 bg-[#D4622A] text-white rounded-lg disabled:opacity-50 hover:bg-[#C4531B]">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : (
              <button onClick={() => setEditing(true)}
                className="text-sm px-3 py-1.5 border border-[#E3E0D8] rounded-lg text-[#6B6B6B] hover:border-[#D4622A]/40">
                Edit Profile
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-4">
              {[
                { label: 'Description', key: 'description', type: 'textarea' },
                { label: 'Positioning', key: 'positioning', type: 'textarea' },
                { label: 'HQ', key: 'hq' },
                { label: 'Founded', key: 'founding_year' },
                { label: 'Funding Stage', key: 'funding_stage' },
                { label: 'Total Raised', key: 'total_raised' },
                { label: 'Team Size', key: 'team_size' },
                { label: 'Pricing Model', key: 'pricing_model' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-[#6B6B6B] mb-1 block">{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea value={((draft as unknown) as Record<string, string>)[f.key] ?? ''} rows={3}
                      onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                      className="w-full text-sm border border-[#E3E0D8] rounded-lg px-3 py-2 outline-none focus:border-[#D4622A] text-[#1A1A1A] resize-none" />
                  ) : (
                    <input value={((draft as unknown) as Record<string, string>)[f.key] ?? ''}
                      onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                      className="w-full text-sm border border-[#E3E0D8] rounded-lg px-3 py-2 outline-none focus:border-[#D4622A] text-[#1A1A1A]" />
                  )}
                </div>
              ))}

              <div>
                <label className="text-xs text-[#6B6B6B] mb-1 block">Pillars (compete in)</label>
                <div className="flex gap-2 flex-wrap">
                  {PILLARS.map(p => (
                    <button key={p} type="button"
                      onClick={() => setDraft(d => ({
                        ...d,
                        pillars: (d.pillars ?? []).includes(p)
                          ? (d.pillars ?? []).filter(x => x !== p)
                          : [...(d.pillars ?? []), p]
                      }))}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${(draft.pillars ?? []).includes(p) ? PILLAR_COLORS[p] : 'border-[#E3E0D8] text-[#6B6B6B]'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {[
                { label: 'Target Industries', key: 'target_industries' },
                { label: 'Target Company Size', key: 'target_company_size' },
                { label: 'Geographies', key: 'geographies' },
                { label: 'Tech Stack', key: 'tech_stack' },
                { label: 'Differentiators', key: 'differentiators' },
                { label: 'Content Themes', key: 'content_themes' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-[#6B6B6B] mb-1 block">{f.label}</label>
                  <TagInput
                    value={(draft as unknown as Record<string, string[]>)[f.key] ?? []}
                    onChange={v => setDraft(d => ({ ...d, [f.key]: v }))}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {competitor.description && (
                <p className="text-[#374151] leading-relaxed">{competitor.description}</p>
              )}
              {competitor.positioning && (
                <div className="bg-[#FEF3EC] border border-[#D4622A]/20 rounded-lg p-4">
                  <p className="text-xs text-[#D4622A] font-medium mb-1">Positioning</p>
                  <p className="text-sm text-[#374151]">{competitor.positioning}</p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'HQ', value: competitor.hq },
                  { label: 'Founded', value: competitor.founding_year },
                  { label: 'Funding Stage', value: competitor.funding_stage },
                  { label: 'Total Raised', value: competitor.total_raised },
                  { label: 'Team Size', value: competitor.team_size },
                  { label: 'Pricing', value: competitor.pricing_model },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} className="bg-white border border-[#E3E0D8] rounded-lg p-3">
                    <p className="text-xs text-[#9CA3AF] uppercase tracking-wide mb-1">{f.label}</p>
                    <p className="text-sm font-medium text-[#1A1A1A]">{f.value}</p>
                  </div>
                ))}
              </div>

              {[
                { label: 'Target Industries', values: competitor.target_industries },
                { label: 'Target Company Size', values: competitor.target_company_size },
                { label: 'Geographies', values: competitor.geographies },
                { label: 'Tech Stack', values: competitor.tech_stack },
                { label: 'Differentiators', values: competitor.differentiators },
                { label: 'Content Themes', values: competitor.content_themes },
              ].filter(s => s.values?.length).map(s => (
                <div key={s.label}>
                  <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">{s.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {s.values!.map(v => (
                      <span key={v} className="text-sm px-3 py-1 bg-white border border-[#E3E0D8] rounded-full text-[#374151]">{v}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clients tab */}
      {tab === 'clients' && (
        <div className="mt-6 space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowClientForm(true)}
              className="text-sm px-4 py-2 bg-[#D4622A] text-white rounded-lg hover:bg-[#C4531B]">
              + Add Client
            </button>
          </div>

          {showClientForm && (
            <div className="bg-white border border-[#E3E0D8] rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">New Client</h3>
              {[
                { label: 'Client Name *', key: 'name', placeholder: 'e.g. Goldman Sachs' },
                { label: 'Industry', key: 'industry', placeholder: 'e.g. Financial Services' },
                { label: 'Company Size', key: 'company_size', placeholder: 'e.g. Enterprise' },
                { label: 'Geography', key: 'geography', placeholder: 'e.g. North America' },
                { label: 'Notes', key: 'notes', placeholder: 'Any additional context' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-[#6B6B6B] mb-1 block">{f.label}</label>
                  <input value={(clientDraft as Record<string, string>)[f.key] ?? ''}
                    onChange={e => setClientDraft(d => ({ ...d, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full text-sm border border-[#E3E0D8] rounded-lg px-3 py-2 outline-none focus:border-[#D4622A] text-[#1A1A1A]" />
                </div>
              ))}
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => { setShowClientForm(false); setClientDraft({}) }} className="text-sm px-3 py-1.5 text-[#6B6B6B]">Cancel</button>
                <button onClick={addClient} disabled={savingClient || !clientDraft.name?.trim()}
                  className="text-sm px-4 py-1.5 bg-[#D4622A] text-white rounded-lg disabled:opacity-50">
                  {savingClient ? 'Saving…' : 'Add'}
                </button>
              </div>
            </div>
          )}

          {clients.length === 0 && !showClientForm && (
            <p className="text-sm text-[#9CA3AF] text-center py-10">No clients yet. Add named customers of this competitor.</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {clients.map(c => (
              <div key={c.id} className="bg-white border border-[#E3E0D8] rounded-lg p-4 group relative">
                <button onClick={() => deleteClient(c.id)}
                  className="absolute top-3 right-3 text-xs text-[#C4BFB5] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                <p className="font-medium text-[#1A1A1A] pr-5">{c.name}</p>
                <div className="flex gap-3 mt-1 flex-wrap">
                  {c.industry && <span className="text-xs text-[#6B6B6B]">{c.industry}</span>}
                  {c.company_size && <span className="text-xs text-[#6B6B6B]">{c.company_size}</span>}
                  {c.geography && <span className="text-xs text-[#6B6B6B]">{c.geography}</span>}
                </div>
                {c.notes && <p className="text-xs text-[#9CA3AF] mt-1">{c.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Case Studies tab */}
      {tab === 'case-studies' && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3 justify-end">
            <button onClick={() => setShowCsForm(true)}
              className="text-sm px-4 py-2 bg-[#D4622A] text-white rounded-lg hover:bg-[#C4531B]">
              + Add Case Study
            </button>
          </div>

          {showCsForm && (
            <div className="bg-white border border-[#E3E0D8] rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">New Case Study</h3>
              <div>
                <label className="text-xs text-[#6B6B6B] mb-1 block">Title *</label>
                <input value={csDraft.title ?? ''} onChange={e => setCsDraft(d => ({ ...d, title: e.target.value }))}
                  placeholder="e.g. 30% faster case resolutions at Adobe"
                  className="w-full text-sm border border-[#E3E0D8] rounded-lg px-3 py-2 outline-none focus:border-[#D4622A] text-[#1A1A1A]" />
              </div>

              <div>
                <label className="text-xs text-[#6B6B6B] mb-1 block">Pillar</label>
                <div className="flex gap-2 flex-wrap">
                  {PILLARS.map(p => (
                    <button key={p} type="button"
                      onClick={() => setCsDraft(d => ({ ...d, pillar: d.pillar === p ? undefined : p }))}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${csDraft.pillar === p ? PILLAR_COLORS[p] : 'border-[#E3E0D8] text-[#6B6B6B]'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-[#6B6B6B] mb-1 block">Link to Client (optional)</label>
                <select value={csDraft.client_id ?? ''} onChange={e => setCsDraft(d => ({ ...d, client_id: e.target.value || undefined }))}
                  className="w-full text-sm border border-[#E3E0D8] rounded-lg px-3 py-2 outline-none focus:border-[#D4622A] text-[#1A1A1A] bg-white">
                  <option value="">— Anonymous / not linked —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {[
                { label: 'Industry', key: 'industry', placeholder: 'e.g. Healthcare' },
                { label: 'Function', key: 'function', placeholder: 'e.g. Customer Service' },
                { label: 'Outcome Metric', key: 'outcome_metric', placeholder: 'e.g. 30% faster case resolutions' },
                { label: 'Source URL', key: 'source_url', placeholder: 'https://...' },
                { label: 'Notes', key: 'notes', placeholder: 'Additional context' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-[#6B6B6B] mb-1 block">{f.label}</label>
                  <input value={(csDraft as Record<string, string>)[f.key] ?? ''}
                    onChange={e => setCsDraft(d => ({ ...d, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full text-sm border border-[#E3E0D8] rounded-lg px-3 py-2 outline-none focus:border-[#D4622A] text-[#1A1A1A]" />
                </div>
              ))}

              <div>
                <label className="text-xs text-[#6B6B6B] mb-1 block">Tools Used</label>
                <TagInput value={csDraft.tools ?? []} onChange={v => setCsDraft(d => ({ ...d, tools: v }))} placeholder="Type a tool and press Enter" />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => { setShowCsForm(false); setCsDraft({ tools: [] }) }} className="text-sm px-3 py-1.5 text-[#6B6B6B]">Cancel</button>
                <button onClick={addCaseStudy} disabled={savingCs || !csDraft.title?.trim()}
                  className="text-sm px-4 py-1.5 bg-[#D4622A] text-white rounded-lg disabled:opacity-50">
                  {savingCs ? 'Saving…' : 'Add'}
                </button>
              </div>
            </div>
          )}

          {caseStudies.length === 0 && !showCsForm && (
            <p className="text-sm text-[#9CA3AF] text-center py-10">No case studies yet.</p>
          )}

          <div className="space-y-3">
            {caseStudies.map(cs => (
              <div key={cs.id} className={`bg-white border rounded-xl p-5 group relative transition-colors ${fetchPanel?.id === cs.id ? 'border-[#D4622A]' : 'border-[#E3E0D8]'}`}>
                <button onClick={() => deleteCaseStudy(cs.id)}
                  className="absolute top-4 right-4 text-xs text-[#C4BFB5] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                <div className="flex items-start gap-3 pr-6">
                  <div className="flex-1">
                    <p className="font-medium text-[#1A1A1A]">{cs.title}</p>
                    {cs.competitor_clients?.name && (
                      <p className="text-xs text-[#6B6B6B] mt-0.5">Client: {cs.competitor_clients.name}</p>
                    )}
                  </div>
                  {cs.pillar && (
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium flex-shrink-0 ${PILLAR_COLORS[cs.pillar] ?? ''}`}>{cs.pillar}</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6B6B6B]">
                  {cs.industry && <span>Industry: {cs.industry}</span>}
                  {cs.function && <span>Function: {cs.function}</span>}
                  {cs.outcome_metric && <span className="font-semibold text-[#1A1A1A]">Outcome: {cs.outcome_metric}</span>}
                </div>
                {(cs.tools ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {cs.tools!.map(t => (
                      <span key={t} className="text-xs px-2 py-0.5 bg-[#F5F3EE] border border-[#E3E0D8] rounded text-[#6B6B6B]">{t}</span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-3">
                  {cs.source_url && (
                    <a href={cs.source_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[#D4622A] hover:underline">View source →</a>
                  )}
                  {cs.source_url && (
                    <button
                      onClick={() => setFetchPanel(fetchPanel?.id === cs.id ? null : cs)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${fetchPanel?.id === cs.id ? 'bg-[#D4622A] text-white border-[#D4622A]' : 'border-[#E3E0D8] text-[#6B6B6B] hover:border-[#D4622A]/40 hover:text-[#D4622A]'}`}>
                      {fetchPanel?.id === cs.id ? '✕ Close' : '⬇ Fetch'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>{/* end main content */}

      {/* Split-screen fetch panel */}
      {fetchPanel && (
        <div className="w-[420px] flex-shrink-0 h-full sticky top-0" style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
          <FetchPanel cs={fetchPanel} competitorId={competitor.id} onClose={() => setFetchPanel(null)} />
        </div>
      )}
    </div>
  )
}

// ── Main Section ──────────────────────────────────────────────────────────────
export default function CompetitiveIntelSection() {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [selected, setSelected] = useState<Competitor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/competitors')
      .then(r => r.json())
      .then(data => { setCompetitors(data); setLoading(false) })
  }, [])

  const handleAdded = (c: Competitor) => setCompetitors(prev => [c, ...prev])
  const handleUpdated = (c: Competitor) => {
    setCompetitors(prev => prev.map(x => x.id === c.id ? c : x))
    setSelected(c)
  }
  const handleDeleted = (id: string) => setCompetitors(prev => prev.filter(x => x.id !== id))

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-sm text-[#9CA3AF] py-10 text-center">Loading…</div>
        ) : selected ? (
          <CompetitorDetail
            competitor={selected}
            onBack={() => setSelected(null)}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        ) : (
          <CompetitorList
            competitors={competitors}
            onSelect={setSelected}
            onAdded={handleAdded}
          />
        )}
      </div>
    </div>
  )
}
