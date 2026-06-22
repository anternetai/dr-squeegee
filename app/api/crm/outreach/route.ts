import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyCrmAuth } from "@/lib/crm-auth-check"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Log a manual outreach (text / call / note) against a past customer.
export async function POST(req: NextRequest) {
  const authed = await verifyCrmAuth()
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const phone10 = String(body.phone10 || "").replace(/[^0-9]/g, "").slice(-10)
  if (phone10.length !== 10) {
    return NextResponse.json({ error: "Valid phone10 required" }, { status: 400 })
  }

  const channel = ["sms", "call", "note"].includes(body.channel) ? body.channel : "note"
  const serviceOffered = body.service_offered ? String(body.service_offered) : null
  const note = body.note ? String(body.note) : null
  const clientName = body.client_name ? String(body.client_name) : null

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("squeegee_outreach")
    .insert({
      phone10,
      client_name: clientName,
      channel,
      service_offered: serviceOffered,
      note,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ outreach: data })
}
