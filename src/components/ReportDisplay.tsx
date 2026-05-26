'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Props = {
  content: string
  streaming?: boolean
}

export default function ReportDisplay({ content, streaming }: Props) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      {streaming && (
        <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-1 align-middle" />
      )}
    </div>
  )
}
