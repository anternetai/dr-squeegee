import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/squeegee/email'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface RouteParams {
  params: Promise<{ token: string }>
}

interface SignBody {
  signed_name: string
  signature_type: 'drawn' | 'typed'
  signature_data: string
}

// Public endpoint — customer signs the agreement from /a/[token].
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const body = (await request.json()) as SignBody
    const { signed_name, signature_type, signature_data } = body

    if (!signed_name?.trim() || signed_name.length > 120) {
      return NextResponse.json({ error: 'Please enter your full name.' }, { status: 400 })
    }
    if (signature_type === 'drawn') {
      if (!signature_data?.startsWith('data:image/png;base64,') || signature_data.length > 500_000) {
        return NextResponse.json({ error: 'Invalid signature image.' }, { status: 400 })
      }
    } else if (signature_type === 'typed') {
      if (!signature_data?.trim() || signature_data.length > 120) {
        return NextResponse.json({ error: 'Please type your signature.' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'Invalid signature type.' }, { status: 400 })
    }

    const supabase = getAdmin()
    const { data: plan, error } = await supabase
      .from('squeegee_plans')
      .select('*')
      .eq('token', token)
      .single()

    if (error || !plan) {
      return NextResponse.json({ error: 'Agreement not found.' }, { status: 404 })
    }
    if (plan.signed_at) {
      return NextResponse.json({ error: 'This agreement is already signed.' }, { status: 409 })
    }
    if (plan.status === 'cancelled') {
      return NextResponse.json({ error: 'This agreement is no longer active.' }, { status: 410 })
    }

    const signedIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null

    const { error: updateErr } = await supabase
      .from('squeegee_plans')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signed_name: signed_name.trim(),
        signature_type,
        signature_data,
        signed_ip: signedIp,
      })
      .eq('id', plan.id)
      .is('signed_at', null)

    if (updateErr) {
      return NextResponse.json({ error: 'Could not save signature. Please try again.' }, { status: 500 })
    }

    // Term starts the day they sign. The visit schedule itself is built in the
    // member portal's onboarding, where the customer picks their months.
    if (!plan.term_start) {
      await supabase
        .from('squeegee_plans')
        .update({ term_start: new Date().toISOString().slice(0, 10) })
        .eq('id', plan.id)
    }

    if (plan.client_email) {
      sendWelcomeEmail({
        client_name: plan.client_name,
        client_email: plan.client_email,
        address: plan.address,
        total_price: plan.total_price,
        annual_value: plan.annual_value,
        billing: plan.billing,
        portal_token: plan.portal_token,
        services: plan.services ?? [],
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, portal_token: plan.portal_token })
  } catch (err) {
    console.error('Sign plan error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
