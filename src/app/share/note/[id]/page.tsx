import { Metadata } from 'next'
import { marked } from 'marked'
import { getSupabase } from '@/lib/supabase'

function toHtml(content: string): string {
  if (!content) return ''
  // If it already looks like HTML, pass through; otherwise parse as Markdown
  if (/^\s*<[a-zA-Z]/.test(content.trim())) return content
  return marked.parse(content, { async: false }) as string
}

async function getNote(id: string) {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('notes')
    .select('id, title, content, created_at, updated_at')
    .eq('id', id)
    .single()
  return data
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const note = await getNote(id)
  if (!note) return { title: 'Note — IntelliRadar' }
  const desc = toHtml(note.content ?? '').replace(/<[^>]+>/g, '').slice(0, 200)
  return {
    title: `${note.title} — IntelliRadar`,
    description: desc,
    openGraph: {
      title: `${note.title} — IntelliRadar`,
      description: desc,
      siteName: 'IntelliRadar · Intellina AI',
      type: 'article',
    },
    twitter: { card: 'summary', title: `${note.title} — IntelliRadar`, description: desc },
  }
}

export default async function ShareNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const note = await getNote(id)

  if (!note) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <div className="text-center">
          <div className="text-4xl mb-4">📭</div>
          <p className="text-[#9CA3AF]">Note not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs bg-[#FEF3EC] text-[#D4622A] border border-[#F5D3BC] px-2 py-0.5 rounded-full font-medium">
              Note
            </span>
            <span className="text-xs text-[#9CA3AF]">
              {new Date(note.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{note.title}</h1>
        </div>

        {/* Content */}
        <div
          className="bg-white border border-[#E3E0D8] rounded-2xl px-8 py-8 prose prose-gray max-w-none
            prose-headings:text-[#1A1A1A] prose-p:text-[#374151] prose-p:leading-relaxed
            prose-strong:text-[#1A1A1A] prose-li:text-[#374151]
            prose-blockquote:border-l-[#D4622A] prose-blockquote:text-[#6B6B6B]
            prose-code:text-[#D4622A] prose-code:bg-[#FEF3EC]"
          dangerouslySetInnerHTML={{ __html: toHtml(note.content) || '<p class="text-gray-400">No content.</p>' }}
        />

        {/* Branding footer */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-[#9CA3AF]">
          <span className="font-semibold text-[#D4622A]">IntelliRadar</span>
          <span>·</span>
          <span>Intellina AI Daily Intelligence</span>
        </div>
      </div>
    </div>
  )
}
