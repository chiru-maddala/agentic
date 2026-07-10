'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ContextMenuWrapper from './ContextMenuWrapper'

export type TwitterSource = {
  id: string
  url: string
  username: string
  text: string
  query?: string
}

type Props = {
  content: string
  streaming?: boolean
  onCourseCreated?: () => void
  twitterSources?: TwitterSource[]
}

export default function ReportDisplay({ content, streaming, onCourseCreated, twitterSources }: Props) {
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

      {!streaming && twitterSources && twitterSources.length > 0 && (
        <div className="mt-8 pt-6 border-t border-[#E3E0D8]">
          <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">
            Twitter/X Sources ({twitterSources.length})
          </p>
          <div className="flex flex-col gap-2">
            {twitterSources.map((s) => (
              <a
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 text-xs bg-white border border-[#E3E0D8] hover:border-[#D4622A] px-3 py-2 rounded-lg text-[#374151] hover:text-[#D4622A] transition-colors"
              >
                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.9 1.153h3.68l-8.04 9.19L24 22.847h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
                </svg>
                <span className="flex-1">
                  <span className="font-medium">@{s.username}</span>
                  <span className="text-[#6B6B6B]"> — {s.text.length > 120 ? s.text.slice(0, 118) + '…' : s.text}</span>
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </ContextMenuWrapper>
  )
}
