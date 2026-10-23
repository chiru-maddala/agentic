'use client'

import { useCallback, useEffect, useState } from 'react'
import { PILLARS, PILLAR_META, isPillar, type ReportScope } from '@/lib/pillars'

type Task = {
  id: string
  title: string
  pillar: string | null
  status: 'todo' | 'in-progress' | 'done'
  source: 'manual' | 'report' | 'chat'
  created_at: string
}

type Report = { id: string; date: string; created_at: string; vertical?: string; content?: string }
type Note = { id: string; title: string; updated_at: string }

const STATUS_COLORS: Record<Task['status'], string> = {
  'todo': 'bg-[#C4BFB5]',
  'in-progress': 'bg-amber-400',
  'done': 'bg-green-500',
}

function useNow() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  return now
}

function greeting(date: Date) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

type Props = {
  onNavigate: (tab: 'reports' | 'chat' | 'tasks' | 'notes' | 'dashboard' | 'research' | 'goals' | 'mirror' | 'settings') => void
  onGenerateReport: (scope: ReportScope) => void
  generating: boolean
}

export default function DashboardSection({ onNavigate, onGenerateReport, generating }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const now = useNow()

  const load = useCallback(async () => {
    const [tasksRes, reportsRes, notesRes] = await Promise.all([
      fetch('/api/tasks').then((r) => r.json()),
      fetch('/api/reports').then((r) => r.json()),
      fetch('/api/notes').then((r) => r.json()),
    ])
    setTasks(Array.isArray(tasksRes) ? tasksRes : [])
    setReports(Array.isArray(reportsRes) ? reportsRes : [])
    setNotes(Array.isArray(notesRes) ? notesRes : [])
  }, [])

  useEffect(() => { load() }, [load])

  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'done').length
  const inProgress = tasks.filter((t) => t.status === 'in-progress').length
  const todo = tasks.filter((t) => t.status === 'todo').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const unassigned = tasks.filter((t) => !isPillar(t.pillar)).length

  const latestReport = reports[0] ?? null
  const reportSnippet = latestReport?.content
    ? latestReport.content.replace(/#{1,3} /g, '').slice(0, 180).trimEnd() + '…'
    : null

  const today = new Date().toISOString().split('T')[0]
  const hasReportToday = reports.some((r) => r.date === today)

  // Recent activity: merge tasks + notes, sort by created_at/updated_at descending
  const recentActivity = [
    ...tasks.slice(0, 20).map((t) => ({ type: 'task' as const, label: t.title, sub: t.status === 'done' ? 'Done' : t.status === 'in-progress' ? 'In progress' : 'To do', time: t.created_at, status: t.status })),
    ...notes.slice(0, 10).map((n) => ({ type: 'note' as const, label: n.title, sub: 'Note', time: n.updated_at, status: null })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 8)

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs text-[#9CA3AF] mb-0.5">
              {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              {' · '}
              {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </p>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">{greeting(now)}, Chiru</h1>
            <p className="text-sm text-[#6B6B6B] mt-0.5">Here's your AI Ready School overview.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onGenerateReport('All')}
              disabled={generating}
              title="Generate one report covering both pillars"
              className="flex items-center gap-1.5 bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {generating ? (
                <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating…</>
              ) : (
                <>⚡ Generate Both Pillars</>
              )}
            </button>
            <button
              onClick={() => onNavigate('chat')}
              className="flex items-center gap-1.5 bg-white hover:bg-[#F5F3EE] border border-[#E3E0D8] text-[#1A1A1A] text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            >
              💬 New Chat
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Reports', value: reports.length, sub: hasReportToday ? '✓ Today' : 'None today', color: 'text-[#D4622A]', onClick: () => onNavigate('reports') },
            { label: 'To Do', value: todo, sub: 'tasks pending', color: 'text-[#6B6B6B]', onClick: () => onNavigate('tasks') },
            { label: 'In Progress', value: inProgress, sub: 'tasks active', color: 'text-amber-600', onClick: () => onNavigate('tasks') },
            { label: 'Completed', value: done, sub: `${pct}% overall`, color: 'text-green-600', onClick: () => onNavigate('tasks') },
          ].map((c) => (
            <button
              key={c.label}
              onClick={c.onClick}
              className="bg-white border border-[#E3E0D8] rounded-xl p-4 shadow-sm text-left hover:shadow-md hover:border-[#C4BFB5] transition-all group"
            >
              <div className={`text-3xl font-bold ${c.color} group-hover:scale-105 transition-transform inline-block`}>{c.value}</div>
              <div className="text-xs font-medium text-[#1A1A1A] mt-1">{c.label}</div>
              <div className="text-xs text-[#9CA3AF]">{c.sub}</div>
            </button>
          ))}
        </div>

        {/* Overall progress bar */}
        {total > 0 && (
          <div className="bg-white border border-[#E3E0D8] rounded-xl p-4 shadow-sm">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[#6B6B6B]">Overall task progress</span>
              <span className="font-semibold text-[#1A1A1A]">{pct}%</span>
            </div>
            <div className="h-2 bg-[#F5F3EE] rounded-full overflow-hidden">
              <div className="h-full bg-[#D4622A] rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex gap-4 mt-3 text-xs text-[#9CA3AF]">
              <span><span className="inline-block w-2 h-2 rounded-full bg-[#C4BFB5] mr-1" />To do: {todo}</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />In progress: {inProgress}</span>
              <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />Done: {done}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Pillar cards — 2/3 width */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">Pillars</h2>
            {PILLARS.map((pillar) => {
              const meta = PILLAR_META[pillar]
              const pt = tasks.filter((t) => t.pillar === pillar)
              const pd = pt.filter((t) => t.status === 'done').length
              const open = [...pt.filter((t) => t.status === 'in-progress'), ...pt.filter((t) => t.status === 'todo')]
              const ppct = pt.length > 0 ? Math.round((pd / pt.length) * 100) : 0
              const own = reports.find((r) => r.vertical === pillar)
              const combined = reports.find((r) => r.vertical === 'All')
              const latest = own ?? combined

              return (
                <div
                  key={pillar}
                  className="bg-white border border-[#E3E0D8] rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-2xl leading-none">{meta.icon}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#1A1A1A]">{pillar}</div>
                      <div className="text-xs text-[#9CA3AF]">{meta.tagline}</div>
                    </div>
                    <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${meta.badge}`}>{ppct}%</span>
                    <span className="text-xs text-[#9CA3AF] mt-0.5">{pt.length} tasks</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {meta.topics.map((t) => (
                      <span key={t.label} title={t.description} className="text-[11px] text-[#6B6B6B] bg-[#F5F3EE] border border-[#E3E0D8] rounded-full px-2 py-0.5">
                        {t.icon} {t.label}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 mb-3 text-xs">
                    <span className="text-[#9CA3AF]">Latest report:</span>
                    {latest ? (
                      <button onClick={() => onNavigate('reports')} className="text-[#D4622A] hover:underline">
                        {new Date(latest.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {!own && ' (combined)'}
                      </button>
                    ) : (
                      <span className="text-[#C4BFB5]">none yet</span>
                    )}
                    <button
                      onClick={() => onGenerateReport(pillar)}
                      disabled={generating}
                      className="ml-auto text-xs font-medium px-2.5 py-1 rounded-lg border border-[#E3E0D8] text-[#1A1A1A] hover:bg-[#F5F3EE] disabled:opacity-50 transition-colors"
                    >
                      {generating ? 'Generating…' : '⚡ Generate'}
                    </button>
                  </div>

                  {pt.length > 0 ? (
                    <button onClick={() => onNavigate('tasks')} className="w-full text-left group">
                      <div className="h-1.5 bg-[#F5F3EE] rounded-full overflow-hidden mb-3">
                        <div className={`h-full ${meta.bar} rounded-full transition-all duration-500`} style={{ width: `${ppct}%` }} />
                      </div>
                      <div className="space-y-1.5">
                        {open.slice(0, 3).map((t) => (
                          <div key={t.id} className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_COLORS[t.status]}`} />
                            <span className="text-xs text-[#6B6B6B] truncate">{t.title}</span>
                          </div>
                        ))}
                        {open.length > 3 && (
                          <p className="text-xs text-[#C4BFB5] pl-3.5">+{open.length - 3} more</p>
                        )}
                      </div>
                    </button>
                  ) : (
                    <p className="text-xs text-[#C4BFB5]">No tasks yet — generate a {pillar} report to get started.</p>
                  )}
                </div>
              )
            })}
            {unassigned > 0 && (
              <button onClick={() => onNavigate('tasks')} className="text-xs text-[#9CA3AF] hover:text-[#6B6B6B] transition-colors">
                {unassigned} task{unassigned === 1 ? '' : 's'} not assigned to a pillar →
              </button>
            )}
          </div>

          {/* Right column: latest report + recent activity */}
          <div className="space-y-4">

            {/* Latest report */}
            <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">Latest Report</h2>
            {latestReport ? (
              <button
                onClick={() => onNavigate('reports')}
                className="w-full text-left bg-white border border-[#E3E0D8] rounded-xl p-4 shadow-sm hover:shadow-md hover:border-[#C4BFB5] transition-all group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-[#D4622A]">
                    {new Date(latestReport.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  {latestReport.date === today && (
                    <span className="text-xs bg-[#FEF3EC] text-[#D4622A] px-1.5 py-0.5 rounded-full border border-[#F5D3BC]">Today</span>
                  )}
                  <svg className="w-4 h-4 text-[#C4BFB5] group-hover:text-[#6B6B6B] transition-colors ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
                {reportSnippet && (
                  <p className="text-xs text-[#6B6B6B] leading-relaxed line-clamp-4">{reportSnippet}</p>
                )}
              </button>
            ) : (
              <div className="bg-white border border-dashed border-[#E3E0D8] rounded-xl p-4 text-center">
                <p className="text-xs text-[#9CA3AF]">No reports yet.</p>
                <button onClick={() => onGenerateReport('All')} disabled={generating} className="mt-2 text-xs text-[#D4622A] hover:underline disabled:opacity-50">
                  Generate your first →
                </button>
              </div>
            )}

            {/* Recent notes */}
            <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider pt-2">Recent Notes</h2>
            {notes.length > 0 ? (
              <div className="bg-white border border-[#E3E0D8] rounded-xl shadow-sm divide-y divide-[#F5F3EE]">
                {notes.slice(0, 4).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => onNavigate('notes')}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#FAF9F6] transition-colors group first:rounded-t-xl last:rounded-b-xl"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#1A1A1A] truncate flex-1 font-medium">{n.title}</span>
                      <svg className="w-3.5 h-3.5 text-[#C4BFB5] group-hover:text-[#6B6B6B] flex-shrink-0 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                    <div className="text-xs text-[#9CA3AF] mt-0.5">
                      {new Date(n.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-dashed border-[#E3E0D8] rounded-xl p-4 text-center">
                <p className="text-xs text-[#9CA3AF]">No notes yet.</p>
                <button onClick={() => onNavigate('notes')} className="mt-2 text-xs text-[#D4622A] hover:underline">
                  Create a note →
                </button>
              </div>
            )}

            {/* Recent activity */}
            {recentActivity.length > 0 && (
              <>
                <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider pt-2">Recent Activity</h2>
                <div className="bg-white border border-[#E3E0D8] rounded-xl shadow-sm divide-y divide-[#F5F3EE]">
                  {recentActivity.map((a, i) => (
                    <button
                      key={i}
                      onClick={() => onNavigate(a.type === 'task' ? 'tasks' : 'notes')}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#FAF9F6] transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xs mt-0.5 flex-shrink-0">{a.type === 'task' ? '✓' : '📝'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#1A1A1A] truncate">{a.label}</p>
                          <p className="text-xs text-[#9CA3AF]">{a.sub}</p>
                        </div>
                        {a.status && (
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${STATUS_COLORS[a.status as Task['status']]}`} />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quick nav shortcuts */}
        <div>
          <h2 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">Quick Access</h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { id: 'reports', label: 'Reports', icon: '📡' },
              { id: 'chat', label: 'Chat', icon: '💬' },
              { id: 'tasks', label: 'Tasks', icon: '✅' },
              { id: 'notes', label: 'Notes', icon: '📝' },
              { id: 'research', label: 'Research', icon: '🔍' },
              { id: 'goals', label: 'Goals', icon: '🎯' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id as Parameters<typeof onNavigate>[0])}
                className="bg-white border border-[#E3E0D8] rounded-xl p-3 text-center hover:shadow-md hover:border-[#C4BFB5] transition-all group"
              >
                <div className="text-2xl mb-1 group-hover:scale-110 transition-transform inline-block">{item.icon}</div>
                <div className="text-xs font-medium text-[#6B6B6B] group-hover:text-[#1A1A1A]">{item.label}</div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
