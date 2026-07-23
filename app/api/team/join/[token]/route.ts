import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import {
  createSessionValue,
  CREW_COOKIE,
  hashPassword,
  sessionCookieOptions,
} from "@/lib/squeegee/employee-auth"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET — invite details for prefilling the onboarding flow.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = getAdmin()
  const { data: emp } = await supabase
    .from("squeegee_employees")
    .select("id, name, phone, email, role, status, address, emergency_contact_name, emergency_contact_phone, availability, onboarded_at")
    .eq("invite_token", token)
    .single()

  if (!emp) {
    return NextResponse.json({ error: "This invite link is invalid or expired." }, { status: 404 })
  }
  if (emp.onboarded_at) {
    // Already set up — send them to log in rather than redo onboarding.
    return NextResponse.json({ alreadyOnboarded: true, name: emp.name })
  }

  return NextResponse.json({
    name: emp.name,
    phone: emp.phone,
    email: emp.email,
    role: emp.role,
    address: emp.address,
    emergency_contact_name: emp.emergency_contact_name,
    emergency_contact_phone: emp.emergency_contact_phone,
    availability: emp.availability,
  })
}

// POST — complete onboarding: confirm info, availability, sign agreement, set password.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const supabase = getAdmin()

    const { data: emp } = await supabase
      .from("squeegee_employees")
      .select("id, onboarded_at")
      .eq("invite_token", token)
      .single()

    if (!emp) {
      return NextResponse.json({ error: "This invite link is invalid or expired." }, { status: 404 })
    }
    if (emp.onboarded_at) {
      return NextResponse.json({ error: "This account is already set up. Please log in." }, { status: 409 })
    }

    const email = (body.email ?? "").trim().toLowerCase()
    const password = body.password ?? ""
    if (!email || !/.+@.+\..+/.test(email)) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 })
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }

    // Email must be unique across crew (case-insensitive), excluding self.
    const { data: clash } = await supabase
      .from("squeegee_employees")
      .select("id")
      .ilike("email", email)
      .neq("id", emp.id)
      .maybeSingle()
    if (clash) {
      return NextResponse.json({ error: "That email is already in use." }, { status: 409 })
    }

    const sig = body.signature ?? null
    const update: Record<string, unknown> = {
      email,
      password_hash: await hashPassword(password),
      legal_name: body.legal_name ? String(body.legal_name) : null,
      phone: body.phone ? String(body.phone) : null,
      address: body.address ? String(body.address) : null,
      emergency_contact_name: body.emergency_contact_name ? String(body.emergency_contact_name) : null,
      emergency_contact_phone: body.emergency_contact_phone ? String(body.emergency_contact_phone) : null,
      availability: body.availability ?? null,
      status: "active",
      onboarded_at: new Date().toISOString(),
    }
    if (sig) {
      update.agreement_signature = String(sig)
      update.agreement_signature_type = body.signature_type === "drawn" ? "drawn" : "typed"
      update.agreement_signed_at = new Date().toISOString()
    }

    const { error } = await supabase.from("squeegee_employees").update(update).eq("id", emp.id)
    if (error) {
      console.error("Crew onboarding update error:", error)
      return NextResponse.json({ error: "Could not save your setup. Please try again." }, { status: 500 })
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set(CREW_COOKIE, await createSessionValue(emp.id), sessionCookieOptions())
    return response
  } catch (err) {
    console.error("Crew onboarding error:", err)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
