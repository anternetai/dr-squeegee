import { NextRequest, NextResponse } from "next/server"
import { normalizePhone } from "@/lib/squeegee/sms"
import { handleParserMessage } from "@/lib/squeegee/parser-handler"

// Text-to-CRM inbound for the parser number's own webhook. The actual handling
// lives in lib/squeegee/parser-handler so the shared /api/twilio/sms-inbound
// hook can run the same logic (a Messaging Service's inbound URL overrides a
// number's SmsUrl, and the parser number must be in that service for A2P).
// Only Anthony's cell is ever acted on. Token-gated like the other Twilio hooks.

function emptyTwiml() {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
    headers: { "Content-Type": "text/xml" },
  })
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  if (!process.env.TWILIO_PARSER_TOKEN || token !== process.env.TWILIO_PARSER_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const form = await request.formData().catch(() => null)
  const from = normalizePhone(form?.get("From")?.toString() ?? "")
  const body = (form?.get("Body")?.toString() ?? "").trim()

  if (!from) return emptyTwiml()
  await handleParserMessage(from.phone10, body)
  return emptyTwiml()
}
