'use client'

import { useEffect, useState } from 'react'
import { SCOPE_BADGE, SCOPE_LABELS, isReportScope, type ReportScope } from '@/lib/pillars'

type ReportMeta = {
  id: string
  date: string
  created_at: string
  vertical?: string
}

type Props = {
  selectedId: string | null
  onSelect: (id: string, date: string, created_at: string) => void
  filterScope?: ReportScope | 'any'
}

export default function ReportHistory({ selectedId, onSelect, filterScope = 'any' }: Props) {
  const [reports, setReports] = useState<ReportMeta[]>([])

  useEffect(() => {
    const qs = filterScope === 'any' ? '' : `?vertical=${encodeURIComponent(filterScope)}`
    fetch(`/api/reports${qs}`)
      .then((r) => r.json())
      .then((data) => setReports(Array.isArray(data) ? data : []))
  }, [filterScope])

  if (reports.length === 0) {
    return (
      <div className="text-sm text-[#9CA3AF] px-2 py-4">No reports yet.</div>
    )
  }

  return (
    <ul className="space-y-1">
      {reports.map((r) => {
        const dt = new Date(r.created_at)
        const datePart = dt.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        const timePart = dt.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
        return (
          <li key={r.id}>
            <button
              onClick={() => onSelect(r.id, r.date, r.created_at)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedId === r.id
                  ? 'bg-[#E8E4DC] text-[#1A1A1A] font-medium'
                  : 'text-[#6B6B6B] hover:bg-[#ECEAE3] hover:text-[#1A1A1A]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium truncate">{datePart}</div>
                {isReportScope(r.vertical) && (
                  <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${SCOPE_BADGE[r.vertical]}`}>
                    {SCOPE_LABELS[r.vertical]}
                  </span>
                )}
              </div>
              <div className={`text-xs mt-0.5 ${selectedId === r.id ? 'text-[#6B6B6B]' : 'text-[#9CA3AF]'}`}>
                {timePart}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
