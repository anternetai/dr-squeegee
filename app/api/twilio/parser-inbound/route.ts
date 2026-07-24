import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { normalizePhone } from "@/lib/squeegee/sms"
import { parseJobText, summarize, executeDraft, type ParsedJob } from "@/lib/squeegee/parser"

// Text-to-CRM inbound. Anthony texts a job to the dedicated parser number; we
// parse it, reply a summary, and on his "SEND" build the whole record + fire the
// customer texts. Only HIS cell is ever acted on. Token-gated like the other
// Twilio webhooks (we don't hold this account's auth token for signature checks).

const ANTHONY_CELL10 = "9802428048"

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function emptyTwiml() {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
    headers: { "Content-Type": "text/xml" },
  })
}

// Reply to Anthony FROM the parser number (direct Twilio — his own cell, not a
// customer, so it doesn't route through the brand-line sendSms path).
async function replyToAnthony(text: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const keySid = process.env.TWILIO_API_KEY_SID
  const keySecret = process.env.TWILIO_API_KEY_SECRET
  const from = process.env.TWILIO_PARSER_NUMBER
  if (!accountSid || !keySid || !keySecret || !from) return
  try {
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keySid}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: `+1${ANTHONY_CELL10}`, Body: text }).toString(),
    })
  } catch (err) {
    console.error("[parser] reply failed:", err)
  }
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  if (!process.env.TWILIO_PARSER_TOKEN || token !== process.env.TWILIO_PARSER_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const form = await request.formData().catch(() => null)
  const from = normalizePhone(form?.get("From")?.toString() ?? "")
  const body = (form?.get("Body")?.toString() ?? "").trim()

  // Hard gate: only Anthony's cell drives the CRM. Anyone else is ignored.
  if (!from || from.phone10 !== ANTHONY_CELL10) return emptyTwiml()

  const supabase = getAdmin()
  const keyword = body.toUpperCase().replace(/[^A-Z]/g, "")

  // SEND / CANCEL act on the latest pending draft.
  if (keyword === "SEND" || keyword === "CANCEL") {
    const { data: draft } = await supabase
      .from("sms_parser_drafts")
      .select("id, parsed, raw_text")
      .eq("from_phone10", from.phone10)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!draft) {
      await replyToAnthony("Nothing pending to send. Text me a job first.")
      return emptyTwiml()
    }

    if (keyword === "CANCEL") {
      await supabase.from("sms_parser_drafts").update({ status: "cancelled", acted_at: new Date().toISOString() }).eq("id", draft.id)
      await replyToAnthony("Dropped it. ✌️")
      return emptyTwiml()
    }

    // SEND — build everything + fire customer texts.
    const result = await executeDraft(draft.parsed as ParsedJob, draft.raw_text as string)
    await supabase
      .from("sms_parser_drafts")
      .update({ status: result.ok ? "sent" : "error", result: result as unknown as Record<string, unknown>, acted_at: new Date().toISOString() })
      .eq("id", draft.id)

    if (!result.ok) {
      await replyToAnthony(`Couldn't build it: ${result.error ?? "error"}. Tweak and text again, or add it in the CRM.`)
    } else {
      const link = result.jobId ? `drsqueegeeclt.com/crm/jobs/${result.jobId}` : "the CRM"
      await replyToAnthony(
        result.booked
          ? `Done ✅ Booked job created + customer texted their confirmation, calendar invite & pay link. ${link}`
          : `Done ✅ Client + quote created + quote texted to them to accept. ${link}`
      )
    }
    return emptyTwiml()
  }

  // Otherwise: a new job command → parse + save a pending draft + reply summary.
  const parsed = await parseJobText(body)
  if (!parsed) {
    await replyToAnthony("Couldn't read that. Try: name, number, address, services, price, and (optional) day/time.")
    return emptyTwiml()
  }

  await supabase.from("sms_parser_drafts").insert({
    from_phone10: from.phone10,
    raw_text: body,
    parsed: parsed as unknown as Record<string, unknown>,
    status: "pending",
  })

  await replyToAnthony(`${summarize(parsed)}\n\nReply SEND to create + text them, or CANCEL to drop.`)
  return emptyTwiml()
}
