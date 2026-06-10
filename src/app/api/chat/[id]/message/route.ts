import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase'
import { buildSystemPrompt } from '@/lib/prompt'
import { fetchRecentTweets } from '@/lib/twitter'

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
      const tweets = await fetchRecentTweets(queries)
      return tweets.length > 0 ? tweets : 'No recent tweets found for those queries.'
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

  return 'Unknown tool'
}

export async function POST(
  req: Request,
  ctx: RouteContext<'/api/chat/[id]/message'>
) {
  const supabase = getSupabase()
  const { id: sessionId } = await ctx.params
  const { message } = await req.json()

  await supabase.from('chat_messages').insert({
    session_id: sessionId,
    role: 'user',
    content: message,
  })

  const { data: reports } = await supabase
    .from('reports')
    .select('date, content')
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  const reportsContext =
    reports && reports.length > 0
      ? '\n\n### Recent Intelligence Reports:\n' +
        reports.map((r) => `**Report ${r.date}:**\n${r.content}`).join('\n\n---\n\n')
      : ''

  const systemPrompt =
    buildSystemPrompt() +
    '\n\nYou are now acting as an interactive assistant. Answer questions, provide analysis, and help with strategy based on the intelligence reports and your knowledge.' +
    '\n\nYou have access to tools to manage Tasks and Notes. When the user asks you to add, save, or create tasks or notes — use the appropriate tool. After using tools, summarize what you did.' +
    reportsContext

  const baseMessages: Anthropic.MessageParam[] = (history ?? []).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const client = new Anthropic()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let allAssistantText = ''
      let loopMessages: Anthropic.MessageParam[] = baseMessages

      try {
        let continueLoop = true

        while (continueLoop) {
          const anthropicStream = client.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 4000,
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
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: result,
              })
            }

            loopMessages = [
              ...loopMessages,
              { role: 'assistant', content: finalMsg.content },
              { role: 'user', content: toolResults },
            ]
          } else {
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
