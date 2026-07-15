import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'
import { buildChatSystemPrompt } from '@/lib/prompt'
import { fetchRecentTweets } from '@/lib/twitter'
import { getRelevantContext } from '@/lib/context'
import { categoryForType } from '@/lib/signals'

export const maxDuration = 300

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_task',
    description: 'Create a new task in the Tasks app. Use this when the user asks to add, save, or create tasks.',
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
    description: 'Create a new note in the Notes app. Use this when the user asks to save, add, or create notes.',
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
    description: 'Retrieve the user\'s saved Thoughts — spontaneous hashtag-tagged notes from the Strategic Mirror. Use this when the user asks to analyze, review, summarize, find patterns in, or discuss their thoughts.',
    input_schema: {
      type: 'object',
      properties: {
        hashtag: { type: 'string', description: 'Optional hashtag (without #) to filter thoughts by' },
      },
    },
  },
  {
    name: 'search_twitter',
    description: 'Search Twitter/X for live tweets on a topic. Only call this when the user explicitly asks to search Twitter, check Twitter, or look up something on Twitter/X.',
    input_schema: {
      type: 'object',
      properties: {
        queries: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of search queries to run (1–5). Be specific — e.g. "Claude 4 release", "Gemini Ultra benchmark".',
        },
      },
      required: ['queries'],
    },
  },
]

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  const supabase = getSupabase()

  if (name === 'create_task') {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: input.title as string,
        description: (input.description as string) ?? null,
        pillar: (input.pillar as string) ?? 'General',
        status: 'todo',
        source: 'report',
      })
      .select()
      .single()
    if (error) return `Error creating task: ${error.message}`
    return `Task created: "${data.title}" (id: ${data.id})`
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
    if (error) return `Error creating note: ${error.message}`
    return `Note created: "${data.title}" (id: ${data.id})`
  }

  if (name === 'list_tasks') {
    const { data, error } = await supabase
      .from('tasks')
      .select('title, status, pillar')
      .order('created_at', { ascending: false })
    if (error) return `Error fetching tasks: ${error.message}`
    if (!data || data.length === 0) return 'No tasks found.'
    return data.map((t) => `- [${t.status}] ${t.title} (${t.pillar})`).join('\n')
  }

  if (name === 'search_twitter') {
    const queries = (input.queries as string[]).slice(0, 5)
    try {
      const { text } = await fetchRecentTweets(queries)
      return text.length > 0 ? text : 'No recent tweets found for those queries.'
    } catch {
      return 'Twitter search failed — the API may be unavailable or rate-limited.'
    }
  }

  if (name === 'list_notes') {
    const { data, error } = await supabase
      .from('notes')
      .select('title')
      .order('updated_at', { ascending: false })
    if (error) return `Error fetching notes: ${error.message}`
    if (!data || data.length === 0) return 'No notes found.'
    return data.map((n) => `- ${n.title}`).join('\n')
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
    if (error) return `Error fetching thoughts: ${error.message}`
    if (!data || data.length === 0) return 'No thoughts found.'
    return data
      .map((t) => {
        const date = new Date(t.created_at).toISOString().slice(0, 10)
        const tags = t.hashtags.length > 0 ? ` (${t.hashtags.map((h: string) => `#${h}`).join(' ')})` : ''
        return `- [${date}]${tags} ${t.content}`
      })
      .join('\n')
  }

  return 'Unknown tool'
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Attachment = {
  name: string
  mediaType: string   // e.g. 'application/pdf' | 'image/png'
  data: string        // base64-encoded content
}

// Build Anthropic content blocks for the current user turn (text + attachments)
function buildUserContent(
  text: string,
  attachments: Attachment[],
): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = []

  for (const att of attachments) {
    if (att.mediaType === 'application/pdf') {
      blocks.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: att.data },
        title: att.name,
      } as Anthropic.DocumentBlockParam)
    } else if (att.mediaType.startsWith('image/')) {
      blocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: att.mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
          data: att.data,
        },
      } as Anthropic.ImageBlockParam)
    }
  }

  if (text.trim()) {
    blocks.push({ type: 'text', text })
  }

  return blocks
}

