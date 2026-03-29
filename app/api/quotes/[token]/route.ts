import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = await createClient()

    const { data: quote, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("token", token)
      .single()

    if (error || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    }

    // Update viewed_at on first view
    if (!quote.viewed_at) {
      await supabase
        .from("quotes")
        .update({ viewed_at: new Date().toISOString() })
        .eq("token", token)
    }

    return NextResponse.json({ quote })
  } catch (err) {
    console.error("GET /api/quotes/[token] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
