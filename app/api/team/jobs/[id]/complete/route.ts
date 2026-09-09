import { NextRequest, NextResponse } from "next/server"
import { getSessionEmployee } from "@/lib/squeegee/employee-auth"
import {
  closeOpenSegment,
  getCrewAdmin,
  photoCounts,
  photoGateReason,
} from "@/lib/squeegee/crew"
import { smsReviewOnce } from "@/lib/squeegee/sms-events"

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

  const supabase = getCrewAdmin()
  const { data: job } = await supabase
    .from("squeegee_jobs")
    .select("id, assigned_employee_id, status, client_name, client_phone")
    .eq("id", id)
    .single()

  if (!job || job.assigned_employee_id !== employee.id) {
    return NextResponse.json({ error: "That job isn't assigned to you." }, { status: 403 })
  }

  // The photo gate, enforced HERE and not only in the UI. A disabled button is a
  // courtesy; this is the rule. Without it "take before/after photos on every job"
  // stays a line in the standards doc that nothing checks.
  const counts = await photoCounts(supabase, id)
  const blocked = photoGateReason(counts)
  if (blocked) {
    return NextResponse.json({ error: blocked, photos: counts }, { status: 400 })
  }

  const { error } = await supabase
    .from("squeegee_jobs")
    .update({
      status: "complete",
      field_status: null,
      completed_at: new Date().toISOString(),
      completion_note: note,
    })
    .eq("id", id)

  if (error) {
    console.error("Job complete error:", error)
    return NextResponse.json({ error: "Could not mark done. Try again." }, { status: 500 })
  }

  // Stop the clock. Done before the SMS so a texting failure can't leave a timer
  // running all night.
  await closeOpenSegment(supabase, employee.id)

  // Ask for a Google review (consent-gated, deduped, test-mode inside sendSms).
  await smsReviewOnce({
    jobId: id,
    name: (job.client_name as string) ?? "",
    phone: (job.client_phone as string | null) ?? null,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
