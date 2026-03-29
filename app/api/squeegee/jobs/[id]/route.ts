import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

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
