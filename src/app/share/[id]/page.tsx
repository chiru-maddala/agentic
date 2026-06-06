import { notFound } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import type { Metadata } from 'next'
import PdfButton from './PdfButton'
import ContextMenuWrapper from '@/components/ContextMenuWrapper'

type Props = { params: Promise<{ id: string }> }

async function getTaskDoc(id: string) {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('tasks')
    .select('id, title, document_content, created_at')
    .eq('id', id)
    .not('document_content', 'is', null)
    .single()
  return data
}

function stripHtml(html: string, maxLen = 200): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLen)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const doc = await getTaskDoc(id)
  if (!doc) return { title: 'Document not found — IntelliRadar' }

  const title = `${doc.title} — IntelliRadar`
  const description = stripHtml(doc.document_content ?? '')

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'IntelliRadar · Intellina AI',
      publishedTime: doc.created_at,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function ShareDocPage({ params }: Props) {
  const { id } = await params
  const doc = await getTaskDoc(id)
  if (!doc) notFound()

  const formatted = new Date(doc.created_at).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <header className="bg-white border-b border-[#E3E0D8] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-base font-bold text-[#D4622A] flex-shrink-0">IntelliRadar</span>
            <span className="text-[#E3E0D8] flex-shrink-0">·</span>
            <span className="text-sm text-[#6B6B6B] truncate">{doc.title}</span>
          </div>
          <div className="flex-shrink-0 ml-4">
            <PdfButton title={doc.title} />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-[#1A1A1A] mb-2">{doc.title}</h1>
        <p className="text-xs text-[#9CA3AF] mb-8">Generated {formatted}</p>
        <ContextMenuWrapper showCourse={false}>
          <div
            id="share-doc-content"
            className="prose prose-sm max-w-none
              prose-headings:text-[#1A1A1A] prose-headings:font-semibold
              prose-p:text-[#374151] prose-p:leading-relaxed
              prose-strong:text-[#1A1A1A]
              prose-li:text-[#374151]
              prose-th:text-[#1A1A1A] prose-td:text-[#374151]"
            dangerouslySetInnerHTML={{ __html: doc.document_content ?? '' }}
          />
        </ContextMenuWrapper>
      </main>

      <footer className="border-t border-[#E3E0D8] py-6 mt-10">
        <p className="text-center text-xs text-[#C4BFB5]">Powered by IntelliRadar · Intellina AI</p>
      </footer>
    </div>
  )
}
