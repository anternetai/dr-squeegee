import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  createSessionValue,
  MEMBER_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from '@/lib/squeegee/member-auth'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const FAIL = { error: 'Email or password is incorrect.' }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = (body.email ?? '').trim().toLowerCase()
    const password = body.password ?? ''

    // Small fixed delay keeps brute-forcing unattractive without infra
    await new Promise((r) => setTimeout(r, 350))

    if (!email || !password) {
      return NextResponse.json(FAIL, { status: 401 })
    }

    const supabase = getAdmin()
    const { data: member } = await supabase
      .from('squeegee_members')
      .select('id, password_hash')
      .eq('email', email)
      .single()

    if (!member || !(await verifyPassword(password, member.password_hash))) {
      return NextResponse.json(FAIL, { status: 401 })
    }

    await supabase
      .from('squeegee_members')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', member.id)

    const response = NextResponse.json({ ok: true })
    response.cookies.set(MEMBER_COOKIE, await createSessionValue(member.id), sessionCookieOptions())
    return response
  } catch (err) {
    console.error('Member login error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
