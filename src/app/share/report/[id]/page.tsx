'use client'

import { use, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Report = {
  id: string
  date: string
  content: string
  created_at: string
}

export default function ShareReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [report, setReport] = useState<Report | null>(null)
  const [notFound, setNotFound] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/share/report/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setNotFound(true)
        else setReport(data)
      })
  }, [id])

  const downloadPDF = async () => {
    if (!contentRef.current) return
    const { default: html2canvas } = await import('html2canvas')
    const { default: jsPDF } = await import('jspdf')
    const clone = contentRef.current.cloneNode(true) as HTMLElement
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
      pdf.save(`IntelliRadar-${report?.date ?? id}.pdf`)
    } finally {
      document.body.removeChild(clone)
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl mb-2">🔍</p>
          <h1 className="text-lg font-semibold text-[#1A1A1A] mb-1">Report not found</h1>
          <p className="text-sm text-[#9CA3AF]">This report may not exist or has been deleted.</p>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <span className="w-5 h-5 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const formatted = new Date(report.created_at).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Header */}
      <header className="bg-white border-b border-[#E3E0D8] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-[#D4622A]">IntelliRadar</span>
            <span className="text-[#E3E0D8]">·</span>
            <span className="text-sm text-[#6B6B6B]">Daily Intelligence Report</span>
          </div>
          <button
            onClick={downloadPDF}
            className="flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-[#1A1A1A] bg-[#F5F3EE] hover:bg-[#ECEAE3] border border-[#E3E0D8] px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Download PDF
          </button>
        </div>
      </header>

      {/* Report */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-xs text-[#9CA3AF] mb-8">{formatted}</p>
        <div
          ref={contentRef}
          className="prose prose-sm max-w-none
            prose-headings:text-[#1A1A1A] prose-headings:font-semibold
            prose-p:text-[#374151] prose-p:leading-relaxed
            prose-strong:text-[#1A1A1A]
            prose-a:text-[#D4622A] prose-a:no-underline hover:prose-a:underline
            prose-code:text-[#D4622A] prose-code:bg-[#FEF3EC] prose-code:px-1 prose-code:rounded
            prose-pre:bg-[#F5F3EE] prose-pre:border prose-pre:border-[#E3E0D8]
            prose-blockquote:border-l-[#D4622A] prose-blockquote:text-[#6B6B6B]
            prose-li:text-[#374151]
            prose-th:text-[#1A1A1A] prose-td:text-[#374151]"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.content}</ReactMarkdown>
        </div>
      </main>

      <footer className="border-t border-[#E3E0D8] py-6 mt-10">
        <p className="text-center text-xs text-[#C4BFB5]">Powered by IntelliRadar · Intellina AI</p>
      </footer>
    </div>
  )
}
