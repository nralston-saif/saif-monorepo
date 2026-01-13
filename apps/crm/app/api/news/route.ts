import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query params
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '5', 10)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)
    const topic = url.searchParams.get('topic')

    // Build query
    let query = supabase
      .from('saifcrm_ai_news_articles')
      .select('*', { count: 'exact' })
      .order('fetch_date', { ascending: false })
      .order('published_at', { ascending: false })

    // Apply topic filter if provided
    if (topic && topic !== 'all') {
      query = query.eq('topic', topic)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: articles, error, count } = await query

    if (error) {
      console.error('Error fetching news articles:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      articles: articles || [],
      total: count || 0,
      hasMore: count ? offset + limit < count : false,
    })

  } catch (error: unknown) {
    console.error('News fetch error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch news articles', details: message },
      { status: 500 }
    )
  }
}
