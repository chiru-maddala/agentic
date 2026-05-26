'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

type UserProfile = {
  id: string
  email: string
  full_name: string | null
  approved: boolean
  created_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  const fetchUsers = async () => {
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setUsers(data)
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const handleApprove = async (id: string, approve: boolean) => {
    setActionId(id)
    await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved: approve }),
    })
    await fetchUsers()
    setActionId(null)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const pending = users.filter((u) => !u.approved)
  const approved = users.filter((u) => u.approved)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-indigo-400 font-bold text-lg">IntelliRadar</span>
          <span className="text-gray-500 text-sm ml-3">Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Dashboard
          </button>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-xl font-semibold mb-8">User Management</h1>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : (
          <>
            <section className="mb-10">
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                Pending Approval ({pending.length})
              </h2>
              {pending.length === 0 ? (
                <p className="text-gray-600 text-sm">No pending requests.</p>
              ) : (
                <ul className="space-y-3">
                  {pending.map((u) => (
                    <li
                      key={u.id}
                      className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{u.full_name || '—'}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {new Date(u.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleApprove(u.id, true)}
                        disabled={actionId === u.id}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {actionId === u.id ? 'Approving...' : 'Approve'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                Approved Users ({approved.length})
              </h2>
              {approved.length === 0 ? (
                <p className="text-gray-600 text-sm">No approved users yet.</p>
              ) : (
                <ul className="space-y-3">
                  {approved.map((u) => (
                    <li
                      key={u.id}
                      className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{u.full_name || '—'}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                      <button
                        onClick={() => handleApprove(u.id, false)}
                        disabled={actionId === u.id}
                        className="text-xs text-gray-500 hover:text-red-400 disabled:opacity-50 transition-colors"
                      >
                        Revoke
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
