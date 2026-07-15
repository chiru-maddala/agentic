'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { TwitterSource } from '@/components/ReportDisplay'

const ReportHistory = dynamic(() => import('@/components/ReportHistory'), { ssr: false })
const ReportDisplay = dynamic(() => import('@/components/ReportDisplay'), { ssr: false })
const ChatSection = dynamic(() => import('@/components/ChatSection'), { ssr: false })
const TasksSection = dynamic(() => import('@/components/TasksSection'), { ssr: false })
const NotesSection = dynamic(() => import('@/components/NotesSection'), { ssr: false })
const DashboardSection = dynamic(() => import('@/components/DashboardSection'), { ssr: false })
const MirrorSection = dynamic(() => import('@/components/MirrorSection'), { ssr: false })
const CoursesSection = dynamic(() => import('@/components/CoursesSection'), { ssr: false })
const ContentLabSection = dynamic(() => import('@/components/ContentLabSection'), { ssr: false })
const ContentSuggestions = dynamic(() => import('@/components/ContentSuggestions'), { ssr: false })
const ContextSection = dynamic(() => import('@/components/ContextSection'), { ssr: false })
const SourcesSection = dynamic(() => import('@/components/SourcesSection'), { ssr: false })
const UserManagementSection = dynamic(() => import('@/components/UserManagementSection'), { ssr: false })
const KnowledgeGraphSection = dynamic(() => import('@/components/KnowledgeGraphSection'), { ssr: false })
const ResearchSection = dynamic(() => import('@/components/ResearchSection'), { ssr: false })
const FloatingChat = dynamic(() => import('@/components/FloatingChat'), { ssr: false })
const PodcastSection = dynamic(() => import('@/components/PodcastSection'), { ssr: false })
const CompetitiveIntelSection = dynamic(() => import('@/components/CompetitiveIntelSection'), { ssr: false })
const MeetingsSection = dynamic(() => import('@/components/MeetingsSection'), { ssr: false })
const PeopleSettingsSection = dynamic(() => import('@/components/PeopleSettingsSection'), { ssr: false })
import { createClient } from '@/lib/supabase-browser'

type Tab = 'reports' | 'chat' | 'tasks' | 'notes' | 'dashboard' | 'courses' | 'contentlab' | 'graph' | 'research' | 'mirror' | 'meetings' | 'podcast' | 'competitive'
type SettingsTab = 'context' | 'sources' | 'people' | 'users'

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  reports: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 6a6 6 0 0 1 6 6"/><path d="M12 10a2 2 0 0 1 2 2"/><line x1="12" y1="12" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
    </svg>
  ),
  chat: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  tasks: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  notes: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  courses: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
  contentlab: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/>
    </svg>
  ),
  graph: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><circle cx="12" cy="8" r="2"/>
      <line x1="7" y1="12" x2="17" y2="6"/><line x1="7" y1="12" x2="17" y2="18"/><line x1="14" y1="8" x2="17" y2="6"/>
    </svg>
  ),
  research: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  ),
  mirror: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V12"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="7" r="5"/>
    </svg>
  ),
  meetings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
    </svg>
  ),
  podcast: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  ),
  competitive: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
    </svg>
  ),
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'mirror', label: 'Strategic Mirror' },
  { id: 'meetings', label: 'Meetings' },
  { id: 'reports', label: 'Reports' },
  { id: 'chat', label: 'Chat' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'notes', label: 'Notes' },
  { id: 'courses', label: 'Presentations' },
  { id: 'contentlab', label: 'Content Lab' },
  { id: 'graph', label: 'Knowledge Graph' },
  { id: 'research', label: 'Research' },
  { id: 'podcast', label: 'Podcast' },
  { id: 'competitive', label: 'Competitive Intel' },
]

const VALID_TABS = new Set<Tab | 'settings'>([...TABS.map((t) => t.id), 'settings'])

