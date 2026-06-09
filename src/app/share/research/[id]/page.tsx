import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase-admin'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Metadata } from 'next'

type Source = { type: 'pdf' | 'url'; name: string; url: string }
type Props = { params: Promise<{ id: string }> }

async function getReport(id: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('research_reports')
    .select('id, title, content, sources, created_at')
    .eq('id', id)
    .single()
  return data
}

function stripMarkdown(md: string, maxLen = 200): string {
  return md
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[>\-*_~]/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLen)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const report = await getReport(id)
  if (!report) return { title: 'Research Report not found — IntelliRadar' }

  const title = `${report.title || 'Research Report'} — IntelliRadar`
  const description = stripMarkdown(report.content ?? '')

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'IntelliRadar · Intellina AI',
      publishedTime: report.created_at,
    },
    twitter: { card: 'summary', title, description },
  }
}

export default async function ShareResearchPage({ params }: Props) {
  const { id } = await params
  const report = await getReport(id)
  if (!report) notFound()

  const sources: Source[] = report.sources ?? []
  const formatted = new Date(report.created_at).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <header className="bg-white border-b border-[#E3E0D8] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-[#D4622A]">IntelliRadar</span>
            <span className="text-[#E3E0D8]">·</span>
            <span className="text-sm text-[#6B6B6B]">Research Intelligence</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-xl font-semibold text-[#1A1A1A] mb-1">{report.title || 'Research Report'}</h1>
        <p className="text-xs text-[#9CA3AF] mb-6">{formatted}</p>

        {/* Sources bar */}
        {sources.length > 0 && (
          <div className="mb-8 p-4 bg-[#F5F3EE] border border-[#E3E0D8] rounded-xl">
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">Sources</p>
            <div className="flex flex-wrap gap-2">
              {sources.map((s, i) => (
                s.type === 'pdf' ? (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs bg-white border border-[#E3E0D8] hover:border-[#D4622A] px-2.5 py-1.5 rounded-lg text-[#374151] hover:text-[#D4622A] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 text-[#D4622A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    {s.name.length > 40 ? s.name.slice(0, 38) + '…' : s.name}
                  </a>
                ) : (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs bg-white border border-[#E3E0D8] hover:border-[#6B6B6B] px-2.5 py-1.5 rounded-lg text-[#374151] hover:text-[#1A1A1A] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                    {s.name.length > 50 ? s.name.slice(0, 48) + '…' : s.name}
                    <svg className="w-3 h-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                )
              ))}
            </div>
          </div>
        )}

        <div
          id="share-research-content"
          className="prose prose-sm max-w-none
            prose-headings:text-[#1A1A1A] prose-headings:font-semibold
            prose-p:text-[#374151] prose-p:leading-relaxed
            prose-strong:text-[#1A1A1A]
            prose-a:text-[#D4622A] prose-a:no-underline hover:prose-a:underline
            prose-code:text-[#D4622A] prose-code:bg-[#FEF3EC] prose-code:px-1 prose-code:rounded
            prose-pre:bg-[#F5F3EE] prose-pre:border prose-pre:border-[#E3E0D8]
            prose-blockquote:border-l-[#D4622A] prose-blockquote:text-[#6B6B6B]
            prose-li:text-[#374151]
            prose-th:text-[#1A1A1A] prose-td:text-[#374151]"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.content ?? ''}</ReactMarkdown>
        </div>
      </main>

      <footer className="border-t border-[#E3E0D8] py-6 mt-10">
        <p className="text-center text-xs text-[#C4BFB5]">Powered by IntelliRadar · Intellina AI</p>
      </footer>
    </div>
  )
}
