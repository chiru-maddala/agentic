'use client'

import { useEffect, useState } from 'react'

type UserProfile = {
  id: string
  email: string
  full_name: string | null
  approved: boolean
  created_at: string
}

export default function UserManagementSection() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  const fetchUsers = async () => {
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setUsers(Array.isArray(data) ? data : [])
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

  const pending = users.filter((u) => !u.approved)
  const approved = users.filter((u) => u.approved)

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#FAF9F6]">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-[#1A1A1A]">User Management</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">Approve or revoke access for registered users.</p>
        </div>

        {loading ? (
          <p className="text-sm text-[#9CA3AF]">Loading…</p>
        ) : (
          <>
            {/* Pending */}
            <div className="bg-white border border-[#E3E0D8] rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-[#E3E0D8] flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[#1A1A1A]">Pending Approval</h2>
                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                  {pending.length}
                </span>
              </div>
              {pending.length === 0 ? (
                <p className="text-sm text-[#9CA3AF] px-5 py-4">No pending requests.</p>
              ) : (
                <ul className="divide-y divide-[#E3E0D8]">
                  {pending.map((u) => (
                    <li key={u.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-[#1A1A1A]">{u.full_name || '—'}</p>
                        <p className="text-xs text-[#9CA3AF]">{u.email}</p>
                        <p className="text-xs text-[#C4BFB5] mt-0.5">
                          {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleApprove(u.id, true)}
                        disabled={actionId === u.id}
                        className="bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {actionId === u.id ? 'Approving…' : 'Approve'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Approved */}
            <div className="bg-white border border-[#E3E0D8] rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-[#E3E0D8] flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[#1A1A1A]">Approved Users</h2>
                <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                  {approved.length}
                </span>
              </div>
              {approved.length === 0 ? (
                <p className="text-sm text-[#9CA3AF] px-5 py-4">No approved users yet.</p>
              ) : (
                <ul className="divide-y divide-[#E3E0D8]">
                  {approved.map((u) => (
                    <li key={u.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-[#1A1A1A]">{u.full_name || '—'}</p>
                        <p className="text-xs text-[#9CA3AF]">{u.email}</p>
                      </div>
                      <button
                        onClick={() => handleApprove(u.id, false)}
                        disabled={actionId === u.id}
                        className="text-xs text-[#9CA3AF] hover:text-red-500 disabled:opacity-50 transition-colors px-2 py-1"
                      >
                        Revoke
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
