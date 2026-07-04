import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendMagicLinkEmail } from '@/lib/squeegee/email'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Always returns 200 — never reveals whether an email has an account.
// If it does, we email their unguessable magic portal link.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = (body.email ?? '').trim().toLowerCase()
    const ok = NextResponse.json({
      ok: true,
      message: "If that email has a Care Club account, we've sent a sign-in link.",
    })
    if (!email) return ok

    const supabase = getAdmin()
    const { data: member } = await supabase
      .from('squeegee_members')
      .select('plan_id')
      .eq('email', email)
      .single()

    if (member) {
      const { data: plan } = await supabase
        .from('squeegee_plans')
        .select('client_name, portal_token')
        .eq('id', member.plan_id)
        .single()
      if (plan) {
        // Await — on serverless, un-awaited sends can be frozen mid-flight
        await sendMagicLinkEmail(email, plan.client_name, plan.portal_token)
      }
    }
    return ok
  } catch (err) {
    console.error('Forgot password error:', err)
    return NextResponse.json({ ok: true })
  }
}
