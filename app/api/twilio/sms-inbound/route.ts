import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { normalizePhone, recordOptOut, recordOptIn } from "@/lib/squeegee/sms"
import { handleParserMessage, ANTHONY_CELL10 } from "@/lib/squeegee/parser-handler"

// Inbound SMS webhook for the Dr. Squeegee business line (980) 252-8701.
// Handles opt-out/opt-in/help keywords and logs every inbound message, then
// forwards a heads-up to Anthony's Slack DM so he can reply from his thread.
// Auth = shared token in the query string (same pattern as the voice webhook —
// we don't hold this account's auth token for X-Twilio-Signature validation).

const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"])
const START_WORDS = new Set(["START", "YES", "UNSTOP"])
const HELP_WORDS = new Set(["HELP", "INFO"])

function twiml(message?: string) {
  const body = message ? `<Message>${message}</Message>` : ""
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  })
}

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  if (!process.env.TWILIO_SMS_TOKEN || token !== process.env.TWILIO_SMS_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const form = await request.formData().catch(() => null)
  const from = form?.get("From")?.toString() ?? ""
  const body = (form?.get("Body")?.toString() ?? "").trim()
  const norm = normalizePhone(from)
  const keyword = body.toUpperCase().replace(/[^A-Z]/g, "")

  const supabase = getAdmin()
  if (norm) {
    try {
      await supabase.from("sms_messages").insert({
        direction: "inbound",
        phone10: norm.phone10,
        to_phone: form?.get("To")?.toString() ?? null,
        body: body || "(empty)",
        kind: "inbound",
        status: "sent",
        twilio_sid: form?.get("MessageSid")?.toString() ?? null,
      })
    } catch {
      /* logging must never break inbound handling */
    }
  }

  // Anthony's own texts are text-to-CRM commands, not customer replies. The
  // parser number lives in the Messaging Service (for A2P registration), so its
  // inbound lands here — route his messages to the parser before anything else.
  if (norm && norm.phone10 === ANTHONY_CELL10) {
    const handled = await handleParserMessage(norm.phone10, body).catch(() => false)
    if (handled) return twiml()
  }

  // Keyword handling. If Twilio Advanced Opt-Out is on it intercepts these
  // before us and replies itself; recording here keeps OUR gate in sync either
  // way, and we return empty TwiML to avoid a duplicate customer reply.
  if (norm && STOP_WORDS.has(keyword)) {
    await recordOptOut(norm.phone10, "stop_keyword")
    return twiml()
  }
  if (norm && START_WORDS.has(keyword)) {
    await recordOptIn(norm.phone10)
    return twiml()
  }
  if (HELP_WORDS.has(keyword)) {
    return twiml()
  }

  // Real reply from a customer — ping Anthony so he can answer from his line.
  if (process.env.SLACK_BOT_TOKEN && norm) {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
      body: JSON.stringify({
        channel: "U0ABZDLENJ1",
        text: `💬 *Text from ${norm.e164}*\n${body || "(no text)"}`,
      }),
    }).catch(() => {})
  }

  return twiml()
}
