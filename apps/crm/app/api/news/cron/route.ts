import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Force dynamic to prevent caching - required for Vercel cron jobs
export const dynamic = 'force-dynamic'

// Initialize Supabase with service role key (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const NEWSAPI_BASE_URL = 'https://newsapi.org/v2/everything'

// Quality tech news sources
const QUALITY_DOMAINS = [
  'techcrunch.com',
  'wired.com',
  'arstechnica.com',
  'theverge.com',
  'technologyreview.com',
  'reuters.com',
  'bloomberg.com',
  'nytimes.com',
  'wsj.com',
  'ft.com',
  'bbc.com',
  'theguardian.com',
  'axios.com',
  'venturebeat.com',
  'zdnet.com',
].join(',')

type AITopic = 'llm' | 'robotics' | 'regulation' | 'business' | 'research' | 'healthcare' | 'ai_safety' | 'general'

interface NewsAPIArticle {
  title: string
  description: string | null
  url: string
  source: { id: string | null; name: string }
  author: string | null
  urlToImage: string | null
  publishedAt: string
}

interface RankedArticle extends NewsAPIArticle {
  topic: AITopic
  is_ai_safety: boolean
  importance_score: number
}

const RANKING_PROMPT = `You are an AI news curator for a venture capital firm focused on AI safety investments.
Analyze these articles and select the 5 most important/interesting ones for partners to read.

Prioritize articles about:
- Major AI breakthroughs or product launches (new models, capabilities)
- AI safety, alignment, governance, or regulation news
- Significant funding rounds or acquisitions in AI
- Important research papers or findings
- AI policy decisions by governments or major companies
- Controversies or debates in the AI field

Avoid:
- Generic "AI will change everything" opinion pieces
- Minor product updates or features
- Listicles or how-to guides
- Clickbait or sensational headlines
- Duplicate stories (pick the best source)

For each article, provide:
- topic: one of [llm, robotics, regulation, business, research, healthcare, ai_safety, general]
- is_ai_safety: true if specifically about AI safety/alignment/ethics/governance
- importance_score: 1-10 (10 = must read, 1 = skip)

Articles:
{articles}

Respond with JSON array of the TOP 5 articles only (highest importance), sorted by importance_score descending:
[
  {
    "index": <original index>,
    "topic": "<category>",
    "is_ai_safety": <true|false>,
    "importance_score": <1-10>,
    "reason": "<brief reason for selection>"
  }
]`

// Verify authorization for cron jobs - only accepts Authorization: Bearer ${CRON_SECRET}
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET) {
    console.error('CRON_SECRET not configured')
    return false
  }
  return authHeader === `Bearer ${process.env.CRON_SECRET}`
}

