import Anthropic from '@anthropic-ai/sdk'
import { TwitterApi } from 'twitter-api-v2'
import { stripLoneSurrogates } from './text'
import { PILLARS, PILLAR_META, pillarsForScope, type Pillar, type ReportScope } from './pillars'

// Always-on queries for breaking AI news — run regardless of pillar
const BREAKING_NEWS_QUERIES = [
  'new AI model release announcement',
  'AI breakthrough trending',
]

// Fallback queries per pillar, used when query generation fails.
const FALLBACK_QUERIES: Record<Pillar, string[]> = {
  'AI Education': [
    'AI literacy K-12 students',
    'AI engineering agents students learn',
    'physical AI robotics education',
    'AI hardware GPU edge devices schools',
    'AI4K12 computational thinking curriculum',
  ],
  'Education with AI': [
    'AI tutor personalized learning',
    'AI teacher assistant classroom',
    'AI school policy student privacy',
    'AI in education platform launch',
    'AI K-12 classroom pilot results',
  ],
}

function pillarDescription(pillar: Pillar): string {
  const meta = PILLAR_META[pillar]
  return `${pillar} (${meta.tagline}): ${meta.topics.map((t) => t.label).join(', ')}`
}

export async function generateSearchQueries(coveredTopics: string, scope: ReportScope = 'All'): Promise<string[]> {
  const pillars = pillarsForScope(scope)
  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `You generate Twitter/X search queries for a K-12 AI education intelligence feed.

The company (Intellina AI) builds AI Ready School. The feed has two pillars:
${pillars.map(pillarDescription).join('\n')}

Recently covered topics (avoid repeating these angles):
${coveredTopics}

Generate exactly 5 fresh, specific Twitter search queries that will surface NEW signals not covered above${pillars.length > 1 ? ', spread across both pillars' : ` for the ${scope} pillar`}.
Output only the queries, one per line, no numbering or punctuation prefix.`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const topicQueries = text
    .split('\n')
    .map((q) => q.trim())
    .filter((q) => q.length > 0)
    .slice(0, 5)

  // Always prepend breaking-news queries so trending AI stories are never missed
  const fallback = interleave(pillars.map((p) => FALLBACK_QUERIES[p])).slice(0, 5)
  return [...BREAKING_NEWS_QUERIES, ...(topicQueries.length >= 3 ? topicQueries : fallback)]
}

// [[a1,a2],[b1,b2]] -> [a1,b1,a2,b2]
function interleave<T>(lists: T[][]): T[] {
  const out: T[] = []
  const max = Math.max(...lists.map((l) => l.length))
  for (let i = 0; i < max; i++) for (const l of lists) if (i < l.length) out.push(l[i])
  return out
}

export type TwitterSource = {
  id: string
  url: string
  username: string
  text: string
  query: string
}

// Keyword gate used to check tracked-handle tweets against the two pillars —
// handles aren't scoped to a query like search results are, so an explicit
// relevance check keeps off-topic posts from a trusted account out of the report.
const RELEVANCE_KEYWORDS = [
  // AI Education: literacy, engineering, physical AI, hardware
  'ai literacy', 'ai engineering', 'physical ai', 'robot', 'humanoid', 'embodied', 'gpu', 'chip',
  'accelerator', 'on-device', 'open-weight', 'prompt engineering', 'coding assistant',
  // Education with AI / K-12 education
  'k-12', 'k12', 'school', 'student', 'teacher', 'classroom', 'edtech', 'ai tutor',
  'personalized learning', 'curriculum', 'ai literacy', 'education ai', 'assessment',
  'coppa', 'ferpa', 'computational thinking', 'certification', 'internship',
  // Breaking-news catch-all
  'ai model', 'llm', 'breakthrough', 'launches', 'release', 'open-source ai', 'foundation model',
  'ai agent', 'agentic',
]

function isRelevant(text: string): boolean {
  const lower = text.toLowerCase()
  return RELEVANCE_KEYWORDS.some((kw) => lower.includes(kw))
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
        if (!isRelevant(tweet.text)) continue
        if (seenIds.has(tweet.id)) continue

        const text = stripLoneSurrogates(tweet.text)
        const username = response.includes.author(tweet)?.username ?? cleanHandle
        const url = `https://x.com/${username}/status/${tweet.id}`
        const label = `tracked:${cleanHandle}`
        results.push(`[${label}] (${url}) ${text}`)

        seenIds.add(tweet.id)
        sources.push({ id: tweet.id, url, username, text, query: label })
      }
    } catch {
      // Skip handles that fail (suspended, renamed, rate-limited) without breaking the whole fetch
      continue
    }
  }

  return { results, sources, seenIds }
}

export async function fetchRecentTweets(
  queries: string[] = [...BREAKING_NEWS_QUERIES, ...interleave(PILLARS.map((p) => FALLBACK_QUERIES[p])).slice(0, 5)],
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

        const text = stripLoneSurrogates(tweet.text)
        const username = response.includes.author(tweet)?.username ?? 'i'
        const url = `https://x.com/${username}/status/${tweet.id}`
        results.push(`[${query}] (${url}) ${text}`)

        seenIds.add(tweet.id)
        sources.push({ id: tweet.id, url, username, text, query })
      }
    }
  }

  return { text: results.join('\n\n'), sources }
}
