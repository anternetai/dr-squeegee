import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { getSessionEmployee } from "@/lib/squeegee/employee-auth"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Crew marks their own assigned job done. A crew member can only touch a job
// that is assigned to them — no cross-crew edits.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const employee = await getSessionEmployee()
  if (!employee) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const note = body?.note ? String(body.note).slice(0, 1000) : null

  const supabase = getAdmin()
  const { data: job } = await supabase
    .from("squeegee_jobs")
    .select("id, assigned_employee_id, status")
    .eq("id", id)
    .single()

  if (!job || job.assigned_employee_id !== employee.id) {
    return NextResponse.json({ error: "That job isn't assigned to you." }, { status: 403 })
  }

  const { error } = await supabase
    .from("squeegee_jobs")
    .update({
      status: "complete",
      completed_at: new Date().toISOString(),
      completion_note: note,
    })
    .eq("id", id)

  if (error) {
    console.error("Job complete error:", error)
    return NextResponse.json({ error: "Could not mark done. Try again." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
