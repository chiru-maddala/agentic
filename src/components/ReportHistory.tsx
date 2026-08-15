'use client'

import { useEffect, useState } from 'react'
import type { Vertical } from '@/lib/prompt'

type ReportMeta = {
  id: string
  date: string
  created_at: string
  vertical?: Vertical
}

type Props = {
  selectedId: string | null
  onSelect: (id: string, date: string, created_at: string) => void
  filterVertical?: Vertical | 'All Verticals'
}

const VERTICAL_BADGE_STYLES: Record<string, string> = {
  'Learning AI': 'bg-[#EAF2FF] text-[#2563EB]',
  'Enterprise AI': 'bg-[#F1EAFE] text-[#7C3AED]',
  'AI Infrastructure': 'bg-[#E9F9F0] text-[#0D9463]',
  'All': 'bg-[#FEF3EC] text-[#D4622A]',
}

export default function ReportHistory({ selectedId, onSelect, filterVertical = 'All Verticals' }: Props) {
  const [reports, setReports] = useState<ReportMeta[]>([])

  useEffect(() => {
    const qs = filterVertical !== 'All Verticals' ? `?vertical=${encodeURIComponent(filterVertical)}` : ''
    fetch(`/api/reports${qs}`)
      .then((r) => r.json())
      .then(setReports)
  }, [filterVertical])

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
        const vertical = r.vertical ?? 'All'
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
                <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${VERTICAL_BADGE_STYLES[vertical] ?? VERTICAL_BADGE_STYLES.All}`}>
                  {vertical === 'All' ? 'All Pillars' : vertical}
                </span>
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
