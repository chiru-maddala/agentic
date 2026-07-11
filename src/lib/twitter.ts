import Anthropic from '@anthropic-ai/sdk'
import { TwitterApi } from 'twitter-api-v2'

// Always-on queries for breaking AI news — run regardless of pillar focus
const BREAKING_NEWS_QUERIES = [
  'new AI model release announcement',
  'AI breakthrough trending',
]

const FALLBACK_QUERIES = [
  ...BREAKING_NEWS_QUERIES,
  'AI education K-12',
  'agentic AI enterprise',
  'AI infrastructure GPU compute',
  'LLM new model release',
  'AI orchestration multi-agent',
  'Databricks AI',
  'edge AI inference',
]

export async function generateSearchQueries(coveredTopics: string): Promise<string[]> {
  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `You generate Twitter/X search queries for an AI company intelligence feed.

The company (Intellina AI) focuses on three pillars:
- Learning AI: K-12 AI tools, higher education AI, professional AI courses, knowledge graphs
- Enterprise AI: agentic orchestration, multi-agent systems, Databricks, no-code AI platforms
- AI Infrastructure: GPU/compute, edge AI, space computing, inference optimization

Recently covered topics (avoid repeating these angles):
${coveredTopics}

Generate exactly 5 fresh, specific Twitter search queries scoped to the three pillars above that will surface NEW signals not covered above.
Output only the queries, one per line, no numbering or punctuation prefix.`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const pillarQueries = text
    .split('\n')
    .map((q) => q.trim())
    .filter((q) => q.length > 0)
    .slice(0, 5)

  // Always prepend breaking-news queries so trending AI stories are never missed
  const queries = [...BREAKING_NEWS_QUERIES, ...(pillarQueries.length >= 3 ? pillarQueries : FALLBACK_QUERIES.slice(2))]
  return queries
}

export type TwitterSource = {
  id: string
  url: string
  username: string
  text: string
  query: string
}

// Keyword gate used to check tracked-handle tweets against the three pillars —
// handles aren't scoped to a query like search results are, so an explicit
// relevance check keeps off-topic posts from a trusted account out of the report.
const PILLAR_KEYWORDS = [
  // Learning AI
  'k-12', 'k12', 'higher education', 'edtech', 'ai tutor', 'personalized learning',
  'knowledge graph', 'curriculum', 'student ai', 'ai literacy', 'education ai',
  // Enterprise AI
  'agentic', 'orchestration', 'multi-agent', 'multiagent', 'no-code ai', 'low-code ai',
  'databricks', 'guardrails', 'rag', 'ai agent', 'enterprise ai', 'agent framework',
  // AI Infrastructure
  'gpu', 'compute', 'edge ai', 'inference', 'space computing', 'data center', 'datacenter',
  'chip', 'nvidia', 'tpu', 'cooling',
  // Breaking-news catch-all
  'ai model', 'llm', 'breakthrough', 'launches', 'release', 'open-source ai', 'foundation model',
]

function isRelevantToPillars(text: string): boolean {
  const lower = text.toLowerCase()
  return PILLAR_KEYWORDS.some((kw) => lower.includes(kw))
}

async function fetchTrackedHandleTweets(
  client: TwitterApi,
  handles: string[]
): Promise<{ results: string[]; sources: TwitterSource[]; seenIds: Set<string> }> {
  const results: string[] = []
  const sources: TwitterSource[] = []
  const seenIds = new Set<string>()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  for (const handle of handles) {
    const cleanHandle = handle.replace(/^@/, '')
    try {
      const response = await client.v2.search(
        `from:${cleanHandle} -is:retweet`,
        {
          max_results: 10,
          start_time: since,
          'tweet.fields': ['created_at', 'author_id', 'text'],
          expansions: ['author_id'],
          'user.fields': ['username'],
        }
      )
      if (!response.data?.data) continue

      for (const tweet of response.data.data) {
        if (!isRelevantToPillars(tweet.text)) continue
        if (seenIds.has(tweet.id)) continue

        const username = response.includes.author(tweet)?.username ?? cleanHandle
        const url = `https://x.com/${username}/status/${tweet.id}`
        const label = `tracked:${cleanHandle}`
        results.push(`[${label}] (${url}) ${tweet.text}`)

        seenIds.add(tweet.id)
        sources.push({ id: tweet.id, url, username, text: tweet.text, query: label })
      }
    } catch {
      // Skip handles that fail (suspended, renamed, rate-limited) without breaking the whole fetch
      continue
    }
  }

  return { results, sources, seenIds }
}

export async function fetchRecentTweets(
  queries: string[] = FALLBACK_QUERIES,
  trackedHandles: string[] = []
): Promise<{ text: string; sources: TwitterSource[] }> {
  const client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN!)

  // Check known, curated handles first — their tweets are higher-signal than a blind keyword search.
  const handleFetch = trackedHandles.length > 0
    ? await fetchTrackedHandleTweets(client, trackedHandles)
    : { results: [], sources: [], seenIds: new Set<string>() }

  const results = [...handleFetch.results]
  const sources = [...handleFetch.sources]
  const seenIds = handleFetch.seenIds

  // Fill in the rest from the broader keyword search, skipping anything already pulled from a tracked handle.
  for (const query of queries) {
    const response = await client.v2.search(
      `${query} -is:retweet lang:en`,
      {
        max_results: 10,
        'tweet.fields': ['created_at', 'author_id', 'text'],
        expansions: ['author_id'],
        'user.fields': ['username'],
      }
    )
    if (response.data?.data) {
      for (const tweet of response.data.data) {
        if (seenIds.has(tweet.id)) continue

        const username = response.includes.author(tweet)?.username ?? 'i'
        const url = `https://x.com/${username}/status/${tweet.id}`
        results.push(`[${query}] (${url}) ${tweet.text}`)

        seenIds.add(tweet.id)
        sources.push({ id: tweet.id, url, username, text: tweet.text, query })
      }
    }
  }

  return { text: results.join('\n\n'), sources }
}
