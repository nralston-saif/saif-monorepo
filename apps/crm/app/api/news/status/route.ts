import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get article counts for the last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: recentArticles, error } = await supabase
      .from('saifcrm_ai_news_articles')
      .select('fetch_date, title, is_ai_safety')
      .gte('fetch_date', sevenDaysAgo.toISOString().split('T')[0])
      .order('fetch_date', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group by date
    const byDate: Record<string, { count: number; hasSafety: boolean }> = {}
    for (const article of recentArticles || []) {
      const date = article.fetch_date
      if (!byDate[date]) {
        byDate[date] = { count: 0, hasSafety: false }
      }
      byDate[date].count++
      if (article.is_ai_safety) {
        byDate[date].hasSafety = true
      }
    }

    const dates = Object.keys(byDate).sort().reverse()
    const lastFetch = dates[0] || null
    const today = new Date().toISOString().split('T')[0]
    const fetchedToday = lastFetch === today

    return NextResponse.json({
      status: fetchedToday ? 'healthy' : 'stale',
      lastFetch,
      fetchedToday,
      today,
      recentDays: byDate,
      totalArticlesLast7Days: recentArticles?.length || 0,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to check status', details: String(err) },
      { status: 500 }
    )
  }
}
