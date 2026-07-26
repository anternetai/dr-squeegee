import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { verifyCrmAuth } from "@/lib/crm-auth-check"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Status moves + job edits from the job detail screen. These used to run as
// browser-side anon .update() calls, which is what kept squeegee_jobs open to
// anon in RLS. Explicit allowlist — no spreading the body into .update().
const JOB_EDITABLE = [
  "client_name",
  "client_phone",
  "client_email",
  "address",
  "service_type",
  "notes",
  "price",
  "appointment_date",
  "appointment_time",
  "status",
] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await verifyCrmAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { id } = await params
    const body = await request.json()

    const updates: Record<string, unknown> = {}
    for (const field of JOB_EDITABLE) {
      if (field in body) updates[field] = body[field]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 })
    }

    // A job only reaches 'scheduled' by booking a slot through the schedule
    // route (which holds the Cal.com booking). The UI already refuses this;
    // enforce it here too so the rule lives at the boundary, not in a screen.
    if (updates.status === "scheduled") {
      return NextResponse.json(
        { error: "Use the schedule endpoint to book a slot — status can't be set to scheduled directly" },
        { status: 409 }
      )
    }

    const supabase = getAdmin()
    const { data, error } = await supabase
      .from("squeegee_jobs")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

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

    // Delete related records first (FK order), then the job itself
    const { error: actErr } = await supabase.from("squeegee_activity").delete().eq("job_id", id)
    if (actErr) console.error("Failed to delete activity for job", id, actErr.message)

    const { error: invErr } = await supabase.from("squeegee_invoices").delete().eq("job_id", id)
    if (invErr) console.error("Failed to delete invoices for job", id, invErr.message)

    const { error: quoteErr } = await supabase.from("squeegee_quotes").delete().eq("job_id", id)
    if (quoteErr) console.error("Failed to delete quotes for job", id, quoteErr.message)

    const { error } = await supabase.from("squeegee_jobs").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
