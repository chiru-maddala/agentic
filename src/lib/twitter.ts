import { TwitterApi } from 'twitter-api-v2'

const SEARCH_QUERIES = [
  'AI education K-12',
  'agentic AI enterprise',
  'AI infrastructure GPU compute',
  'LLM new model release',
  'AI orchestration multi-agent',
  'Databricks AI',
  'edge AI inference',
]

export async function fetchRecentTweets(): Promise<string> {
  const client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN!)
  const results: string[] = []

  for (const query of SEARCH_QUERIES) {
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
