import { NextRequest, NextResponse } from "next/server"

// Inbound voice webhook for the Twilio business line (980) 252-8701.
// Forwards every call to Anthony's cell; if he doesn't pick up within 25s the
// caller hears a short text-us-instead message. Twilio POSTs here on inbound
// call, then again at the same URL as the <Dial> action callback (that request
// carries DialCallStatus). Auth = shared token in the query string, set as
// TWILIO_VOICE_TOKEN in Vercel and embedded in the number's VoiceUrl — we don't
// hold this account's auth token, so X-Twilio-Signature validation isn't
// available here.

const FORWARD_TO = "+19802428048"
const BUSINESS_LINE = "+19802528701"

function twiml(body: string) {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  })
}

async function handle(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  if (!process.env.TWILIO_VOICE_TOKEN || token !== process.env.TWILIO_VOICE_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const form = await request.formData().catch(() => null)
  const dialStatus = form?.get("DialCallStatus")?.toString()

  // Second hit: the <Dial> finished. A completed call just hangs up; anything
  // else (no-answer, busy, failed) gets the missed-call message.
  if (dialStatus) {
    if (dialStatus === "completed" || dialStatus === "answered") {
      return twiml("<Hangup/>")
    }
    return twiml(
      '<Say voice="Polly.Matthew">You have reached Dr. Squeegee. We are out on a job right now. Please send us a text at this number and we will get right back to you.</Say>'
    )
  }

  // First hit: forward the call. callerId = the business line so Anthony's
  // phone shows the Dr. Squeegee contact, not the caller's number.
  const actionUrl = `/api/twilio/voice?token=${encodeURIComponent(token)}`
  return twiml(
    `<Dial callerId="${BUSINESS_LINE}" timeout="25" action="${actionUrl}" method="POST">${FORWARD_TO}</Dial>`
  )
}

export async function POST(request: NextRequest) {
  return handle(request)
}

export async function GET(request: NextRequest) {
  return handle(request)
}
