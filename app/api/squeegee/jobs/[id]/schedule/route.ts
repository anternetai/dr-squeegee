import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { verifyCrmAuth } from "@/lib/crm-auth-check"
import { createJobBooking, cancelJobBooking, buildEasternISOString } from "@/lib/squeegee/calcom"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/

// POST — schedule (or reschedule) a job: sets appointment date/time, status
// -> 'scheduled', creates a Cal.com booking (cancelling any prior one first),
// and logs activity. Cal.com failures never block the CRM-side schedule.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await verifyCrmAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    let body: { date?: string; time?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { date, time } = body
    if (!date || !TIME_RE.test(time || "") || !DATE_RE.test(date)) {
      return NextResponse.json(
        { error: "Both date (YYYY-MM-DD) and time (HH:MM) are required" },
        { status: 400 }
      )
    }
    const normalizedTime = time!.length === 5 ? `${time}:00` : time!

    const supabase = getAdmin()

    const { data: job, error: fetchError } = await supabase
      .from("squeegee_jobs")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Re-scheduling — cancel the prior Cal.com booking first so we don't
    // leave orphaned bookings on the calendar.
    if (job.cal_booking_uid) {
      await cancelJobBooking(job.cal_booking_uid)
    }

    // Cal.com booking is best-effort — never block the CRM-side schedule on it.
    let bookingUid: string | null = null
    try {
      const startIso = buildEasternISOString(date, normalizedTime)
      const notesParts = [
        job.address,
        job.price != null ? `$${Number(job.price).toFixed(2)}` : null,
        job.notes || null,
      ].filter(Boolean)
      const booking = await createJobBooking({
        title: `${job.client_name} — ${job.service_type}`,
        start: startIso,
        clientName: job.client_name,
        notes: notesParts.join(" — "),
      })
      bookingUid = booking?.uid ?? null
    } catch (err) {
      console.error("[schedule] Cal.com booking threw unexpectedly (continuing CRM-only):", err)
    }

    const { data: updated, error: updateError } = await supabase
      .from("squeegee_jobs")
      .update({
        appointment_date: date,
        appointment_time: normalizedTime,
        status: "scheduled",
        cal_booking_uid: bookingUid,
      })
      .eq("id", id)
      .select("*")
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await supabase.from("squeegee_activity").insert({
      job_id: id,
      type: "scheduled",
      note: `Scheduled for ${date} at ${normalizedTime.slice(0, 5)}${bookingUid ? "" : " (Cal.com sync failed — CRM-only)"}`,
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error("Schedule error:", err)
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE — unschedule: clear appointment fields + cal_booking_uid, cancel the
// Cal.com booking, status back to 'approved', log activity.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await verifyCrmAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const supabase = getAdmin()

    const { data: job, error: fetchError } = await supabase
      .from("squeegee_jobs")
      .select("id, cal_booking_uid, appointment_date, appointment_time")
      .eq("id", id)
      .single()

    if (fetchError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    if (job.cal_booking_uid) {
      await cancelJobBooking(job.cal_booking_uid)
    }

    const { data: updated, error: updateError } = await supabase
      .from("squeegee_jobs")
      .update({
        appointment_date: null,
        appointment_time: null,
        status: "approved",
        cal_booking_uid: null,
      })
      .eq("id", id)
      .select("*")
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await supabase.from("squeegee_activity").insert({
      job_id: id,
      type: "unscheduled",
      note: "Removed from schedule",
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error("Unschedule error:", err)
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