async function fetchNewsAPIArticles(): Promise<NewsAPIArticle[]> {
  // Look back 2 days to get more articles to choose from
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
  const fromDate = twoDaysAgo.toISOString().split('T')[0]

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const toDate = yesterday.toISOString().split('T')[0]

  // Better search query focused on significant AI news
  const params = new URLSearchParams({
    q: '(ChatGPT OR GPT-4 OR GPT-5 OR Claude OR Gemini OR "OpenAI" OR "Anthropic" OR "AI safety" OR "artificial intelligence" OR "large language model" OR "AI regulation") AND (launch OR announce OR release OR funding OR billion OR research OR policy OR government)',
    from: fromDate,
    to: toDate,
    language: 'en',
    sortBy: 'popularity',
    pageSize: '30',
    domains: QUALITY_DOMAINS,
  })

  const response = await fetch(`${NEWSAPI_BASE_URL}?${params}`, {
    headers: {
      'X-Api-Key': process.env.NEWSAPI_KEY!,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`NewsAPI error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  return data.articles || []
}

async function rankAndSelectArticles(articles: NewsAPIArticle[]): Promise<RankedArticle[]> {
  // Format articles for Claude
  const articleSummaries = articles.map((a, i) =>
    `[${i}] "${a.title}" - ${a.source.name}\n   ${a.description || 'No description'}`
  ).join('\n\n')

  const prompt = RANKING_PROMPT.replace('{articles}', articleSummaries)

  const message = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const textContent = message.content.find(c => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  // Parse JSON response
  let jsonStr = textContent.text
  const jsonMatch = jsonStr.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    jsonStr = jsonMatch[0]
  }

  const rankings = JSON.parse(jsonStr) as Array<{
    index: number
    topic: AITopic
    is_ai_safety: boolean
    importance_score: number
    reason: string
  }>

  // Map rankings back to articles
  const rankedArticles: RankedArticle[] = rankings
    .filter(r => r.index >= 0 && r.index < articles.length)
    .map(r => ({
      ...articles[r.index],
      topic: r.topic,
      is_ai_safety: r.is_ai_safety,
      importance_score: r.importance_score,
    }))

  return rankedArticles
}

async function ensureAISafetyArticle(articles: RankedArticle[]): Promise<RankedArticle[]> {
  const hasSafetyArticle = articles.some(a => a.is_ai_safety)

  if (hasSafetyArticle) {
    return articles
  }

  // Fetch specifically for AI safety news
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const params = new URLSearchParams({
    q: '"AI safety" OR "AI alignment" OR "AI governance" OR "AI regulation" OR "responsible AI"',
    from: sevenDaysAgo.toISOString().split('T')[0],
    language: 'en',
    sortBy: 'popularity',
    pageSize: '5',
    domains: QUALITY_DOMAINS,
  })

  const response = await fetch(`${NEWSAPI_BASE_URL}?${params}`, {
    headers: { 'X-Api-Key': process.env.NEWSAPI_KEY! },
  })

  if (response.ok) {
    const data = await response.json()
    const safetyArticles = data.articles || []

    if (safetyArticles.length > 0) {
      const safetyArticle: RankedArticle = {
        ...safetyArticles[0],
        topic: 'ai_safety',
        is_ai_safety: true,
        importance_score: 8,
      }
      // Replace lowest scored article with safety article
      return [...articles.slice(0, 4), safetyArticle]
    }
  }

  return articles
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if we already fetched today
    const today = new Date().toISOString().split('T')[0]
    const { data: existingArticles } = await supabase
      .from('saifcrm_ai_news_articles')
      .select('id')
      .eq('fetch_date', today)
      .limit(1)

    if (existingArticles && existingArticles.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Articles already fetched for today',
        skipped: true,
      })
    }

    // Fetch articles from NewsAPI (quality sources only)
    const articles = await fetchNewsAPIArticles()

    if (articles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No articles returned from NewsAPI',
      })
    }

    // Have Claude rank and select the best 5 articles
    let rankedArticles = await rankAndSelectArticles(articles)

    if (rankedArticles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Failed to rank articles',
      })
    }

    // Ensure at least 1 AI safety article
    rankedArticles = await ensureAISafetyArticle(rankedArticles)

    // Store articles in database
    const articlesToInsert = rankedArticles.map(article => ({
      title: article.title,
      description: article.description,
      url: article.url,
      source_name: article.source?.name,
      source_id: article.source?.id,
      author: article.author,
      image_url: article.urlToImage,
      published_at: article.publishedAt,
      topic: article.topic,
      is_ai_safety: article.is_ai_safety,
      classification_confidence: article.importance_score / 10,
      fetch_date: today,
    }))

    const { error: insertError } = await supabase
      .from('saifcrm_ai_news_articles')
      .upsert(articlesToInsert, {
        onConflict: 'url',
        ignoreDuplicates: true,
      })

    if (insertError) {
      console.error('Error inserting articles:', insertError)
      return NextResponse.json({
        success: false,
        error: insertError.message,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      articlesStored: rankedArticles.length,
      hasSafetyArticle: rankedArticles.some(a => a.is_ai_safety),
      articles: rankedArticles.map(a => ({
        title: a.title,
        source: a.source.name,
        topic: a.topic,
        is_ai_safety: a.is_ai_safety,
        importance: a.importance_score,
      })),
    })

  } catch (error) {
    console.error('News cron job error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch and store news articles' },
      { status: 500 }
    )
  }
}

// GET: Manual trigger for testing (requires service role key)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Create a mock request with the cron secret
  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
  })

  return POST(mockRequest)
}
