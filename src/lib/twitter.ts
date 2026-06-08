import Anthropic from '@anthropic-ai/sdk'
import { TwitterApi } from 'twitter-api-v2'

const FALLBACK_QUERIES = [
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

Generate exactly 7 fresh, specific Twitter search queries that will surface NEW signals not covered above.
Output only the queries, one per line, no numbering or punctuation prefix.`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const queries = text
    .split('\n')
    .map((q) => q.trim())
    .filter((q) => q.length > 0)
    .slice(0, 7)

  return queries.length >= 3 ? queries : FALLBACK_QUERIES
}

export async function fetchRecentTweets(queries: string[] = FALLBACK_QUERIES): Promise<string> {
  const client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN!)
  const results: string[] = []

  for (const query of queries) {
    const response = await client.v2.search(
      `${query} -is:retweet lang:en`,
      {
        max_results: 10,
        'tweet.fields': ['created_at', 'author_id', 'text'],
      }
    )
    if (response.data?.data) {
      for (const tweet of response.data.data) {
        results.push(`[${query}] ${tweet.text}`)
      }
    }
  }

  return results.join('\n\n')
}
