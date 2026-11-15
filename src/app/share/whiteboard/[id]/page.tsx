import type { Metadata } from 'next'
import { getSupabase } from '@/lib/supabase'
import { parseShapes } from '@/lib/whiteboard'
import WhiteboardViewer from '@/components/WhiteboardViewer'

// Public, read-only view of a whiteboard. Only boards whose owner turned sharing on are served.
async function getBoard(id: string) {
  const { data } = await getSupabase()
    .from('whiteboards')
    .select('id, title, data, updated_at')
    .eq('id', id)
    .eq('is_public', true)
    .maybeSingle()
  return data
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const board = await getBoard(id)
  const title = board ? `${board.title} — AI Ready School` : 'Whiteboard — AI Ready School'
  return {
    title,
    // Link-only sharing: keep shared boards out of search results.
    robots: { index: false, follow: false },
    openGraph: { title, siteName: 'AI Ready School · Intellina AI', type: 'article' },
  }
}

export default async function ShareWhiteboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const board = await getBoard(id)

  if (!board) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <div className="text-center">
          <div className="text-4xl mb-4">🖍️</div>
          <p className="text-[#6B6B6B]">This whiteboard isn&apos;t available.</p>
          <p className="text-xs text-[#9CA3AF] mt-1">It may have been deleted or is no longer shared.</p>
        </div>
      </div>
    )
  }

  return <WhiteboardViewer title={board.title} shapes={parseShapes(board.data)} updatedAt={board.updated_at} />
}
