import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import {
  createSessionValue,
  CREW_COOKIE,
  isLockedOut,
  isValidPin,
  lockoutUntil,
  MAX_PIN_ATTEMPTS,
  phoneKey,
  sessionCookieOptions,
  verifyPassword,
  verifyPin,
} from "@/lib/squeegee/employee-auth"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// One message for every failure mode. "No such phone" and "wrong PIN" must be
// indistinguishable or the endpoint becomes a roster of who works here.
const FAIL = { error: "That phone number and PIN don't match." }
const LOCKED = {
  error: "Too many tries. Wait a few minutes and try again, or text Anthony.",
}

// A 4-digit PIN is 10,000 combinations, so the lockout is the security. Keep the
// response time flat too — a fast "no" on an unknown phone would leak the roster
// just as effectively as a different error string.
const FIXED_DELAY_MS = 350

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  async function settle<T>(res: T): Promise<T> {
    const elapsed = Date.now() - startedAt
    if (elapsed < FIXED_DELAY_MS) {
      await new Promise((r) => setTimeout(r, FIXED_DELAY_MS - elapsed))
    }
    return res
  }

  try {
    const body = await request.json().catch(() => ({}))
    const supabase = getAdmin()

    // Legacy email + password. Kept working while the crew migrates to PINs;
    // delete this branch once everyone has one.
    if (body.password) {
      const email = String(body.email ?? "").trim().toLowerCase()
      if (!email) return settle(NextResponse.json(FAIL, { status: 401 }))

      const { data: employee } = await supabase
        .from("squeegee_employees")
        .select("id, password_hash, status")
        .ilike("email", email)
        .single()

      if (
        !employee ||
        !employee.password_hash ||
        employee.status === "inactive" ||
        !(await verifyPassword(String(body.password), employee.password_hash))
      ) {
        return settle(NextResponse.json(FAIL, { status: 401 }))
      }
      return settle(await succeed(supabase, employee.id))
    }

    // Phone + PIN.
    const phone = phoneKey(body.phone)
    const pin = String(body.pin ?? "")
    if (!phone || !isValidPin(pin)) {
      return settle(NextResponse.json(FAIL, { status: 401 }))
    }

    // Phones are stored unformatted, but tolerate rows that aren't.
    const { data: candidates } = await supabase
      .from("squeegee_employees")
      .select("id, name, phone, pin_hash, status, pin_attempts, pin_locked_until")
      .not("phone", "is", null)
      .limit(200)

    const employee = (candidates ?? []).find((e) => phoneKey(e.phone as string) === phone)

    if (!employee || !employee.pin_hash || employee.status === "inactive") {
      return settle(NextResponse.json(FAIL, { status: 401 }))
    }

    if (isLockedOut(employee.pin_locked_until as string | null)) {
      return settle(NextResponse.json(LOCKED, { status: 429 }))
    }

    if (!(await verifyPin(pin, employee.pin_hash as string))) {
      const attempts = (employee.pin_attempts as number) + 1
      const patch: Record<string, unknown> = { pin_attempts: attempts }
      if (attempts % MAX_PIN_ATTEMPTS === 0) patch.pin_locked_until = lockoutUntil(attempts)
      await supabase.from("squeegee_employees").update(patch).eq("id", employee.id)

      console.warn(
        `[crew-login] failed PIN for employee ${employee.id} (attempt ${attempts}) ip=${
          request.headers.get("x-forwarded-for") ?? "unknown"
        }`
      )

      if (patch.pin_locked_until) return settle(NextResponse.json(LOCKED, { status: 429 }))
      return settle(NextResponse.json(FAIL, { status: 401 }))
    }

    return settle(await succeed(supabase, employee.id as string))
  } catch (err) {
    console.error("Crew login error:", err)
    return settle(
      NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
    )
  }
}

async function succeed(
  supabase: ReturnType<typeof getAdmin>,
  employeeId: string
): Promise<NextResponse> {
  await supabase
    .from("squeegee_employees")
    .update({
      last_login_at: new Date().toISOString(),
      pin_attempts: 0,
      pin_locked_until: null,
    })
    .eq("id", employeeId)

  const response = NextResponse.json({ ok: true })
  response.cookies.set(CREW_COOKIE, await createSessionValue(employeeId), sessionCookieOptions())
  return response
}
