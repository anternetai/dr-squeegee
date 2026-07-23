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

const DETAIL_COLS =
  "id, created_at, name, phone, email, role, status, pay_type, pay_rate, availability, address, emergency_contact_name, emergency_contact_phone, invite_token, agreement_signed_at, onboarded_at, last_login_at, notes"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyCrmAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const { data, error } = await getAdmin()
    .from("squeegee_employees")
    .select(DETAIL_COLS)
    .eq("id", id)
    .single()
  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ employee: data })
}

// PATCH — owner edits. Whitelisted fields only; a special action "regen_invite"
// re-issues an onboarding link (e.g. lost invite before setup).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyCrmAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (body.action === "regen_invite") {
    update.invite_token = generateInviteToken()
    update.status = "invited"
    update.onboarded_at = null
  } else {
    if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim()
    if ("phone" in body) update.phone = body.phone ? String(body.phone) : null
    if ("email" in body) update.email = body.email ? String(body.email).trim().toLowerCase() : null
    if (["tech", "lead", "admin"].includes(body.role)) update.role = body.role
    if (["invited", "onboarding", "active", "inactive"].includes(body.status)) update.status = body.status
    if (["per_job", "hourly", "day_rate"].includes(body.pay_type)) update.pay_type = body.pay_type
    if ("pay_rate" in body) update.pay_rate = body.pay_rate != null && body.pay_rate !== "" ? Number(body.pay_rate) : null
    if ("availability" in body) update.availability = body.availability
    if ("address" in body) update.address = body.address ? String(body.address) : null
    if ("emergency_contact_name" in body) update.emergency_contact_name = body.emergency_contact_name ? String(body.emergency_contact_name) : null
    if ("emergency_contact_phone" in body) update.emergency_contact_phone = body.emergency_contact_phone ? String(body.emergency_contact_phone) : null
    if ("legal_name" in body) update.legal_name = body.legal_name ? String(body.legal_name) : null
    if ("onboarding_checklist" in body && body.onboarding_checklist && typeof body.onboarding_checklist === "object") update.onboarding_checklist = body.onboarding_checklist
    if ("notes" in body) update.notes = body.notes ? String(body.notes) : null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const { error } = await getAdmin().from("squeegee_employees").update(update).eq("id", id)
  if (error) {
    console.error("Update employee error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, invite_token: update.invite_token })
}

// DELETE — soft deactivate (keeps job history intact via the FK set-null).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyCrmAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const { error } = await getAdmin()
    .from("squeegee_employees")
    .update({ status: "inactive" })
    .eq("id", id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
