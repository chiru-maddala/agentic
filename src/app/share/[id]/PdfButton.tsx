'use client'

export default function PdfButton({ title }: { title: string }) {
  const download = async () => {
    const { default: html2canvas } = await import('html2canvas')
    const { default: jsPDF } = await import('jspdf')
    const el = document.getElementById('share-doc-content')
    if (!el) return
    const clone = el.cloneNode(true) as HTMLElement
    clone.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:760px;padding:48px;background:white;color:#111827;font-family:Georgia,serif;font-size:14px;line-height:1.8;'
    const style = document.createElement('style')
    style.textContent = '*{color:#111827!important;background:transparent!important}h1,h2,h3,h4{color:#1f2937!important;margin-top:1em}table{border-collapse:collapse;width:100%}td,th{border:1px solid #e5e7eb!important;padding:6px 10px}th{background:#f9fafb!important}'
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
      pdf.save(`${title.slice(0, 40)}.pdf`)
    } finally {
      document.body.removeChild(clone)
    }
  }

  return (
    <button
      onClick={download}
      className="flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-[#1A1A1A] bg-[#F5F3EE] hover:bg-[#ECEAE3] border border-[#E3E0D8] px-3 py-1.5 rounded-lg transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
      Download PDF
    </button>
  )
}
