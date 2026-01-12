import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import twilio from 'twilio'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { phoneNumber, code } = await request.json()

    if (!phoneNumber || !code) {
      return NextResponse.json({ error: 'Phone number and code are required' }, { status: 400 })
    }

    // Clean and format phone number
    const cleanPhone = phoneNumber.replace(/\D/g, '')
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

    // Verify the code via Twilio Verify
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

    const verificationCheck = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to: formattedPhone,
        code: code
      })

    if (verificationCheck.status === 'approved') {
      // Get the user's person record
      const { data: person } = await supabase
        .from('saif_people')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (person) {
        // Update the person's phone as verified and save the number
        await supabase
          .from('saif_people')
          .update({
            mobile_phone: formattedPhone,
            phone_verified: true
          })
          .eq('id', person.id)
      }

      return NextResponse.json({
        success: true,
        verified: true,
        message: 'Phone number verified successfully'
      })
    } else {
      return NextResponse.json({
        success: false,
        verified: false,
        message: 'Invalid verification code'
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Error checking verification:', error)
    const message = error instanceof Error ? error.message : 'Failed to verify code'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
