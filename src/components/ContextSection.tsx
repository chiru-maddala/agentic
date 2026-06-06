'use client'

import { useCallback, useEffect, useState } from 'react'

const REPORTS_DEFAULT = `You are Intellina Intelligence Agent (IntelliRadar), an expert-level autonomous AI research assistant working directly for the Co-founder & CEO of Intellina AI, Inc.

Your sole mission is to deliver high-signal, actionable intelligence every day from X (Twitter) and related sources to help Intellina AI make better strategic, product, and learning decisions.

### Company Context (Internal Knowledge - Never Forget)
Intellina AI has three core pillars:

1. **Learning AI**
   - AI Ready School (K-12): Cypher (student AI companion), Morpheus (teaching agents), Zion (safe playground), NEO (CoE), Matrix (local infra)
   - AutoCampus (Higher Education): Intelligent Campus OS with World Signal Feed, Knowledge Graph, 4 Studios (Student, Professor, VC, Employer), Readiness Score, Talent Reservation
   - RED AI Academy (Graduates & Professionals): 9 specialized courses including Agentic AI Engineering, Enterprise AI Engineering, AI Ops, AI Data Center Engineering, Physical AI Engineering, etc.

2. **Enterprise AI**
   - Orchea.ai: No-code Intelligent Agent Orchestration platform for Databricks. Uses T2 Framework (Computational + Agentic + Design Thinking), visual canvas, strong RAG + guardrails, auditability.

3. **AI Infrastructure**
   - TerraNine.ai (In Space)
   - MATRIX (On Ground)

### Intelligence Rules
- Always connect insights back to specific Intellina products (Cypher, Morpheus, AutoCampus Studios, T2 Framework, World Signal Feed, Readiness Score, etc.).
- Prioritize actionable over descriptive. Every insight should end with "Why it matters for Intellina" and "Recommended Action".
- Filter aggressively for signal vs noise. Only high-relevance, high-impact items.
- Be concise but insightful. Use bullet points and tables where effective.
- Maintain professional but sharp tone.

### Output Format
Always respond in clean, well-formatted Markdown with proper headings and emojis as shown below.

Begin every response with:
**✅ Intellina AI Daily Research Report**
**Date:** [Current Date]

Then produce a structured Daily Intelligence Report with these sections:

1. **📚 Learning AI Pillar** — Insights on K-12, Higher Education, Professional upskilling. Focus on personalized learning, knowledge graphs, world signals, AI tutors, curriculum adaptation, talent pipelines.

2. **🤖 Enterprise AI Pillar (Orchea.ai)** — Agentic systems, orchestration frameworks, multi-agent tools, no-code/low-code agents, Databricks ecosystem, cost-efficiency, guardrails.

3. **☁️ AI Infrastructure Pillar** — Compute economics, CPU vs GPU shifts, space/edge/distributed AI, power & cooling, inference optimization.

4. **🚀 New Models, Agentic Systems, Frameworks & Breakthroughs** — Most important new releases, papers, tools, or paradigm shifts.

5. **Daily Learning Plan for CEO** — 30-60 minute focused learning plan (Morning / Mid-day / Evening) with specific resources, experiments, or reflections tied to Intellina products.

6. **Priority Actions & Opportunities** — Concrete next steps for product, content, or strategy.`

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function ContextBlock({
  label,
  description,
  value,
  onChange,
  saveState,
  onSave,
  badge,
}: {
  label: string
  description: string
  value: string
  onChange: (v: string) => void
  saveState: SaveState
  onSave: () => void
  badge?: string
}) {
  return (
    <div className="bg-white border border-[#E3E0D8] rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-start justify-between px-5 py-4 border-b border-[#E3E0D8]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[#1A1A1A]">{label}</h2>
            {badge && (
              <span className="text-xs bg-[#FEF3EC] text-[#D4622A] border border-[#F5D3BC] px-2 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-[#9CA3AF] mt-0.5">{description}</p>
        </div>
        <button
          onClick={onSave}
          disabled={saveState === 'saving'}
          className={`flex-shrink-0 ml-4 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
            saveState === 'saved'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : saveState === 'error'
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-[#D4622A] hover:bg-[#C05520] text-white disabled:opacity-50'
          }`}
        >
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : saveState === 'error' ? 'Error' : 'Save'}
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={18}
        spellCheck={false}
        className="w-full px-5 py-4 text-sm text-[#374151] bg-[#FAF9F6] font-mono leading-relaxed resize-none focus:outline-none focus:bg-white transition-colors"
        placeholder={label === 'Others' ? 'Add any additional business context here — your clients, goals, products, team, or anything else Claude should know when completing tasks and generating courses…' : ''}
      />
    </div>
  )
}

export default function ContextSection() {
  const [reportsCtx, setReportsCtx] = useState(REPORTS_DEFAULT)
  const [othersCtx, setOthersCtx] = useState('')
  const [reportsSave, setReportsSave] = useState<SaveState>('idle')
  const [othersSave, setOthersSave] = useState<SaveState>('idle')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data.reports_context) setReportsCtx(data.reports_context)
      if (data.business_context) setOthersCtx(data.business_context)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async (key: string, value: string, setStatus: (s: SaveState) => void) => {
    setStatus('saving')
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2500)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm text-[#9CA3AF]">Loading…</span>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#FAF9F6]">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-[#1A1A1A]">Context</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            Manage the context Claude uses when generating content. Changes are saved to the database and take effect on the next run.
          </p>
        </div>

        <div className="bg-[#FEF9EC] border border-amber-200 rounded-xl px-5 py-3 flex items-start gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" className="flex-shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Reports context</strong> is stored here for reference but is <strong>not yet connected</strong> to the report generator — you control when that switch is made. <strong>Others context</strong> is already injected into the Task Agent and Course generator.
          </p>
        </div>

        <ContextBlock
          label="Reports"
          description="System prompt used by IntelliRadar to generate daily reports. Stored here for editing — not yet wired to the generator."
          badge="Read-only from generator"
          value={reportsCtx}
          onChange={setReportsCtx}
          saveState={reportsSave}
          onSave={() => save('reports_context', reportsCtx, setReportsSave)}
        />

        <ContextBlock
          label="Others"
          description="Additional business context injected into Task Agent completions and Course generation. Add anything Claude should know about your businesses, clients, or goals."
          value={othersCtx}
          onChange={setOthersCtx}
          saveState={othersSave}
          onSave={() => save('business_context', othersCtx, setOthersSave)}
        />
      </div>
    </div>
  )
}
