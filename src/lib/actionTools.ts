import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'
import { categoryForType } from '@/lib/signals'
import { computeGoalPacing } from '@/lib/goals'
import { extractHashtags, MAX_LENGTH as MAX_THOUGHT_LENGTH } from '@/app/api/mirror/thoughts/route'

const GOAL_PILLARS = ['Learning AI', 'Enterprise AI', 'AI Infrastructure']

const PACING_LABEL: Record<string, string> = {
  'no-target': '',
  'no-progress': ' — no progress logged yet',
  ahead: ' — AHEAD OF PACE',
  'on-pace': ' — on pace',
  behind: ' — BEHIND PACE',
  overdue: ' — OVERDUE',
}

export type CaptureSource = 'chat' | 'voice'

export type CapturedEntity = {
  table: 'tasks' | 'notes' | 'mirror_thoughts' | 'meetings'
  id: string
  label: string
}

export type ToolResult = {
  text: string
  created?: CapturedEntity
}

export const CAPTURE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_task',
    description: 'Create a new task in the Tasks app. Use this for anything actionable — a to-do, reminder, or follow-up.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short task title' },
        description: { type: 'string', description: 'Optional longer description' },
        pillar: {
          type: 'string',
          enum: ['Learning AI', 'Enterprise AI', 'AI Infrastructure', 'General'],
          description: 'Which Intellina pillar this task belongs to',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'create_note',
    description: 'Create a new note in the Notes app. Use this for explicit "note" content or longer reference material worth saving.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title' },
        content: { type: 'string', description: 'Note body in markdown' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'create_thought',
    description: 'Save a spontaneous Thought — a short reflection, opinion, or idea, optionally with #hashtags. Use this for brief musings that are not an actionable task or reference content. Max 280 characters.',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The thought text, may include #hashtags' },
      },
      required: ['content'],
    },
  },
  {
    name: 'create_signal',
    description: 'Log a Signal — a general status update or "I just did/noticed X" activity entry. Use this as the catch-all for things that are not a task, note, thought, or meeting.',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'What happened' },
        pillar: {
          type: 'string',
          enum: ['Learning AI', 'Enterprise AI', 'AI Infrastructure'],
          description: 'Optional — which Intellina pillar this relates to',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'create_meeting',
    description: 'Log a meeting or call that happened. Use this when the user describes a meeting, especially one involving a named person.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short meeting title/topic' },
        meeting_date: { type: 'string', description: 'ISO date (YYYY-MM-DD). Defaults to today if not stated.' },
        notes: { type: 'string', description: 'Optional summary of what was discussed' },
        person_names: {
          type: 'array',
          items: { type: 'string' },
          description: 'Names of people who were in the meeting, if mentioned',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Retrieve all tasks from the Tasks app.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_notes',
    description: 'Retrieve all notes from the Notes app.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_thoughts',
    description: 'Retrieve the user\'s saved Thoughts. Use this when asked to analyze, review, summarize, or find patterns in thoughts.',
    input_schema: {
      type: 'object',
      properties: {
        hashtag: { type: 'string', description: 'Optional hashtag (without #) to filter thoughts by' },
      },
    },
  },
  {
    name: 'list_goals',
    description: 'Retrieve the measurable pillar goals, including progress and pacing status (ahead/on-pace/behind/overdue).',
    input_schema: {
      type: 'object',
      properties: {
        pillar: {
          type: 'string',
          enum: GOAL_PILLARS,
          description: 'Optional — limit to a single pillar',
        },
      },
    },
  },
]

async function logSignal(
  supabase: ReturnType<typeof getSupabase>,
  type: string,
  content: string,
  pillar: string | null,
  metadata: Record<string, unknown>,
  source: CaptureSource,
) {
  await supabase.from('mirror_signals').insert({
    type,
    category: categoryForType(type),
    content,
    pillar,
    metadata: { ...metadata, source },
  })
}

