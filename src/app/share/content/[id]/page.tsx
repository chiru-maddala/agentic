import { Metadata } from 'next'
import { getSupabase } from '@/lib/supabase'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

async function getItem(id: string) {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('content_lab')
    .select('id, type, title, concept, platform, generated_content, created_at')
    .eq('id', id)
    .single()
  return data
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const item = await getItem(id)
  if (!item) return { title: 'Content — IntelliRadar' }
  const typeLabel = item.type === 'article' ? 'Article' : `Social Post (${item.platform ?? 'Social'})`
  const desc = item.concept?.slice(0, 200) ?? ''
  return {
    title: `${item.title} — IntelliRadar`,
    description: desc,
    openGraph: {
      title: `${item.title} — IntelliRadar`,
      description: desc,
      siteName: `IntelliRadar · Intellina AI · ${typeLabel}`,
      type: 'article',
    },
    twitter: { card: 'summary', title: `${item.title} — IntelliRadar`, description: desc },
  }
}

export default async function ShareContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const item = await getItem(id)

  if (!item || !item.generated_content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <div className="text-center">
          <div className="text-4xl mb-4">📭</div>
          <p className="text-[#9CA3AF]">Content not found or not yet generated.</p>
        </div>
      </div>
    )
  }

  const typeLabel = item.type === 'article' ? 'Article' : `Social Post · ${item.platform ?? ''}`

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs bg-[#FEF3EC] text-[#D4622A] border border-[#F5D3BC] px-2 py-0.5 rounded-full font-medium">
              {typeLabel}
            </span>
            <span className="text-xs text-[#9CA3AF]">
              {new Date(item.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{item.title}</h1>
          {item.concept && <p className="text-[#6B6B6B] mt-2 text-sm leading-relaxed">{item.concept}</p>}
        </div>

        {/* Content */}
        <div className="bg-white border border-[#E3E0D8] rounded-2xl px-8 py-8 prose prose-gray max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.generated_content}</ReactMarkdown>
        </div>

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
