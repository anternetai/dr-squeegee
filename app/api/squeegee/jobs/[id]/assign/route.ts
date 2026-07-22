import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyCrmAuth } from "@/lib/crm-auth-check"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Assign (or clear) the crew member on a job. employee_id null unassigns.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyCrmAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const employeeId = body?.employee_id ? String(body.employee_id) : null

  if (employeeId) {
    const { data: emp } = await getAdmin()
      .from("squeegee_employees")
      .select("id, status")
      .eq("id", employeeId)
      .single()
    if (!emp) {
      return NextResponse.json({ error: "That crew member doesn't exist." }, { status: 400 })
    }
  }

  const { error } = await getAdmin()
    .from("squeegee_jobs")
    .update({ assigned_employee_id: employeeId })
    .eq("id", id)
  if (error) {
    console.error("Assign job error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
