import { NextRequest, NextResponse } from "next/server"
import { getSessionEmployee } from "@/lib/squeegee/employee-auth"
import {
  closeOpenSegment,
  getCrewAdmin,
  jobPhotos,
  missingServices,
  nextStep,
  openSegment,
  photoGateReason,
  serviceList,
} from "@/lib/squeegee/crew"
import { sendSms } from "@/lib/squeegee/sms"

// Jobber's six presets. A tech picking from more than this on a phone in a
// driveway is a tech who picks nothing.
const ETA_PRESETS = [5, 10, 15, 30, 45, 60]

// Anthony's cell. Every crew status tap texts HIM, not the customer — the
// customer only hears from the business after he replies YES (parser-handler.ts).
const OWNER_PHONE = process.env.OWNER_PHONE ?? "+19802428048"

function firstName(name: string | null | undefined): string {
  return (name || "there").trim().split(/\s+/)[0]
}

/**
 * Advance a job's FIELD status — the crew axis, independent of the pipeline
 * `status` column that the CRM, invoices and receipts all branch on.
 *
 * Each tap also drives the clock, so there is no separate clock button to forget:
 *   on_my_way   -> opens a `drive` segment
 *   arrived     -> closes it (standing in a driveway is neither driving nor working)
 *   in_progress -> opens a `work` segment, behind the before-photo gate
 *
 * Completion is NOT here — it has its own (after) photo gate, so it lives in
 * ./complete.
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

  if (to !== "on_my_way" && to !== "arrived" && to !== "in_progress") {
    return NextResponse.json({ error: "Unknown status." }, { status: 400 })
  }

  const supabase = getCrewAdmin()
  const { data: job } = await supabase
    .from("squeegee_jobs")
    .select(
      "id, assigned_employee_id, status, field_status, client_name, client_phone, address, service_type"
    )
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

  // The BEFORE gate, enforced here and not only on the button. Every service on
  // the job needs at least one before photo before the clock starts on work — a
  // disabled button is a courtesy, this is the rule.
  const services = serviceList(job.service_type as string | null)
  if (to === "in_progress") {
    const photos = await jobPhotos(supabase, id)
    const blocked = photoGateReason("before", services, photos)
    if (blocked) {
      return NextResponse.json(
        { error: blocked, missing: missingServices("before", services, photos) },
        { status: 400 }
      )
    }
  }

  const { error } = await supabase
    .from("squeegee_jobs")
    .update({ field_status: to })
    .eq("id", id)

  if (error) {
    console.error("Field status error:", error)
    return NextResponse.json({ error: "Could not update. Try again." }, { status: 500 })
  }

  if (to === "arrived") {
    await closeOpenSegment(supabase, employee.id)
  } else {
    await openSegment(supabase, {
      employeeId: employee.id,
      jobId: id,
      kind: to === "on_my_way" ? "drive" : "work",
    })
  }

  // Owner alert. The crew's tap NEVER texts the customer — it texts Anthony and
  // waits. A failure here must never fail the tech's tap, so every step is
  // best-effort and the response still reports the status change.
  let notified = false
  if (to === "on_my_way" || to === "arrived") {
    const requested = Number(body?.etaMinutes)
    const etaMinutes = ETA_PRESETS.includes(requested) ? requested : 15
    notified = await alertOwner({
      supabase,
      jobId: id,
      employeeId: employee.id,
      crewName: employee.name,
      kind: to,
      etaMinutes: to === "on_my_way" ? etaMinutes : null,
      clientName: (job.client_name as string) ?? "",
      address: (job.address as string) ?? "",
    }).catch((err) => {
      console.error("Crew owner-alert error:", err)
      return false
    })
  }

  return NextResponse.json({ ok: true, field_status: to, notified })
}

/**
 * Expire whatever he hasn't answered on this job, open a fresh pending alert,
 * and text him. Expiring first is what keeps a YES unambiguous: there is only
 * ever one live question per job, so "YES" can't confirm a stale one.
 *
 * The text goes through sendSms (never a raw Twilio call) so opt-out, test-mode
 * redirect and the sms_messages audit row all apply to it like any other send.
 * `force` because Anthony is the owner, not a consented customer.
 */
async function alertOwner(args: {
  supabase: ReturnType<typeof getCrewAdmin>
  jobId: string
  employeeId: string
  crewName: string
  kind: "on_my_way" | "arrived"
  etaMinutes: number | null
  clientName: string
  address: string
}): Promise<boolean> {
  const { supabase, jobId, kind } = args

  await supabase
    .from("squeegee_crew_alerts")
    .update({ status: "expired", acted_at: new Date().toISOString() })
    .eq("job_id", jobId)
    .eq("status", "pending")

  const { data: alert, error } = await supabase
    .from("squeegee_crew_alerts")
    .insert({
      job_id: jobId,
      employee_id: args.employeeId,
      kind,
      eta_minutes: args.etaMinutes,
      status: "pending",
    })
    .select("id")
    .single()

  if (error || !alert) {
    console.error("Crew alert insert error:", error)
    return false
  }

  const crewFirst = firstName(args.crewName)
  const custFirst = firstName(args.clientName)
  const where = `${args.clientName}, ${args.address}`
  // Plain GSM-7 punctuation only: one curly quote or em dash flips the whole
  // message to UCS-2 and splits it into segments. See gsm7.ts.
  const text =
    kind === "on_my_way"
      ? `Crew: ${crewFirst} is on the way to ${where} (~${args.etaMinutes} min). Reply YES to text ${custFirst} we're on the way, NO to skip.`
      : `Crew: ${crewFirst} arrived at ${where}. Reply YES to text ${custFirst} we've arrived, NO to skip.`

  const result = await sendSms({
    phone: OWNER_PHONE,
    body: text,
    kind: "crew_alert_owner",
    relatedType: "crew_alert",
    relatedId: alert.id,
    force: true,
  })

  if (result.id) {
    await supabase
      .from("squeegee_crew_alerts")
      .update({ owner_sms_id: result.id })
      .eq("id", alert.id)
  }

  return result.sent
}
