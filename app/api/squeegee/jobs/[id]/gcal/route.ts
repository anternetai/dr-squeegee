import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/google-calendar"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST — Create or update a Google Calendar event for this job
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = getAdmin()

  const { data: job, error } = await supabase
    .from("squeegee_jobs")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  if (!job.appointment_date) {
    return NextResponse.json({ error: "No appointment date set" }, { status: 400 })
  }

  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({ error: "Google Calendar not configured" }, { status: 503 })
  }

  try {
    let eventId: string | null | undefined

    if (job.google_calendar_event_id) {
      // Update existing event
      await updateCalendarEvent(job.google_calendar_event_id, {
        client_name: job.client_name,
        address: job.address,
        service_type: job.service_type,
        client_phone: job.client_phone,
        price: job.price,
        appointment_date: job.appointment_date,
        appointment_time: job.appointment_time,
      })
      eventId = job.google_calendar_event_id
    } else {
      // Create new event
      eventId = await createCalendarEvent({
        client_name: job.client_name,
        address: job.address,
        service_type: job.service_type,
        client_phone: job.client_phone,
        price: job.price,
        appointment_date: job.appointment_date,
        appointment_time: job.appointment_time,
      })

      // Save the event ID to the job
      await supabase
        .from("squeegee_jobs")
        .update({ google_calendar_event_id: eventId })
        .eq("id", id)
    }

    return NextResponse.json({ success: true, eventId })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Google Calendar sync error:", message)
    return NextResponse.json({ error: "Calendar sync failed", details: message }, { status: 500 })
  }
}

// DELETE — Remove the Google Calendar event for this job
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = getAdmin()

  const { data: job, error } = await supabase
    .from("squeegee_jobs")
    .select("id, google_calendar_event_id")
    .eq("id", id)
    .single()

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  if (!job.google_calendar_event_id) {
    return NextResponse.json({ success: true, message: "No calendar event to remove" })
  }

  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({ error: "Google Calendar not configured" }, { status: 503 })
  }

  try {
    await deleteCalendarEvent(job.google_calendar_event_id)

    await supabase
      .from("squeegee_jobs")
      .update({ google_calendar_event_id: null })
      .eq("id", id)

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Google Calendar delete error:", message)
    return NextResponse.json({ error: "Calendar delete failed", details: message }, { status: 500 })
  }
}
