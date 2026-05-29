'use client'

import { useCallback, useEffect, useState } from 'react'

type Task = {
  id: string
  title: string
  description: string | null
  pillar: string
  status: 'todo' | 'in-progress' | 'done'
  source: 'manual' | 'report'
  created_at: string
}

const PILLARS = ['Learning AI', 'Enterprise AI', 'AI Infrastructure', 'General']
const STATUSES: Task['status'][] = ['todo', 'in-progress', 'done']
const STATUS_LABELS: Record<Task['status'], string> = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'done': 'Done',
}
const STATUS_COLORS: Record<Task['status'], string> = {
  'todo': 'bg-gray-700 text-gray-300',
  'in-progress': 'bg-amber-900 text-amber-300',
  'done': 'bg-green-900 text-green-300',
}

export default function TasksSection() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', pillar: 'General' })
  const [filterPillar, setFilterPillar] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    const res = await fetch('/api/tasks')
    const data = await res.json()
    setTasks(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  const createTask = async () => {
    if (!form.title.trim()) return
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ title: '', description: '', pillar: 'General' })
    setShowForm(false)
    loadTasks()
  }

  const updateStatus = async (id: string, status: Task['status']) => {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    loadTasks()
  }

  const deleteTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    loadTasks()
  }

  const filtered = tasks.filter((t) => {
    if (filterPillar && t.pillar !== filterPillar) return false
    if (filterStatus && t.status !== filterStatus) return false
    return true
  })

  const grouped = PILLARS.reduce((acc, pillar) => {
    acc[pillar] = filtered.filter((t) => t.pillar === pillar)
    return acc
  }, {} as Record<string, Task[]>)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-white">Tasks</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            + Add Task
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-6 space-y-3">
            <input
              type="text"
              placeholder="Task title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-400"
            />
            <textarea
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-400"
            />
            <div className="flex items-center gap-3">
              <select
                value={form.pillar}
                onChange={(e) => setForm({ ...form, pillar: e.target.value })}
                className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {PILLARS.map((p) => <option key={p}>{p}</option>)}
              </select>
              <button
                onClick={createTask}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilterPillar(null)}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${!filterPillar ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            All Pillars
          </button>
          {PILLARS.map((p) => (
            <button
              key={p}
              onClick={() => setFilterPillar(filterPillar === p ? null : p)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${filterPillar === p ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              {p}
            </button>
          ))}
          <div className="w-px bg-gray-700 mx-1" />
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? null : s)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${filterStatus === s ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Columns by pillar */}
        <div className="space-y-8">
          {PILLARS.map((pillar) => {
            const pillarTasks = grouped[pillar]
            if (filterPillar && filterPillar !== pillar) return null
            if (pillarTasks.length === 0 && filterPillar !== pillar) return null
            return (
              <div key={pillar}>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  {pillar} <span className="text-gray-600 font-normal normal-case">({pillarTasks.length})</span>
                </h2>
                {pillarTasks.length === 0 ? (
                  <p className="text-xs text-gray-600 px-1">No tasks.</p>
                ) : (
                  <div className="space-y-2">
                    {pillarTasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 flex items-start gap-3 group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm ${task.status === 'done' ? 'line-through text-gray-500' : 'text-white'}`}>
                              {task.title}
                            </span>
                            {task.source === 'report' && (
                              <span className="text-xs bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded-full">from report</span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <select
                            value={task.status}
                            onChange={(e) => updateStatus(task.id, e.target.value as Task['status'])}
                            className={`text-xs rounded-full px-2.5 py-1 focus:outline-none cursor-pointer ${STATUS_COLORS[task.status]}`}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-12">No tasks yet. Click &quot;Add Task&quot; to create one.</div>
          )}
        </div>
      </div>
    </div>
  )
}
