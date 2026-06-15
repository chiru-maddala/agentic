import { notFound } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Metadata } from 'next'

type Props = { params: Promise<{ id: string }> }

async function getEpisode(id: string) {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('podcast_episodes')
    .select('id, title, content, created_at')
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
  const episode = await getEpisode(id)
  if (!episode) return { title: 'Episode not found — The AI Sense' }

  const date = new Date(episode.created_at).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const description = stripMarkdown(episode.content)
  const title = `${episode.title} — The AI Sense Podcast`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'The AI Sense · IntelliRadar',
      publishedTime: episode.created_at,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function SharePodcastPage({ params }: Props) {
  const { id } = await params
  const episode = await getEpisode(id)
  if (!episode) notFound()

  const formatted = new Date(episode.created_at).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <header className="bg-white border-b border-[#E3E0D8] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-3">
          <span className="text-base font-bold text-[#D4622A]">IntelliRadar</span>
          <span className="text-[#E3E0D8]">·</span>
          <span className="text-sm text-[#6B6B6B]">🎙️ The AI Sense — Podcast Prep</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-xs text-[#9CA3AF] mb-8">{formatted}</p>
        <div
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
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{episode.content}</ReactMarkdown>
        </div>
      </main>

      <footer className="border-t border-[#E3E0D8] py-6 mt-10">
        <p className="text-center text-xs text-[#C4BFB5]">Powered by IntelliRadar · Intellina AI</p>
      </footer>
    </div>
  )
}