// useLayoutEffect on the client (runs before paint), useEffect on the server
// (effects don't run during SSR anyway) to silence the SSR warning.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export default function Home() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab | 'settings'>('dashboard')
  const [hydrated, setHydrated] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('context')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedCreatedAt, setSelectedCreatedAt] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [twitterSources, setTwitterSources] = useState<TwitterSource[]>([])
  const [streaming, setStreaming] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)
  const [researchContext, setResearchContext] = useState<string>('research. Viewing the Research section.')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [reportLinkCopied, setReportLinkCopied] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showReportList, setShowReportList] = useState(true)
  const reportRef = useRef<HTMLDivElement>(null)

  const ADMIN_EMAIL = 'chirans@gmail.com'

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
  }, [])

  // Resolve the active tab from the URL hash before the first paint so a
  // refresh lands on the right section with no flash of the default dashboard.
  useIsomorphicLayoutEffect(() => {
    const hash = window.location.hash.replace(/^#/, '') as Tab | 'settings'
    if (VALID_TABS.has(hash)) setTab(hash)
    setHydrated(true)
  }, [])

  // Follow browser back/forward navigation between sections.
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace(/^#/, '') as Tab | 'settings'
      if (VALID_TABS.has(hash)) setTab(hash)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Keep the URL hash in sync with the active tab.
  useEffect(() => {
    if (window.location.hash.replace(/^#/, '') !== tab) {
      window.history.replaceState(null, '', `#${tab}`)
    }
  }, [tab])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const loadReport = useCallback(async (id: string, date: string, created_at?: string) => {
    setSelectedId(id)
    setSelectedDate(date)
    setSelectedCreatedAt(created_at ?? null)
    setStreaming(false)
    setShowReportList(false)
    const res = await fetch(`/api/reports/${id}`)
    const data = await res.json()
    setContent(data.content ?? '')
    setTwitterSources(data.sources ?? [])
  }, [])

  const generateReport = async () => {
    setGenerating(true)
    setSelectedId(null)
    setSelectedDate(null)
    setContent('')
    setTwitterSources([])
    setStreaming(true)

    const res = await fetch('/api/generate', { method: 'POST' })
    if (!res.body) return

    const reader = res.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      setContent((prev) => prev + decoder.decode(value, { stream: true }))
    }

    setStreaming(false)
    setGenerating(false)
    setHistoryKey((k) => k + 1)

    const listRes = await fetch('/api/reports')
    const reports = await listRes.json()
    if (reports[0]) {
      setSelectedId(reports[0].id)
      setSelectedDate(reports[0].date)
      setSelectedCreatedAt(reports[0].created_at)
      const reportRes = await fetch(`/api/reports/${reports[0].id}`)
      const reportData = await reportRes.json()
      setTwitterSources(reportData.sources ?? [])
    }
  }

  const downloadPDF = async () => {
    if (!reportRef.current) return
    const { default: html2canvas } = await import('html2canvas')
    const { default: jsPDF } = await import('jspdf')
    const clone = reportRef.current.cloneNode(true) as HTMLElement
    clone.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:800px;padding:48px;background:white;color:#111827;font-family:Georgia,serif;font-size:14px;line-height:1.8;'
    const style = document.createElement('style')
    style.textContent = '*{color:#111827!important;background:transparent!important}h1,h2,h3,h4{color:#1f2937!important;margin-top:1em}code,pre{background:#f3f4f6!important;color:#374151!important;padding:2px 4px;border-radius:3px}a{color:#D4622A!important}'
    clone.appendChild(style)
    document.body.appendChild(clone)
    try {
      const canvas = await html2canvas(clone, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 30
      const imgW = pageW - margin * 2
      const imgH = (canvas.height * imgW) / canvas.width
      const contentH = pageH - margin * 2
      const pages = Math.ceil(imgH / contentH)
      for (let i = 0; i < pages; i++) {
        if (i > 0) pdf.addPage()
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin - i * contentH, imgW, imgH)
      }
      pdf.save(`IntelliRadar-${new Date().toISOString().slice(0, 10)}.pdf`)
    } finally {
      document.body.removeChild(clone)
    }
  }

  const deleteReport = async () => {
    if (!selectedId) return
    if (!window.confirm('Are you sure you want to delete this report? This cannot be undone.')) return
    await fetch(`/api/reports/${selectedId}`, { method: 'DELETE' })
    setSelectedId(null)
    setSelectedDate(null)
    setSelectedCreatedAt(null)
    setContent('')
    setHistoryKey((k) => k + 1)
    const listRes = await fetch('/api/reports')
    const reports = await listRes.json()
    if (reports[0]) loadReport(reports[0].id, reports[0].date, reports[0].created_at)
  }

  useEffect(() => {
    fetch('/api/reports')
      .then((r) => r.json())
      .then((reports) => {
        if (reports[0]) loadReport(reports[0].id, reports[0].date, reports[0].created_at)
      })
  }, [loadReport])

  const today = new Date().toISOString().split('T')[0]
  const isToday = selectedDate === today

  const handleTabChange = (newTab: Tab | 'settings') => {
    setTab(newTab)
    setSidebarOpen(false)
  }

  // Until the hash is resolved, render a neutral shell that matches the page
  // background. The layout effect above runs before paint, so this never
  // actually shows — it only guarantees the first painted frame is the
  // correct tab, never the default dashboard.
  if (!hydrated) {
    return <div className="h-screen bg-[#FAF9F6]" />
  }

  return (
    <div className="flex h-screen bg-[#FAF9F6] text-[#1A1A1A] overflow-hidden">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-72 flex-shrink-0 bg-[#F5F3EE] border-r border-[#E3E0D8] flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:w-64 md:translate-x-0 md:z-auto md:transition-none
      `}>
        {/* Brand */}
        <div className="p-4 border-b border-[#E3E0D8]">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-lg font-bold text-[#D4622A]">IntelliRadar</span>
          </div>
          <p className="text-xs text-[#9CA3AF]">Intellina AI Daily Intelligence</p>
        </div>

        {/* Tab nav */}
        <nav className="px-3 py-3 border-b border-[#E3E0D8] space-y-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id as Tab)}
              className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] transition-all ${
                tab === t.id
                  ? 'bg-white text-[#1A1A1A] font-medium shadow-sm border border-[#E3E0D8]'
                  : 'text-[#6B6B6B] hover:bg-[#ECEAE3] hover:text-[#1A1A1A]'
              }`}
            >
              <span className="flex-shrink-0">{TAB_ICONS[t.id as Tab]}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {/* Section-specific sidebar content */}
        {tab === 'reports' && (
          <>
            <div className="p-3 border-b border-[#E3E0D8]">
              <button
                onClick={generateReport}
                disabled={generating}
                className="w-full bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>&#9889; Generate Report</>
                )}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <p className="text-xs text-[#9CA3AF] uppercase tracking-wider mb-2 px-1">History</p>
              <ReportHistory
                key={historyKey}
                selectedId={selectedId}
                onSelect={loadReport}
              />
            </div>
          </>
        )}

        {tab !== 'reports' && <div className="flex-1" />}

        {/* Footer */}
        <div className="border-t border-[#E3E0D8] p-3 space-y-1">
          {/* Settings */}
          <button
            onClick={() => handleTabChange('settings')}
            className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] transition-all ${
              tab === 'settings'
                ? 'bg-white text-[#1A1A1A] font-medium shadow-sm border border-[#E3E0D8]'
                : 'text-[#6B6B6B] hover:bg-[#ECEAE3] hover:text-[#1A1A1A]'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
            <span>Settings</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full text-left flex items-center gap-3 px-3 py-2 text-[15px] text-[#9CA3AF] hover:text-[#6B6B6B] hover:bg-[#ECEAE3] rounded-xl transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#F5F3EE] border-b border-[#E3E0D8] flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-[#6B6B6B] hover:bg-[#ECEAE3] hover:text-[#1A1A1A]"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span className="text-base font-bold text-[#D4622A]">IntelliRadar</span>
          <div className="w-8" />
        </div>
        {tab === 'reports' && (
          <div className="flex-1 overflow-y-auto">
            {/* Mobile-only: report history list */}
            {showReportList && (
              <div className="md:hidden flex flex-col h-full bg-[#F5F3EE]">
                <div className="p-3 border-b border-[#E3E0D8]">
                  <button
                    onClick={() => { generateReport(); setShowReportList(false) }}
                    disabled={generating}
                    className="w-full bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating...</>
                    ) : <>&#9889; Generate Report</>}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <p className="text-xs text-[#9CA3AF] uppercase tracking-wider mb-2 px-1">History</p>
                  <ReportHistory key={historyKey} selectedId={selectedId} onSelect={loadReport} />
                </div>
              </div>
            )}
            {/* Report content: always visible on desktop, hidden on mobile when list is shown */}
            <div className={showReportList ? 'hidden md:block' : ''}>
            {content ? (
              <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10">
                {/* Mobile back button */}
                <button
                  onClick={() => setShowReportList(true)}
                  className="md:hidden flex items-center gap-1 text-sm text-[#6B6B6B] hover:text-[#1A1A1A] mb-4 -ml-1"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  All Reports
                </button>
                {selectedDate && !streaming && (
                  <div className="flex flex-wrap items-center gap-2 justify-between mb-6">
                    <span className="text-xs text-[#9CA3AF]">
                      {selectedCreatedAt
                        ? new Date(selectedCreatedAt).toLocaleString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : new Date(selectedDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            timeZone: 'UTC',
                          })}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {isToday && (
                        <span className="text-xs bg-[#FEF3EC] text-[#D4622A] px-2 py-1 rounded-full border border-[#F5D3BC]">
                          Today
                        </span>
                      )}
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/share/report/${selectedId}`
                          navigator.clipboard.writeText(url).then(() => {
                            setReportLinkCopied(true)
                            setTimeout(() => setReportLinkCopied(false), 2000)
                          })
                        }}
                        title="Copy shareable link"
                        className={`flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg transition-colors ${
                          reportLinkCopied
                            ? 'text-green-700 bg-green-50 border-green-200'
                            : 'text-[#6B6B6B] hover:text-[#1A1A1A] bg-white hover:bg-[#F5F3EE] border-[#E3E0D8]'
                        }`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                        </svg>
                        {reportLinkCopied ? 'Copied!' : 'Share'}
                      </button>
                      <button
                        onClick={downloadPDF}
                        title="Download as PDF"
                        className="flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-[#1A1A1A] bg-white hover:bg-[#F5F3EE] border border-[#E3E0D8] px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        PDF
                      </button>
                      <button
                        onClick={deleteReport}
                        title="Delete report"
                        className="flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-red-500 bg-white hover:bg-[#F5F3EE] border border-[#E3E0D8] px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                )}
                <div ref={reportRef}>
                  <ReportDisplay content={content} streaming={streaming} onCourseCreated={() => setTab('courses')} twitterSources={twitterSources} />
                </div>
                {selectedId && !streaming && (
                  <ContentSuggestions
                    key={selectedId}
                    reportId={selectedId}
                    onNavigateToLab={() => setTab('contentlab')}
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="text-5xl mb-4">&#128225;</div>
                <h2 className="text-xl font-semibold text-[#1A1A1A] mb-2">No report yet</h2>
                <p className="text-[#9CA3AF] text-sm max-w-xs">
                  Click &quot;Generate Report&quot; to fetch the latest AI intelligence for Intellina.
                </p>
              </div>
            )}
            </div>
          </div>
        )}

        {tab === 'chat' && <ChatSection />}
        {tab === 'tasks' && <TasksSection />}
        {tab === 'notes' && <NotesSection />}
        {tab === 'dashboard' && <DashboardSection onNavigate={handleTabChange} onGenerateReport={generateReport} generating={generating} />}
        {tab === 'courses' && <CoursesSection />}
        {tab === 'contentlab' && <ContentLabSection />}
        {tab === 'graph' && <KnowledgeGraphSection />}
        {tab === 'mirror' && <MirrorSection />}
        {tab === 'meetings' && <MeetingsSection />}
        {tab === 'research' && <ResearchSection onContextChange={setResearchContext} />}
        {tab === 'podcast' && <PodcastSection />}
        {tab === 'competitive' && <CompetitiveIntelSection />}
        {tab !== 'chat' && (
          <FloatingChat
            pageContext={
              tab === 'reports' ? `reports. ${selectedDate ? `Viewing report from ${selectedDate}.` : 'No report selected.'}${content ? ` Report content: ${content.slice(0, 600)}` : ''}`
              : tab === 'tasks' ? 'tasks. Viewing the Tasks section with all open and completed tasks.'
              : tab === 'notes' ? 'notes. Viewing the Notes section with saved notes.'
              : tab === 'mirror' ? 'mirror. Viewing the Strategic Mirror — goals, signals, thoughts, and coaching assessment.'
              : tab === 'meetings' ? 'meetings. Viewing Meetings — logged meeting notes, attendees, and AI-suggested action items.'
              : tab === 'research' ? researchContext
              : tab === 'dashboard' ? 'dashboard. Viewing the main Dashboard overview.'
              : tab === 'courses' ? 'courses. Viewing the Presentations section.'
              : tab === 'contentlab' ? 'contentlab. Viewing the Content Lab.'
              : tab === 'graph' ? 'graph. Viewing the Knowledge Graph.'
              : tab === 'podcast' ? 'podcast. Viewing The AI Sense podcast research space with MARS framework episode prep.'
              : tab === 'settings' ? 'settings. Viewing Settings.'
              : 'dashboard'
            }
            onOpenFull={() => handleTabChange('chat')}
          />
        )}
        {tab === 'settings' && (
          <div className="flex flex-col md:flex-row h-full">
            {/* Settings sub-nav */}
            <aside className="w-full md:w-48 flex-shrink-0 bg-[#F5F3EE] border-b md:border-b-0 md:border-r border-[#E3E0D8] flex flex-row md:flex-col p-3 gap-1 overflow-x-auto">
              <p className="hidden md:block text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider px-2 py-1.5">Settings</p>
              <button
                onClick={() => setSettingsTab('context')}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  settingsTab === 'context'
                    ? 'bg-white text-[#1A1A1A] font-medium shadow-sm border border-[#E3E0D8]'
                    : 'text-[#6B6B6B] hover:bg-[#ECEAE3] hover:text-[#1A1A1A]'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                Context
              </button>
              <button
                onClick={() => setSettingsTab('sources')}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  settingsTab === 'sources'
                    ? 'bg-white text-[#1A1A1A] font-medium shadow-sm border border-[#E3E0D8]'
                    : 'text-[#6B6B6B] hover:bg-[#ECEAE3] hover:text-[#1A1A1A]'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/>
                </svg>
                Sources
              </button>
              <button
                onClick={() => setSettingsTab('people')}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  settingsTab === 'people'
                    ? 'bg-white text-[#1A1A1A] font-medium shadow-sm border border-[#E3E0D8]'
                    : 'text-[#6B6B6B] hover:bg-[#ECEAE3] hover:text-[#1A1A1A]'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                </svg>
                People
              </button>
              {userEmail === ADMIN_EMAIL && (
                <button
                  onClick={() => setSettingsTab('users')}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                    settingsTab === 'users'
                      ? 'bg-white text-[#1A1A1A] font-medium shadow-sm border border-[#E3E0D8]'
                      : 'text-[#6B6B6B] hover:bg-[#ECEAE3] hover:text-[#1A1A1A]'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  User Management
                </button>
              )}
            </aside>
            {/* Settings content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {settingsTab === 'context' && <ContextSection />}
              {settingsTab === 'sources' && <SourcesSection />}
              {settingsTab === 'people' && <PeopleSettingsSection />}
              {settingsTab === 'users' && userEmail === ADMIN_EMAIL && <UserManagementSection />}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
