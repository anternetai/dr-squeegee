import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { getSessionEmployee } from "@/lib/squeegee/employee-auth"
import { ONBOARDING_TASKS } from "@/lib/squeegee/company"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Crew toggles one of their own setup-checklist items. Only the manual tasks
// are toggleable (auto tasks derive from account state and can't be set here).
const MANUAL_KEYS = ONBOARDING_TASKS.filter((t) => !t.auto).map((t) => t.key)

export async function POST(request: NextRequest) {
  const employee = await getSessionEmployee()
  if (!employee) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const key = String(body?.key ?? "")
  const done = !!body?.done
  if (!MANUAL_KEYS.includes(key)) {
    return NextResponse.json({ error: "Unknown checklist item" }, { status: 400 })
  }

  const supabase = getAdmin()
  const { data: row } = await supabase
    .from("squeegee_employees")
    .select("onboarding_checklist")
    .eq("id", employee.id)
    .single()

  const checklist = { ...((row?.onboarding_checklist as Record<string, boolean>) ?? {}), [key]: done }
  const { error } = await supabase
    .from("squeegee_employees")
    .update({ onboarding_checklist: checklist })
    .eq("id", employee.id)

  if (error) {
    return NextResponse.json({ error: "Could not update." }, { status: 500 })
  }
  return NextResponse.json({ ok: true, checklist })
}
