import { NextRequest, NextResponse } from "next/server"
import { getSessionEmployee } from "@/lib/squeegee/employee-auth"
import {
  closeJobClock,
  closeOpenSegment,
  getCrewAdmin,
  jobPhotos,
  missingServices,
  photoGateReason,
  serviceList,
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
    .select("id, assigned_employee_id, status, client_name, client_phone, service_type")
    .eq("id", id)
    .single()

  if (!job || job.assigned_employee_id !== employee.id) {
    return NextResponse.json({ error: "That job isn't assigned to you." }, { status: 403 })
  }

  // The photo gate, enforced HERE and not only in the UI. A disabled button is a
  // courtesy; this is the rule. Without it "take before/after photos on every job"
  // stays a line in the standards doc that nothing checks. Per service: every
  // service on the job needs an after photo before it can be called done.
  const services = serviceList(job.service_type as string | null)
  const photos = await jobPhotos(supabase, id)
  const blocked = photoGateReason("after", services, photos)
  if (blocked) {
    return NextResponse.json(
      { error: blocked, missing: missingServices("after", services, photos) },
      { status: 400 }
    )
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
  // running all night. closeOpenSegment covers this tech (including a segment
  // left open on some other job); closeJobClock covers the job, because a
  // reassignment mid-job leaves the PREVIOUS tech's segment open on it and
  // nothing else would ever close it.
  await closeOpenSegment(supabase, employee.id)
  await closeJobClock(supabase, id)

  // Ask for a Google review (consent-gated, deduped, test-mode inside sendSms).
  await smsReviewOnce({
    jobId: id,
    name: (job.client_name as string) ?? "",
    phone: (job.client_phone as string | null) ?? null,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
