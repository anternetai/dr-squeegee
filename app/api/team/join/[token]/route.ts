import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import {
  createSessionValue,
  CREW_COOKIE,
  hashPin,
  isValidPin,
  phoneKey,
  sessionCookieOptions,
} from "@/lib/squeegee/employee-auth"
import { joinMode } from "@/lib/squeegee/employees"

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
    .select("id, name, phone, email, role, status, address, emergency_contact_name, emergency_contact_phone, availability, onboarded_at, pin_hash")
    .eq("invite_token", token)
    .single()

  if (!emp) {
    return NextResponse.json({ error: "This invite link is invalid or expired." }, { status: 404 })
  }
  const mode = joinMode(emp)
  if (mode === "done") {
    // Already set up — send them to log in rather than redo onboarding.
    return NextResponse.json({ alreadyOnboarded: true, name: emp.name })
  }
  if (mode === "set_pin") {
    // Set up, no PIN: the link only collects a PIN. Nothing else is prefilled
    // because nothing else is asked.
    return NextResponse.json({ setPin: true, name: emp.name })
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
      .select("id, onboarded_at, pin_hash")
      .eq("invite_token", token)
      .single()

    if (!emp) {
      return NextResponse.json({ error: "This invite link is invalid or expired." }, { status: 404 })
    }
    const mode = joinMode(emp)
    if (mode === "done") {
      return NextResponse.json({ error: "This account is already set up. Please log in." }, { status: 409 })
    }

    const pin = String(body.pin ?? "")

    if (mode === "set_pin") {
      // PIN only. The rest of the row — legal name, agreement, availability —
      // was captured when they onboarded and is not up for rewrite from a
      // link; the body is ignored beyond the PIN so a crafted request can't
      // use a PIN-reset link to edit the employee record.
      if (!isValidPin(pin)) {
        return NextResponse.json({ error: "Your PIN must be 4 digits." }, { status: 400 })
      }
      const { error } = await supabase
        .from("squeegee_employees")
        .update({ pin_hash: await hashPin(pin), pin_attempts: 0, pin_locked_until: null })
        .eq("id", emp.id)
        .is("pin_hash", null) // two taps on Save can't race past the first
      if (error) {
        console.error("Crew set-PIN update error:", error)
        return NextResponse.json({ error: "Could not save your PIN. Please try again." }, { status: 500 })
      }
      const response = NextResponse.json({ ok: true })
      response.cookies.set(CREW_COOKIE, await createSessionValue(emp.id), sessionCookieOptions())
      return response
    }

    // Phone + PIN is how the crew logs in, so the phone is the identifier and
    // both are required. Email is optional — plenty of crew don't check one.
    const phone = phoneKey(body.phone)
    if (!phone) {
      return NextResponse.json({ error: "A valid mobile number is required." }, { status: 400 })
    }
    if (!isValidPin(pin)) {
      return NextResponse.json({ error: "Your PIN must be 4 digits." }, { status: 400 })
    }

    const email = (body.email ?? "").trim().toLowerCase()
    if (email && !/.+@.+\..+/.test(email)) {
      return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 })
    }

    // The phone is the login key, so it has to be unique across the crew.
    const { data: others } = await supabase
      .from("squeegee_employees")
      .select("id, phone")
      .neq("id", emp.id)
      .not("phone", "is", null)
      .limit(200)
    if ((others ?? []).some((o) => phoneKey(o.phone as string) === phone)) {
      return NextResponse.json(
        { error: "That number is already set up. Try logging in." },
        { status: 409 }
      )
    }

    if (email) {
      const { data: clash } = await supabase
        .from("squeegee_employees")
        .select("id")
        .ilike("email", email)
        .neq("id", emp.id)
        .maybeSingle()
      if (clash) {
        return NextResponse.json({ error: "That email is already in use." }, { status: 409 })
      }
    }

    const sig = body.signature ?? null
    const update: Record<string, unknown> = {
      email: email || null,
      pin_hash: await hashPin(pin),
      pin_attempts: 0,
      pin_locked_until: null,
      legal_name: body.legal_name ? String(body.legal_name) : null,
      phone,
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