// Auto-capture substantive user messages as mirror signals so the Strategic
// Mirror Coach has visibility into what the CEO is thinking and discussing.
async function captureAsChatSignal(
  supabase: ReturnType<typeof getSupabase>,
  message: string,
  sessionId: string,
) {
  // Only log messages that are substantive reflections, not short questions
  if (message.length < 80) return
  const firstWord = message.trim().split(/\s/)[0].toLowerCase().replace(/[^a-z]/g, '')
  const questionStarters = new Set(['what', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'could', 'would', 'should', 'is', 'are', 'do', 'does', 'did'])
  if (questionStarters.has(firstWord)) return

  void supabase.from('mirror_signals').insert({
    type: 'chat_insight',
    category: categoryForType('chat_insight'),
    content: message.slice(0, 500),
    pillar: null,
    metadata: { session_id: sessionId, source: 'chat' },
  })
}

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  req: Request,
  ctx: RouteContext<'/api/chat/[id]/message'>
) {
  const supabase = getSupabase()
  const { id: sessionId } = await ctx.params
  const { message, pageContext, attachments = [] } = await req.json() as {
    message: string
    pageContext?: string
    attachments?: Attachment[]
  }

  // Persist the user message (text only — attachments are ephemeral per-turn)
  const attachmentNote = attachments.length > 0
    ? `\n\n[Attachments: ${attachments.map((a) => a.name).join(', ')}]`
    : ''
  await supabase.from('chat_messages').insert({
    session_id: sessionId,
    role: 'user',
    content: message + attachmentNote,
  })

  // Capture substantive messages as mirror signals (fire-and-forget)
  void captureAsChatSignal(supabase, message, sessionId)

  const { data: reports } = await supabase
    .from('reports')
    .select('date, content')
    .order('created_at', { ascending: false })
    .limit(3)

  // Only keep the last 20 messages to avoid unbounded context growth
  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(20)

  // Inject only headings from recent reports — not full content — to keep context lean
  const reportsContext =
    reports && reports.length > 0
      ? '\n\n### Recent Report Headlines:\n' +
        reports
          .map((r) => {
            const headings = [...r.content.matchAll(/^#{1,3} (.+)/gm)]
              .map((m) => m[1])
              .slice(0, 6)
              .join(' · ')
            return `**${r.date}:** ${headings}`
          })
          .join('\n')
      : ''

  // Retrieve only the context-document chunks relevant to this message
  const docsContext = await getRelevantContext(supabase, message)

  const systemPrompt =
    buildChatSystemPrompt() +
    '\n\nYou have access to tools to manage Tasks and Notes. Use them immediately when asked — do not describe what you are about to do, just do it.' +
    (pageContext ? `\n\n**Current page context:** The user is currently viewing the ${pageContext}` : '') +
    reportsContext +
    (docsContext ? `\n\n### Uploaded Context Documents\nThe user has uploaded the following reference documents. Treat their contents as authoritative context and answer questions about them directly.\n\n${docsContext}` : '')

  // Reverse so messages are in chronological order (we fetched newest-first for the LIMIT).
  // The history already includes the user's just-saved message (text only).
  // If there are attachments, we replace the last user message in the array with
  // a rich content-block version so Claude receives the files in this turn.
  const historyChronological = (history ?? []).reverse()
  const baseMessages: Anthropic.MessageParam[] = historyChronological.map((m, i) => {
    const isLastUserMessage =
      attachments.length > 0 &&
      i === historyChronological.length - 1 &&
      m.role === 'user'

    if (isLastUserMessage) {
      return {
        role: 'user',
        content: buildUserContent(message, attachments),
      }
    }
    return {
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }
  })

  // Guard: if history fetch returned nothing (race condition / DB latency), use the current message
  const messagesForApi: Anthropic.MessageParam[] = baseMessages.length > 0
    ? baseMessages
    : [{ role: 'user', content: buildUserContent(message, attachments) }]

  const client = new Anthropic()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let allAssistantText = ''
      let loopMessages: Anthropic.MessageParam[] = messagesForApi

      try {
        let continueLoop = true
        let iterations = 0
        const MAX_TOOL_ITERATIONS = 5

        while (continueLoop) {
          if (iterations >= MAX_TOOL_ITERATIONS) {
            controller.enqueue(encoder.encode('\n\n⚠️ Reached maximum tool call limit.'))
            break
          }
          iterations++

          const anthropicStream = client.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 8000,
            system: systemPrompt,
            messages: loopMessages,
            tools: TOOLS,
          })

          let turnText = ''

          for await (const chunk of anthropicStream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              const text = chunk.delta.text
              turnText += text
              allAssistantText += text
              controller.enqueue(encoder.encode(text))
            }
          }

          const finalMsg = await anthropicStream.finalMessage()

          if (finalMsg.stop_reason === 'tool_use') {
            const toolUseBlocks = finalMsg.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
            )

            const toolResults: Anthropic.ToolResultBlockParam[] = []

            for (const block of toolUseBlocks) {
              const result = await executeTool(
                block.name,
                block.input as Record<string, unknown>
              )
              // Truncate tool results fed back into context to avoid bloating loopMessages.
              // list_thoughts is exempt from the tight cap — its purpose is bulk analysis,
              // so truncating at 500 chars would only ever surface a handful of thoughts.
              const resultCap = block.name === 'list_thoughts' ? 6000 : 500
              const truncated = result.length > resultCap
                ? result.slice(0, resultCap) + '… [truncated for context]'
                : result
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: truncated,
              })
            }

            // Only keep the last 10 base messages + this tool exchange to cap context growth
            const cappedBase = loopMessages.slice(-10)
            loopMessages = [
              ...cappedBase,
              { role: 'assistant', content: finalMsg.content },
              { role: 'user', content: toolResults },
            ]
          } else {
            // Covers 'end_turn', 'stop_sequence', 'max_tokens' — all mean stop
            continueLoop = false
          }
        }

        if (allAssistantText) {
          await supabase.from('chat_messages').insert({
            session_id: sessionId,
            role: 'assistant',
            content: allAssistantText,
          })

          const { count } = await supabase
            .from('chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('session_id', sessionId)

          if ((count ?? 0) <= 2) {
            await supabase
              .from('chat_sessions')
              .update({ title: message.slice(0, 60) })
              .eq('id', sessionId)
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        controller.enqueue(encoder.encode(`\n\n⚠️ Error: ${msg}`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
