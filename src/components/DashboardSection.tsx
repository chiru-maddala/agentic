'use client'

import { useCallback, useEffect, useState } from 'react'

type Task = {
  id: string
  title: string
  description: string | null
  pillar: string
  status: 'todo' | 'in-progress' | 'done'
  source: 'manual' | 'report'
}

const PILLARS = ['Learning AI', 'Enterprise AI', 'AI Infrastructure', 'General']

const PILLAR_ICONS: Record<string, string> = {
  'Learning AI': '📚',
  'Enterprise AI': '🤖',
  'AI Infrastructure': '☁️',
  'General': '📋',
}

const STATUS_COLORS: Record<Task['status'], string> = {
  'todo': 'bg-gray-600',
  'in-progress': 'bg-amber-500',
  'done': 'bg-green-500',
}

export default function DashboardSection() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [reports, setReports] = useState<{ id: string; date: string }[]>([])

  const load = useCallback(async () => {
    const [tasksRes, reportsRes] = await Promise.all([
      fetch('/api/tasks').then((r) => r.json()),
      fetch('/api/reports').then((r) => r.json()),
    ])
    setTasks(Array.isArray(tasksRes) ? tasksRes : [])
    setReports(Array.isArray(reportsRes) ? reportsRes : [])
  }, [])

  useEffect(() => { load() }, [load])

  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'done').length
  const inProgress = tasks.filter((t) => t.status === 'in-progress').length
  const todo = tasks.filter((t) => t.status === 'todo').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-xl font-semibold text-white mb-6">Dashboard</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 mb-8 sm:grid-cols-4">
          {[
            { label: 'Total Tasks', value: total, color: 'text-white' },
            { label: 'To Do', value: todo, color: 'text-gray-300' },
            { label: 'In Progress', value: inProgress, color: 'text-amber-400' },
            { label: 'Done', value: done, color: 'text-green-400' },
          ].map((c) => (
            <div key={c.label} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
              <div className="text-xs text-gray-500 mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-8">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>Overall Progress</span>
              <span>{pct}% complete</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="text-2xl font-bold text-indigo-400">{reports.length}</div>
            <div className="text-xs text-gray-500 mt-1">Intelligence Reports</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="text-2xl font-bold text-indigo-400">{tasks.filter((t) => t.source === 'report').length}</div>
            <div className="text-xs text-gray-500 mt-1">Tasks from Reports</div>
          </div>
        </div>

        {/* Tasks by pillar */}
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Tasks by Pillar</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PILLARS.map((pillar) => {
            const pillarTasks = tasks.filter((t) => t.pillar === pillar)
            const pillarDone = pillarTasks.filter((t) => t.status === 'done').length
            const pillarPct = pillarTasks.length > 0 ? Math.round((pillarDone / pillarTasks.length) * 100) : 0

            return (
              <div key={pillar} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{PILLAR_ICONS[pillar]}</span>
                  <span className="text-sm font-medium text-white">{pillar}</span>
                  <span className="ml-auto text-xs text-gray-500">{pillarTasks.length} tasks</span>
                </div>

                {pillarTasks.length > 0 ? (
                  <>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${pillarPct}%` }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      {pillarTasks.slice(0, 4).map((t) => (
                        <div key={t.id} className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_COLORS[t.status]}`} />
                          <span className={`text-xs truncate ${t.status === 'done' ? 'line-through text-gray-600' : 'text-gray-300'}`}>
                            {t.title}
                          </span>
                        </div>
                      ))}
                      {pillarTasks.length > 4 && (
                        <p className="text-xs text-gray-600 pl-3.5">+{pillarTasks.length - 4} more</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-600">No tasks yet.</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
