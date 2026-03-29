import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface LeadBody {
  name: string
  phone: string
  email?: string
  address?: string
  services: string[]
  property_type?: string
  timeline?: string
  sms_consent?: boolean
  sms_consent_timestamp?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LeadBody

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }
    if (!body.phone?.trim()) {
      return NextResponse.json({ error: "Phone is required" }, { status: 400 })
    }
    if (!body.services?.length) {
      return NextResponse.json({ error: "At least one service is required" }, { status: 400 })
    }

    const supabase = getAdmin()

    // Insert lead
    const { error: insertError } = await supabase.from("squeegee_leads").insert({
      name: body.name.trim(),
      phone: body.phone.trim(),
      email: body.email?.trim() || null,
      address: body.address?.trim() || null,
      services: body.services,
      property_type: body.property_type || null,
      timeline: body.timeline || null,
      source: "landing_page",
      status: "new",
      sms_consent: body.sms_consent || false,
      sms_consent_timestamp: body.sms_consent_timestamp || null,
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
    })

    if (insertError) {
      console.error("Lead insert error:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Send Slack DM to Anthony
    const serviceList = body.services.join(", ")
    const text = [
      `🧹 *New Quote Request*`,
      `*Name:* ${body.name}`,
      `*Phone:* ${body.phone}`,
      body.email ? `*Email:* ${body.email}` : null,
      body.address ? `*Address:* ${body.address}` : null,
      `*Services:* ${serviceList}`,
      body.property_type ? `*Property:* ${body.property_type}` : null,
      body.timeline ? `*Timeline:* ${body.timeline}` : null,
      body.sms_consent ? `*SMS Consent:* Yes` : `*SMS Consent:* No`,
      body.utm_source ? `*Source:* ${body.utm_source}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel: "U0ABZDLENJ1",
        text,
      }),
    }).catch((err) => {
      console.error("Slack notification failed:", err)
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Lead submission error:", err)
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
