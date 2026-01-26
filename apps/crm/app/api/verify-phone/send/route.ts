import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import twilio from 'twilio'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 5 // 5 requests per minute (SMS costs money)

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = getClientIP(request.headers)
  const rateLimit = await checkRateLimit(`verify-phone:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many verification requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Remaining': '0',
        }
      }
    )
  }

  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { phoneNumber } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    // Clean and format phone number
    const cleanPhone = phoneNumber.replace(/\D/g, '')
    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    let formattedPhone: string
    if (phoneNumber.startsWith('+')) {
      // Already has + prefix, use as-is
      formattedPhone = phoneNumber
    } else if (cleanPhone.startsWith('1') && cleanPhone.length === 11) {
      // Has country code 1 but missing +, just add +
      formattedPhone = `+${cleanPhone}`
    } else {
      // No country code, add +1
      formattedPhone = `+1${cleanPhone}`
    }

    // Check Twilio config
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_VERIFY_SERVICE_SID) {
      return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })
    }

    // Send verification code via Twilio Verify
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({
        to: formattedPhone,
        channel: 'sms'
      })

    return NextResponse.json({
      success: true,
      status: verification.status,
      message: 'Verification code sent'
    })
  } catch (error) {
    console.error('Error sending verification:', error)
    const message = error instanceof Error ? error.message : 'Failed to send verification'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
