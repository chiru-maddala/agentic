'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'

type Doc = {
  id: string
  title: string
  document_content: string
  created_at: string
}

export default function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [doc, setDoc] = useState<Doc | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/share/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setNotFound(true)
        else setDoc(data)
      })
  }, [id])

  const downloadPDF = async () => {
    if (!doc) return
    const { default: html2canvas } = await import('html2canvas')
    const { default: jsPDF } = await import('jspdf')
    const el = document.getElementById('share-doc-content')
    if (!el) return
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' })
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const margin = 30
    const imgW = pageW - margin * 2
    const imgH = (canvas.height * imgW) / canvas.width
    const contentH = pdf.internal.pageSize.getHeight() - margin * 2
    const pages = Math.ceil(imgH / contentH)
    for (let i = 0; i < pages; i++) {
      if (i > 0) pdf.addPage()
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin - i * contentH, imgW, imgH)
    }
    pdf.save(`${doc.title.slice(0, 40)}.pdf`)
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl mb-2">🔍</p>
          <h1 className="text-lg font-semibold text-[#1A1A1A] mb-1">Document not found</h1>
          <p className="text-sm text-[#9CA3AF]">This document may not exist or hasn&apos;t been generated yet.</p>
        </div>
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <span className="w-5 h-5 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Header */}
      <header className="bg-white border-b border-[#E3E0D8] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-[#D4622A]">IntelliRadar</span>
            <span className="text-[#E3E0D8]">·</span>
            <span className="text-sm text-[#6B6B6B] truncate max-w-xs">{doc.title}</span>
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

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-[#1A1A1A] mb-2">{doc.title}</h1>
        <p className="text-xs text-[#9CA3AF] mb-8">
          Generated {new Date(doc.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <div
          id="share-doc-content"
          className="prose prose-sm max-w-none
            prose-headings:text-[#1A1A1A] prose-headings:font-semibold
            prose-p:text-[#374151] prose-p:leading-relaxed
            prose-strong:text-[#1A1A1A]
            prose-li:text-[#374151]
            prose-th:text-[#1A1A1A] prose-td:text-[#374151]"
          dangerouslySetInnerHTML={{ __html: doc.document_content }}
        />
      </main>

      <footer className="border-t border-[#E3E0D8] py-6 mt-10">
        <p className="text-center text-xs text-[#C4BFB5]">Powered by IntelliRadar · Intellina AI</p>
      </footer>
    </div>
  )
}
