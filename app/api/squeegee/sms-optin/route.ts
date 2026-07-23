import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

// Handles the standalone SMS opt-in form on /sms. Deliberately a plain HTML
// <form> POST (no JavaScript) so the consent flow is fully verifiable by A2P
// carrier reviewers and their crawlers — they see and can submit the exact
// opt-in at the URL cited in the campaign MessageFlow.

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const origin = request.nextUrl.origin
  const form = await request.formData().catch(() => null)
  if (!form) {
    return NextResponse.redirect(`${origin}/sms?error=1`, { status: 303 })
  }

  const name = String(form.get("name") || "").trim()
  const phone = String(form.get("phone") || "").trim()
  const consent = form.get("sms_consent") === "on"
  const phoneDigits = phone.replace(/[^0-9]/g, "")

  // Consent is the whole point of this form; no box, no signup.
  if (!consent || phoneDigits.length < 10) {
    return NextResponse.redirect(`${origin}/sms?error=1`, { status: 303 })
  }

  try {
    const supabase = getAdmin()
    await supabase.from("squeegee_leads").insert({
      name: name || "SMS opt-in",
      phone,
      services: ["SMS Updates"],
      source: "sms_optin",
      status: "new",
      sms_consent: true,
      sms_consent_timestamp: new Date().toISOString(),
    })

    if (process.env.SLACK_BOT_TOKEN) {
      await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        },
        body: JSON.stringify({
          channel: "U0ABZDLENJ1",
          text: `📩 *New SMS opt-in*\n*Name:* ${name || "—"}\n*Phone:* ${phone}`,
        }),
      }).catch(() => {})
    }
  } catch (err) {
    console.error("sms-optin insert error:", err)
    return NextResponse.redirect(`${origin}/sms?error=1`, { status: 303 })
  }

  return NextResponse.redirect(`${origin}/sms?subscribed=1`, { status: 303 })
}
