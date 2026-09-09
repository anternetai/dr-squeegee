import { NextRequest, NextResponse } from "next/server"
import { getSessionEmployee } from "@/lib/squeegee/employee-auth"
import { getCrewAdmin } from "@/lib/squeegee/crew"

/**
 * A crew member claims an open job off the board.
 *
 * The write is conditional — `.is("assigned_employee_id", null)` — so two people
 * tapping at the same moment can't both win. Postgres settles it; whoever loses
 * gets 0 rows back and is told plainly, rather than silently overwriting the
 * other person's claim.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const employee = await getSessionEmployee()
  if (!employee) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const supabase = getCrewAdmin()

  const { data: job } = await supabase
    .from("squeegee_jobs")
    .select("id, status, assigned_employee_id")
    .eq("id", id)
    .single()

  if (!job) {
    return NextResponse.json({ error: "That job doesn't exist." }, { status: 404 })
  }
  if (job.status !== "scheduled") {
    return NextResponse.json(
      { error: "That job isn't on the board anymore." },
      { status: 409 }
    )
  }
  if (job.assigned_employee_id === employee.id) {
    return NextResponse.json({ ok: true, alreadyMine: true })
  }

  const { data: claimed, error } = await supabase
    .from("squeegee_jobs")
    .update({
      assigned_employee_id: employee.id,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("assigned_employee_id", null)
    .select("id")

  if (error) {
    console.error("Claim job error:", error)
    return NextResponse.json({ error: "Could not claim it. Try again." }, { status: 500 })
  }

  if (!claimed || claimed.length === 0) {
    return NextResponse.json(
      { error: "Someone already claimed that one." },
      { status: 409 }
    )
  }

  return NextResponse.json({ ok: true })
}
