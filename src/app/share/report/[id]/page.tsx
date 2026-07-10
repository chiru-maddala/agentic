import { notFound } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Metadata } from 'next'
import PdfButton from './PdfButton'
import ContextMenuWrapper from '@/components/ContextMenuWrapper'

type Props = { params: Promise<{ id: string }> }

type TwitterSource = { id: string; url: string; username: string; text: string }

async function getReport(id: string) {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('reports')
    .select('id, date, content, created_at, sources')
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
  if (!report) return { title: 'Report not found — IntelliRadar' }

  const date = new Date(report.created_at).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const description = stripMarkdown(report.content)
  const title = `IntelliRadar Daily Report — ${date}`

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
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function ShareReportPage({ params }: Props) {
  const { id } = await params
  const report = await getReport(id)
  if (!report) notFound()

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
            <span className="text-sm text-[#6B6B6B]">Daily Intelligence Report</span>
          </div>
          <PdfButton date={report.date} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-xs text-[#9CA3AF] mb-8">{formatted}</p>
        <ContextMenuWrapper showCourse={false}>
        <div
          id="share-report-content"
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
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.content}</ReactMarkdown>
        </div>
        </ContextMenuWrapper>

        {Array.isArray(report.sources) && (report.sources as TwitterSource[]).length > 0 && (
          <div className="mt-8 pt-6 border-t border-[#E3E0D8]">
            <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">
              Twitter/X Sources ({(report.sources as TwitterSource[]).length})
            </p>
            <div className="flex flex-col gap-2">
              {(report.sources as TwitterSource[]).map((s) => (
                <a
                  key={s.id}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 text-xs bg-white border border-[#E3E0D8] hover:border-[#D4622A] px-3 py-2 rounded-lg text-[#374151] hover:text-[#D4622A] transition-colors"
                >
                  <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.9 1.153h3.68l-8.04 9.19L24 22.847h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
                  </svg>
                  <span className="flex-1">
                    <span className="font-medium">@{s.username}</span>
                    <span className="text-[#6B6B6B]"> — {s.text.length > 120 ? s.text.slice(0, 118) + '…' : s.text}</span>
                  </span>
                </a>
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
