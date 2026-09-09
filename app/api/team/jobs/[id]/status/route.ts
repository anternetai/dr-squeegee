import { NextRequest, NextResponse } from "next/server"
import { getSessionEmployee } from "@/lib/squeegee/employee-auth"
import { getCrewAdmin, nextStep, openSegment } from "@/lib/squeegee/crew"
import { smsOnMyWayOnce } from "@/lib/squeegee/sms-events"

// Jobber's six presets. A tech picking from more than this on a phone in a
// driveway is a tech who picks nothing.
const ETA_PRESETS = [5, 10, 15, 30, 45, 60]

/**
 * Advance a job's FIELD status — the crew axis, independent of the pipeline
 * `status` column that the CRM, invoices and receipts all branch on.
 *
 * Each tap also drives the clock, so there is no separate clock button to forget:
 *   on_my_way  -> opens a `drive` segment (and texts the customer, once)
 *   in_progress-> closes `drive`, opens `work`
 *
 * Completion is NOT here — it has a photo gate, so it lives in ./complete.
 */
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
  const to = String(body?.to ?? "")

  if (to !== "on_my_way" && to !== "in_progress") {
    return NextResponse.json({ error: "Unknown status." }, { status: 400 })
  }

  const supabase = getCrewAdmin()
  const { data: job } = await supabase
    .from("squeegee_jobs")
    .select("id, assigned_employee_id, status, field_status, client_name, client_phone")
    .eq("id", id)
    .single()

  if (!job || job.assigned_employee_id !== employee.id) {
    return NextResponse.json({ error: "That job isn't yours." }, { status: 403 })
  }

  // Only ever the next legal step. Prevents a stale phone screen from jumping a
  // job backwards, or from starting work on something never marked on-the-way.
  const expected = nextStep({ status: job.status as string, field_status: job.field_status as string | null })
  if (expected !== to) {
    return NextResponse.json(
      { error: "That job already moved on. Pull to refresh." },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from("squeegee_jobs")
    .update({ field_status: to })
    .eq("id", id)

  if (error) {
    console.error("Field status error:", error)
    return NextResponse.json({ error: "Could not update. Try again." }, { status: 500 })
  }

  await openSegment(supabase, {
    employeeId: employee.id,
    jobId: id,
    kind: to === "on_my_way" ? "drive" : "work",
  })

  // Customer-facing side effect. Consent, opt-out, test-mode and logging are all
  // enforced inside sendSms; a failure here must never fail the tech's tap.
  let notified = false
  if (to === "on_my_way") {
    const requested = Number(body?.etaMinutes)
    const etaMinutes = ETA_PRESETS.includes(requested) ? requested : 15
    const result = await smsOnMyWayOnce({
      jobId: id,
      name: (job.client_name as string) ?? "",
      phone: (job.client_phone as string | null) ?? null,
      etaMinutes,
    }).catch((err) => {
      console.error("On-my-way SMS error:", err)
      return null
    })
    notified = !!result?.sent
  }

  return NextResponse.json({ ok: true, field_status: to, notified })
}
