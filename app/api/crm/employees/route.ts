import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyCrmAuth } from "@/lib/crm-auth-check"
import { generateInviteToken } from "@/lib/squeegee/employees"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const LIST_COLS =
  "id, created_at, name, phone, email, role, status, pay_type, pay_rate, availability, invite_token, onboarded_at, last_login_at"

// GET — all crew, newest first.
export async function GET() {
  if (!(await verifyCrmAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { data, error } = await getAdmin()
    .from("squeegee_employees")
    .select(LIST_COLS)
    .order("created_at", { ascending: false })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ employees: data ?? [] })
}

// POST — create a crew member + issue their onboarding invite token.
export async function POST(req: NextRequest) {
  if (!(await verifyCrmAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  if (!body?.name || !String(body.name).trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 })
  }

  const inviteToken = generateInviteToken()
  const { data, error } = await getAdmin()
    .from("squeegee_employees")
    .insert({
      name: String(body.name).trim(),
      phone: body.phone ? String(body.phone) : null,
      email: body.email ? String(body.email).trim().toLowerCase() : null,
      role: ["tech", "lead", "admin"].includes(body.role) ? body.role : "tech",
      pay_type: ["per_job", "hourly", "day_rate"].includes(body.pay_type) ? body.pay_type : "per_job",
      pay_rate: body.pay_rate != null && body.pay_rate !== "" ? Number(body.pay_rate) : null,
      status: "invited",
      invite_token: inviteToken,
    })
    .select("id, invite_token")
    .single()

  if (error) {
    console.error("Create employee error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: data.id, invite_token: data.invite_token })
}
