'use client'

import { useEffect, useState } from 'react'

type ReportMeta = {
  id: string
  date: string
  created_at: string
}

type Props = {
  selectedId: string | null
  onSelect: (id: string, date: string) => void
}

export default function ReportHistory({ selectedId, onSelect }: Props) {
  const [reports, setReports] = useState<ReportMeta[]>([])

  useEffect(() => {
    fetch('/api/reports')
      .then((r) => r.json())
      .then(setReports)
  }, [])

  if (reports.length === 0) {
    return (
      <div className="text-sm text-gray-500 px-2 py-4">No reports yet.</div>
    )
  }

  return (
    <ul className="space-y-1">
      {reports.map((r) => (
        <li key={r.id}>
          <button
            onClick={() => onSelect(r.id, r.date)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedId === r.id
                ? 'bg-indigo-600 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            {new Date(r.date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </button>
        </li>
      ))}
    </ul>
  )
}
