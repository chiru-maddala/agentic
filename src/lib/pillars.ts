// The two major pillars the app is organised around. Everything pillar-aware
// (reports, prompts, search queries, tasks, signals, tracked handles, the
// dashboard) reads from this file, so changing a topic here changes it everywhere.
//
// AI Education      — learning ABOUT AI: what exists, how it works, what K-12
//                     students need to know and build.
// Education with AI — teaching K-12 kids WITH AI: tools, policies, platforms,
//                     use cases and evidence.

export const PILLARS = ['AI Education', 'Education with AI'] as const
export type Pillar = (typeof PILLARS)[number]

// A report is scoped to one pillar, or to 'All' (both pillars in one report).
// 'All' is also what every report stored before pillars existed defaults to.
export const REPORT_SCOPES = ['All', ...PILLARS] as const
export type ReportScope = (typeof REPORT_SCOPES)[number]

export type PillarTopic = {
  label: string
  icon: string
  description: string
}

export type PillarMeta = {
  icon: string
  tagline: string
  description: string
  badge: string // Tailwind classes for pills
  bar: string // Tailwind class for progress bars
  topics: PillarTopic[]
}

export const PILLAR_META: Record<Pillar, PillarMeta> = {
  'AI Education': {
    icon: '🧠',
    tagline: 'Learning about AI',
    description:
      'Everything students, teachers and schools need to know about AI itself — literacy, engineering, physical AI, models, hardware and tools — plus AI-education developments aimed squarely at K-12.',
    badge: 'bg-[#EAF2FF] text-[#2563EB]',
    bar: 'bg-blue-400',
    topics: [
      {
        label: 'AI Literacy',
        icon: '📖',
        description:
          'AI literacy frameworks and curricula, computational thinking, critical evaluation of AI output, responsible use, and explaining how AI works to young learners.',
      },
      {
        label: 'AI Engineering',
        icon: '🛠️',
        description:
          'Building with AI — agents and agentic frameworks, prompt and context engineering, RAG, evals, AI coding assistants, and the skills pipeline for young builders.',
      },
      {
        label: 'Physical AI',
        icon: '🤖',
        description:
          'Robotics, humanoids, embodied AI, autonomous systems, drones and edge/IoT AI, including robotics kits and programs students can use.',
      },
      {
        label: 'AI Models',
        icon: '🧬',
        description:
          'Frontier and open-weight model releases, benchmarks, multimodal and reasoning advances, small on-device models, and shifts in capability or safety.',
      },
      {
        label: 'AI Hardware',
        icon: '💾',
        description:
          'GPUs and accelerators, chips, edge devices, AI PCs and classroom devices, compute cost, and what is becoming affordable or available to schools.',
      },
      {
        label: 'AI Tools',
        icon: '🧰',
        description:
          'General-purpose AI tools and products people use every day — assistants, creative, productivity and research tools — and how they change what students need to learn.',
      },
      {
        label: 'K-12 Specific',
        icon: '🎒',
        description:
          'AI-education developments aimed at K-12: standards (e.g. AI4K12, CSTA), curricula, competitions, student-facing AI programs, certifications, and vendors in the space.',
      },
      {
        label: 'Other AI Updates',
        icon: '📡',
        description:
          'Any other notable AI development that does not fit above — funding, partnerships, regulation, research, and industry moves that will reach K-12.',
      },
    ],
  },
  'Education with AI': {
    icon: '🎓',
    tagline: 'Teaching with AI',
    description:
      'Teaching and running K-12 schools with AI — AI-powered tools, policies, platforms, use cases and reports.',
    badge: 'bg-[#E9F9F0] text-[#0D9463]',
    bar: 'bg-emerald-400',
    topics: [
      {
        label: 'AI-Powered Tools',
        icon: '✨',
        description:
          'AI tools for teaching and learning — tutors, student and teacher co-pilots, lesson and assessment generators, feedback and grading aids, accessibility and translation tools.',
      },
      {
        label: 'Policies',
        icon: '🛡️',
        description:
          'AI-in-education policy and guidance — federal, state and district rules, COPPA/FERPA and student data protection, academic integrity, responsible-AI practices, and procurement.',
      },
      {
        label: 'Platforms',
        icon: '🏫',
        description:
          'Platform and edtech moves — LMS and school-management platforms adding AI, big-tech education launches, interoperability, partnerships, and pricing.',
      },
      {
        label: 'Use Cases',
        icon: '🍎',
        description:
          'Real classroom, school and district examples — pilots, deployments, lessons learned, what worked and what failed, by grade band and subject.',
      },
      {
        label: 'Reports & Research',
        icon: '📊',
        description:
          'Studies, surveys, market reports and evidence on AI in K-12 — adoption rates, learning outcomes, teacher and student sentiment, and efficacy research.',
      },
      {
        label: 'Other Education Updates',
        icon: '📰',
        description:
          'Any other news about teaching K-12 students with AI that does not fit above.',
      },
    ],
  },
}

export const SCOPE_LABELS: Record<ReportScope, string> = {
  All: 'Both pillars',
  'AI Education': 'AI Education',
  'Education with AI': 'Education with AI',
}

// Badge styles for any scope, including the combined 'All' report.
export const SCOPE_BADGE: Record<ReportScope, string> = {
  All: 'bg-[#FEF3EC] text-[#D4622A]',
  'AI Education': PILLAR_META['AI Education'].badge,
  'Education with AI': PILLAR_META['Education with AI'].badge,
}

export function isReportScope(value: unknown): value is ReportScope {
  return typeof value === 'string' && (REPORT_SCOPES as readonly string[]).includes(value)
}

export function isPillar(value: unknown): value is Pillar {
  return typeof value === 'string' && (PILLARS as readonly string[]).includes(value)
}

export function parseReportScope(value: unknown): ReportScope {
  return isReportScope(value) ? value : 'All'
}

// The pillars a scope covers.
export function pillarsForScope(scope: ReportScope): Pillar[] {
  return scope === 'All' ? [...PILLARS] : [scope]
}