export async function executeCaptureTool(
  name: string,
  input: Record<string, unknown>,
  opts: { source: CaptureSource },
): Promise<ToolResult> {
  const supabase = getSupabase()

  if (name === 'create_task') {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: input.title as string,
        description: (input.description as string) ?? null,
        pillar: (input.pillar as string) ?? 'General',
        status: 'todo',
        source: opts.source === 'voice' ? 'voice' : 'chat',
      })
      .select()
      .single()
    if (error) return { text: `Error creating task: ${error.message}` }

    void logSignal(supabase, 'task_created', `Created task: "${data.title}"`, data.pillar ?? null, { task_id: data.id }, opts.source).catch(() => {})
    return {
      text: `Task created: "${data.title}" (id: ${data.id})`,
      created: { table: 'tasks', id: data.id, label: data.title },
    }
  }

  if (name === 'create_note') {
    const { data, error } = await supabase
      .from('notes')
      .insert({
        title: (input.title as string) ?? 'Untitled Note',
        content: (input.content as string) ?? '',
      })
      .select()
      .single()
    if (error) return { text: `Error creating note: ${error.message}` }

    void logSignal(supabase, 'note_created', `Saved note: "${data.title}"`, null, { note_id: data.id }, opts.source).catch(() => {})
    return {
      text: `Note created: "${data.title}" (id: ${data.id})`,
      created: { table: 'notes', id: data.id, label: data.title },
    }
  }

  if (name === 'create_thought') {
    const content = typeof input.content === 'string' ? input.content.trim() : ''
    if (!content) return { text: 'Error creating thought: content cannot be empty' }
    if (content.length > MAX_THOUGHT_LENGTH) {
      return { text: `Error creating thought: exceeds ${MAX_THOUGHT_LENGTH} characters` }
    }

    const { data, error } = await supabase
      .from('mirror_thoughts')
      .insert({ content, hashtags: extractHashtags(content) })
      .select()
      .single()
    if (error) return { text: `Error creating thought: ${error.message}` }

    return {
      text: `Thought saved: "${data.content}" (id: ${data.id})`,
      created: { table: 'mirror_thoughts', id: data.id, label: data.content },
    }
  }

  if (name === 'create_signal') {
    const content = typeof input.content === 'string' ? input.content.trim() : ''
    if (!content) return { text: 'Error logging signal: content cannot be empty' }

    const { data, error } = await supabase
      .from('mirror_signals')
      .insert({
        type: 'manual_checkin',
        category: categoryForType('manual_checkin'),
        content,
        pillar: (input.pillar as string) ?? null,
        metadata: { source: opts.source },
      })
      .select()
      .single()
    if (error) return { text: `Error logging signal: ${error.message}` }

    // Signals are an append-only activity log — no `created` entity, so no Undo is offered.
    return { text: `Signal logged: "${data.content}"` }
  }

  if (name === 'create_meeting') {
    const title = input.title as string
    const meeting_date = (input.meeting_date as string) || new Date().toISOString().slice(0, 10)
    const personNames = Array.isArray(input.person_names) ? (input.person_names as string[]) : []

    const { data: meeting, error } = await supabase
      .from('meetings')
      .insert({ title, meeting_date, notes: (input.notes as string) ?? null })
      .select()
      .single()
    if (error) return { text: `Error creating meeting: ${error.message}` }

    let matchedCount = 0
    if (personNames.length > 0) {
      const { data: people } = await supabase
        .from('people')
        .select('id, name')
        .or(personNames.map((n) => `name.ilike.%${n.replace(/[%_]/g, '')}%`).join(','))

      if (people && people.length > 0) {
        matchedCount = people.length
        await supabase
          .from('meeting_people')
          .insert(people.map((p: { id: string }) => ({ meeting_id: meeting.id, person_id: p.id })))
      }
    }

    void logSignal(supabase, 'meeting_added', `Logged meeting: "${meeting.title}"`, null, { meeting_id: meeting.id }, opts.source).catch(() => {})

    const unmatchedNote = personNames.length > matchedCount ? ' (some named people were not found and weren\'t linked)' : ''
    return {
      text: `Meeting created: "${meeting.title}" on ${meeting.meeting_date} (id: ${meeting.id})${unmatchedNote}`,
      created: { table: 'meetings', id: meeting.id, label: meeting.title },
    }
  }

  if (name === 'list_tasks') {
    const { data, error } = await supabase
      .from('tasks')
      .select('title, status, pillar')
      .order('created_at', { ascending: false })
    if (error) return { text: `Error fetching tasks: ${error.message}` }
    if (!data || data.length === 0) return { text: 'No tasks found.' }
    return { text: data.map((t) => `- [${t.status}] ${t.title} (${t.pillar})`).join('\n') }
  }

  if (name === 'list_notes') {
    const { data, error } = await supabase
      .from('notes')
      .select('title')
      .order('updated_at', { ascending: false })
    if (error) return { text: `Error fetching notes: ${error.message}` }
    if (!data || data.length === 0) return { text: 'No notes found.' }
    return { text: data.map((n) => `- ${n.title}`).join('\n') }
  }

  if (name === 'list_thoughts') {
    let query = supabase
      .from('mirror_thoughts')
      .select('content, hashtags, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    const hashtag = input.hashtag as string | undefined
    if (hashtag) query = query.contains('hashtags', [hashtag.toLowerCase()])

    const { data, error } = await query
    if (error) return { text: `Error fetching thoughts: ${error.message}` }
    if (!data || data.length === 0) return { text: 'No thoughts found.' }
    return {
      text: data
        .map((t) => {
          const date = new Date(t.created_at).toISOString().slice(0, 10)
          const tags = t.hashtags.length > 0 ? ` (${t.hashtags.map((h: string) => `#${h}`).join(' ')})` : ''
          return `- [${date}]${tags} ${t.content}`
        })
        .join('\n'),
    }
  }

  if (name === 'list_goals') {
    let query = supabase.from('mirror_pillar_goals').select('*').order('pillar').order('created_at')
    const pillar = input.pillar as string | undefined
    if (pillar) query = query.eq('pillar', pillar)

    const { data, error } = await query
    if (error) return { text: `Error fetching goals: ${error.message}` }
    if (!data || data.length === 0) return { text: 'No goals found.' }
    return {
      text: data
        .map((g) => {
          const pacing = computeGoalPacing(g)
          return `- [${g.pillar}] ${g.name}: ${g.current_value ?? 0}/${g.target_number ?? '?'} (target: ${g.target_date ?? 'no date set'})${PACING_LABEL[pacing.status]}`
        })
        .join('\n'),
    }
  }

  return { text: 'Unknown tool' }
}
