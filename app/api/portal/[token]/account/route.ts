import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  createSessionValue,
  generateMemberSlug,
  hashPassword,
  MEMBER_COOKIE,
  sessionCookieOptions,
} from '@/lib/squeegee/member-auth'
import { sendAccountEmail } from '@/lib/squeegee/email'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface RouteParams {
  params: Promise<{ token: string }>
}

interface AccountBody {
  email: string
  password: string
  confirm: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Public endpoint — customer creates their Care Club login from onboarding
// (or the portal banner). Authorized by knowing the unguessable portal token.
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const body = (await request.json()) as AccountBody
    const email = (body.email ?? '').trim().toLowerCase()
    const { password, confirm } = body

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }
    if (password !== confirm) {
      return NextResponse.json({ error: "Passwords don't match." }, { status: 400 })
    }

    const supabase = getAdmin()
    const { data: plan, error } = await supabase
      .from('squeegee_plans')
      .select('id, client_name, signed_at, status')
      .eq('portal_token', token)
      .single()

    if (error || !plan) {
      return NextResponse.json({ error: 'Portal link not found.' }, { status: 404 })
    }
    if (!plan.signed_at) {
      return NextResponse.json({ error: 'Please sign your agreement first.' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('squeegee_members')
      .select('id')
      .eq('plan_id', plan.id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: 'This plan already has a login. Use the sign-in page — or the "forgot password" link.' },
        { status: 409 }
      )
    }

    const password_hash = await hashPassword(password)
    const slug = await generateMemberSlug(plan.client_name)

    const { data: member, error: insertErr } = await supabase
      .from('squeegee_members')
      .insert({ plan_id: plan.id, email, password_hash, slug })
      .select('id, member_number, slug')
      .single()

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json(
          { error: 'That email already has an account. Try signing in instead.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: 'Could not create your account. Please try again.' }, { status: 500 })
    }

    // Keep the plan's email in sync for future reminders
    await supabase.from('squeegee_plans').update({ client_email: email }).eq('id', plan.id)

    // Await — on serverless, un-awaited sends can be frozen mid-flight
    await sendAccountEmail(email, plan.client_name, member.member_number, member.slug)

    const response = NextResponse.json({
      ok: true,
      member_number: member.member_number,
      slug: member.slug,
    })
    response.cookies.set(MEMBER_COOKIE, await createSessionValue(member.id), sessionCookieOptions())
    return response
  } catch (err) {
    console.error('Create account error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
