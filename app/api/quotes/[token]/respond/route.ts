import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type QuoteAction = "accepted" | "revision_requested" | "declined"

interface RespondBody {
  action: QuoteAction
  revision_notes?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = await createClient()

    const body: RespondBody = await request.json()
    const { action, revision_notes } = body

    const validActions: QuoteAction[] = ["accepted", "revision_requested", "declined"]
    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be: accepted, revision_requested, or declined" },
        { status: 400 }
      )
    }

    if (action === "revision_requested" && !revision_notes?.trim()) {
      return NextResponse.json(
        { error: "revision_notes is required when requesting a revision" },
        { status: 400 }
      )
    }

    // Verify the quote exists
    const { data: existing, error: fetchError } = await supabase
      .from("quotes")
      .select("id, status, expires_at")
      .eq("token", token)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    }

    if (existing.status !== "pending") {
      return NextResponse.json(
        { error: "This quote has already been responded to" },
        { status: 409 }
      )
    }

    if (existing.expires_at && new Date(existing.expires_at) < new Date()) {
      return NextResponse.json({ error: "This quote has expired" }, { status: 410 })
    }

    const updatePayload: Record<string, unknown> = {
      status: action,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (action === "revision_requested" && revision_notes) {
      updatePayload.revision_notes = revision_notes
    }

    const { data: quote, error: updateError } = await supabase
      .from("quotes")
      .update(updatePayload)
      .eq("token", token)
      .select("*")
      .single()

    if (updateError) {
      console.error("POST /api/quotes/[token]/respond error:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ quote })
  } catch (err) {
    console.error("POST /api/quotes/[token]/respond error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
