import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { notifyNewApplication } from '@/lib/notifications'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 10 // 10 requests per minute

// Initialize Supabase with service role key for webhook
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Helper to normalize website URL for comparison
function normalizeWebsite(url: string | null): string | null {
  if (!url) return null
  try {
    // Remove protocol and www, lowercase
    let normalized = url.toLowerCase().trim()
    normalized = normalized.replace(/^https?:\/\//, '')
    normalized = normalized.replace(/^www\./, '')
    normalized = normalized.replace(/\/$/, '') // Remove trailing slash
    return normalized
  } catch {
    return url.toLowerCase().trim()
  }
}

// Find or create a company for this application
async function findOrCreateCompany(
  companyName: string,
  website: string | null,
  description: string | null
): Promise<string> {
  const normalizedWebsite = normalizeWebsite(website)

  // First, try to find by exact name match
  const { data: existingByName } = await supabase
    .from('saif_companies')
    .select('id')
    .ilike('name', companyName)
    .limit(1)
    .single()

  if (existingByName) {
    console.log(`Found existing company by name: ${companyName} (${existingByName.id})`)
    return existingByName.id
  }

  // Try to find by website if provided - use database filter instead of fetching all
  if (normalizedWebsite) {
    // Search for websites containing the normalized domain (handles http/https and www variations)
    const { data: existingByWebsite } = await supabase
      .from('saif_companies')
      .select('id')
      .ilike('website', `%${normalizedWebsite}%`)
      .limit(1)
      .single()

    if (existingByWebsite) {
      console.log(`Found existing company by website: ${website} (${existingByWebsite.id})`)
      return existingByWebsite.id
    }
  }

  // No existing company found, create a new one as a prospect
  const { data: newCompany, error } = await supabase
    .from('saif_companies')
    .insert({
      name: companyName,
      website: website,
      short_description: description,
      stage: 'prospect',
      is_active: true,
      is_aisafety_company: false,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating company:', error)
    throw new Error(`Failed to create company: ${error.message}`)
  }

  console.log(`Created new prospect company: ${companyName} (${newCompany.id})`)
  return newCompany.id
}

// Webhook secret for authentication (X-Webhook-Secret header only)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = getClientIP(request.headers)
  const rateLimit = await checkRateLimit(`webhook:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  try {
    // Verify webhook secret if configured
    if (WEBHOOK_SECRET) {
      const providedSecret = request.headers.get('X-Webhook-Secret')

      if (providedSecret !== WEBHOOK_SECRET) {
        console.error('Webhook authentication failed')
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    console.log('Received JotForm webhook - v8 with header authentication')

    // JotForm sends data as form-encoded
    const formData = await request.formData()

    // Log all form data keys to debug
    const allKeys = Array.from(formData.keys())
    console.log('FormData keys received:', allKeys)

    // JotForm sends the actual submission data in 'rawRequest' or 'pretty' field
    const rawRequest = formData.get('rawRequest')
    const pretty = formData.get('pretty')

    console.log('rawRequest:', typeof rawRequest === 'string' ? rawRequest.substring(0, 500) : rawRequest)
    console.log('pretty:', typeof pretty === 'string' ? pretty.substring(0, 500) : pretty)

    // Parse the submission data
    let submissionData: any = {}

    if (rawRequest && typeof rawRequest === 'string') {
      try {
        submissionData = JSON.parse(rawRequest)
        console.log('Parsed rawRequest, keys:', Object.keys(submissionData))
      } catch (e) {
        console.error('Failed to parse rawRequest:', e)
      }
    }

    if (pretty && typeof pretty === 'string') {
      try {
        const prettyData = JSON.parse(pretty)
        console.log('Parsed pretty, keys:', Object.keys(prettyData))
        // pretty might have the actual answers
        if (prettyData.answers) {
          submissionData = prettyData
        }
      } catch (e) {
        console.error('Failed to parse pretty:', e)
      }
    }

    // Helper to get form field value from submission data
    const getFormField = (key: string): string | null => {
      // Check if submissionData has an 'answers' object
      if (submissionData.answers && submissionData.answers[key]) {
        const answer = submissionData.answers[key]
        // Answer might be an object with 'answer' property or just a string
        const value = typeof answer === 'object' ? answer.answer : answer
        if (!value) return null
        const trimmed = String(value).trim()
        return trimmed !== '' ? trimmed : null
      }

      // Fallback to direct property
      if (submissionData[key]) {
        const trimmed = String(submissionData[key]).trim()
        return trimmed !== '' ? trimmed : null
      }

      return null
    }

    // Extract form fields
    const companyName = getFormField('q29_companyName') || 'Unknown Company'
    const website = getFormField('q31_websiteif')
    const companyDescription = getFormField('q30_companyDescription')

    // Find or create a company for this application
    let companyId: string | null = null
    try {
      companyId = await findOrCreateCompany(companyName, website, companyDescription)
    } catch (companyError: any) {
      console.error('Failed to find/create company, proceeding without company_id:', companyError)
    }

    // Build application object using exact JotForm field IDs
    const application = {
      submission_id: submissionData.submission_id || formData.get('submissionID') || Date.now().toString(),
      submitted_at: submissionData.created_at || new Date().toISOString(),
      company_name: companyName,
      company_id: companyId,
      founder_names: getFormField('q26_typeA'),
      founder_linkedins: getFormField('q28_founderLinkedins'),
      founder_bios: getFormField('q40_founderBios'),
      primary_email: getFormField('q32_primaryEmail'),
      company_description: companyDescription,
      website: website,
      previous_funding: getFormField('q35_haveYou'),
      deck_link: getFormField('q41_linkTo'),
      stage: 'new',
      votes_revealed: false,
      all_votes_in: false,
    }

    console.log('Mapped application:', application)

    // Insert into Supabase
    const { data, error } = await supabase
      .from('saifcrm_applications')
      .insert(application)
      .select()
      .single()

    if (error) {
      console.error('Error inserting application:', error)
      return NextResponse.json(
        { error: 'Failed to save application', details: error.message },
        { status: 500 }
      )
    }

    console.log('Application created:', data.id)

    // Notify all partners about the new application
    await notifyNewApplication(data.id, application.company_name)

    return NextResponse.json({
      success: true,
      applicationId: data.id,
      message: 'Application received successfully'
    })

  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    )
  }
}

// Health check endpoint - minimal info only
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
