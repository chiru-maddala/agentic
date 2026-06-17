import { notFound } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import type { Metadata } from 'next'

type Props = { params: Promise<{ shareId: string }> }

type ShareClient = { id: string; name: string; industry?: string; company_size?: string; geography?: string; notes?: string }
type ShareCaseStudy = { id: string; title: string; pillar?: string; industry?: string; function?: string; tools?: string[]; outcome_metric?: string; source_url?: string; competitor_clients?: { name: string } | null }

const PILLAR_COLORS: Record<string, string> = {
  'Learning AI': 'bg-blue-50 text-blue-700 border-blue-200',
  'Enterprise AI': 'bg-purple-50 text-purple-700 border-purple-200',
  'AI Infrastructure': 'bg-amber-50 text-amber-700 border-amber-200',
}

async function getData(shareId: string) {
  const supabase = getSupabase()
  const { data: competitor } = await supabase
    .from('competitors')
    .select('*')
    .eq('share_id', shareId)
    .single()
  if (!competitor) return null

  const [{ data: clients }, { data: caseStudies }] = await Promise.all([
    supabase.from('competitor_clients').select('*').eq('competitor_id', competitor.id).order('created_at'),
    supabase.from('competitor_case_studies').select('*, competitor_clients(name)').eq('competitor_id', competitor.id).order('created_at'),
  ])

  return { competitor, clients: clients ?? [], caseStudies: caseStudies ?? [] }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareId } = await params
  const result = await getData(shareId)
  if (!result) return { title: 'Competitor not found' }
  return {
    title: `${result.competitor.name} — Competitive Intelligence`,
    description: result.competitor.description ?? `Competitive profile for ${result.competitor.name}`,
  }
}

export default async function ShareCompetitorPage({ params }: Props) {
  const { shareId } = await params
  const result = await getData(shareId)
  if (!result) notFound()

  const { competitor, clients, caseStudies } = result

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <header className="bg-white border-b border-[#E3E0D8] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <span className="text-base font-bold text-[#D4622A]">IntelliRadar</span>
          <span className="text-[#E3E0D8]">·</span>
          <span className="text-sm text-[#6B6B6B]">Competitive Intelligence</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-[#1A1A1A]">{competitor.name}</h1>
              <a href={competitor.website} target="_blank" rel="noopener noreferrer"
                className="text-sm text-[#D4622A] hover:underline">{competitor.website}</a>
            </div>
            <div className="flex flex-wrap gap-2">
              {(competitor.pillars ?? []).map((p: string) => (
                <span key={p} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${PILLAR_COLORS[p] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>{p}</span>
              ))}
            </div>
          </div>
          {competitor.description && <p className="mt-3 text-[#374151] leading-relaxed">{competitor.description}</p>}
        </div>

        {/* Profile grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'HQ', value: competitor.hq },
            { label: 'Founded', value: competitor.founding_year },
            { label: 'Funding Stage', value: competitor.funding_stage },
            { label: 'Total Raised', value: competitor.total_raised },
            { label: 'Team Size', value: competitor.team_size },
            { label: 'Pricing', value: competitor.pricing_model },
          ].filter(f => f.value).map(f => (
            <div key={f.label} className="bg-white border border-[#E3E0D8] rounded-lg p-4">
              <p className="text-xs text-[#9CA3AF] uppercase tracking-wide mb-1">{f.label}</p>
              <p className="text-sm font-medium text-[#1A1A1A]">{f.value}</p>
            </div>
          ))}
        </div>

        {/* Tags sections */}
        {[
          { label: 'Target Industries', values: competitor.target_industries },
          { label: 'Target Company Size', values: competitor.target_company_size },
          { label: 'Geographies', values: competitor.geographies },
          { label: 'Tech Stack', values: competitor.tech_stack },
          { label: 'Differentiators', values: competitor.differentiators },
          { label: 'Content Themes', values: competitor.content_themes },
        ].filter(s => s.values?.length).map(s => (
          <div key={s.label}>
            <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">{s.label}</h3>
            <div className="flex flex-wrap gap-2">
              {(s.values as string[]).map((v: string) => (
                <span key={v} className="text-sm px-3 py-1 bg-white border border-[#E3E0D8] rounded-full text-[#374151]">{v}</span>
              ))}
            </div>
          </div>
        ))}

        {/* Clients */}
        {clients.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Clients ({clients.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {clients.map((c: ShareClient) => (
                <div key={c.id} className="bg-white border border-[#E3E0D8] rounded-lg p-4">
                  <p className="font-medium text-[#1A1A1A]">{c.name}</p>
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

        {/* Case Studies */}
        {caseStudies.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Case Studies ({caseStudies.length})</h2>
            <div className="space-y-3">
              {caseStudies.map((cs: ShareCaseStudy) => (
                <div key={cs.id} className="bg-white border border-[#E3E0D8] rounded-lg p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
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
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6B6B6B]">
                    {cs.industry && <span>Industry: {cs.industry}</span>}
                    {cs.function && <span>Function: {cs.function}</span>}
                    {cs.outcome_metric && <span className="font-semibold text-[#1A1A1A]">Outcome: {cs.outcome_metric}</span>}
                  </div>
                  {(cs.tools ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {cs.tools!.map((t: string) => (
                        <span key={t} className="text-xs px-2 py-0.5 bg-[#F5F3EE] border border-[#E3E0D8] rounded text-[#6B6B6B]">{t}</span>
                      ))}
                    </div>
                  )}
                  {cs.source_url && (
                    <a href={cs.source_url} target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs text-[#D4622A] hover:underline">View source →</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-[#E3E0D8] py-6 mt-10">
        <p className="text-center text-xs text-[#C4BFB5]">Powered by IntelliRadar · Intellina AI</p>
      </footer>
    </div>
  )
}
