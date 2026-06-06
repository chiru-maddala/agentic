'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ContextMenuWrapper from './ContextMenuWrapper'

type Props = {
  content: string
  streaming?: boolean
  onCourseCreated?: () => void
}

export default function ReportDisplay({ content, streaming, onCourseCreated }: Props) {
  return (
    <ContextMenuWrapper onCourseCreated={onCourseCreated} showCourse>
      <div className="prose prose-sm max-w-none
        prose-headings:text-[#1A1A1A] prose-headings:font-semibold
        prose-p:text-[#374151] prose-p:leading-relaxed
        prose-strong:text-[#1A1A1A]
        prose-a:text-[#D4622A] prose-a:no-underline hover:prose-a:underline
        prose-code:text-[#D4622A] prose-code:bg-[#FEF3EC] prose-code:px-1 prose-code:rounded
        prose-pre:bg-[#F5F3EE] prose-pre:border prose-pre:border-[#E3E0D8]
        prose-blockquote:border-l-[#D4622A] prose-blockquote:text-[#6B6B6B]
        prose-hr:border-[#E3E0D8]
        prose-li:text-[#374151]
        prose-th:text-[#1A1A1A] prose-td:text-[#374151]">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        {streaming && (
          <span className="inline-block w-2 h-4 bg-[#D4622A] animate-pulse ml-1 align-middle rounded-sm" />
        )}
      </div>
    </ContextMenuWrapper>
  )
}
