// Shared text-to-CRM message handling. Lives here (not in the route) because
// BOTH inbound webhooks can receive Anthony's commands: the parser number's own
// hook, and the shared /api/twilio/sms-inbound hook (a Messaging Service's
// inbound URL overrides a number's own SmsUrl, and the parser number must live
// in that service to be A2P-registered / deliverable).

import { createClient } from "@supabase/supabase-js"
import { parseJobText, summarize, executeDraft, type ParsedJob } from "./parser"

export const ANTHONY_CELL10 = "9802428048"

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Reply to Anthony. Sent from the parser number when set (it's A2P-registered
// via the Messaging Service), so his thread stays with the number he texted.
export async function replyToAnthony(text: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const keySid = process.env.TWILIO_API_KEY_SID
  const keySecret = process.env.TWILIO_API_KEY_SECRET
  const from = process.env.TWILIO_PARSER_NUMBER || process.env.SMS_FROM_NUMBER
  if (!accountSid || !keySid || !keySecret || !from) return
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keySid}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: `+1${ANTHONY_CELL10}`, Body: text }).toString(),
    })
    if (!res.ok) console.error("[parser] reply non-OK:", await res.text())
  } catch (err) {
    console.error("[parser] reply failed:", err)
  }
}

// Returns true if the message was a text-to-CRM command we handled.
export async function handleParserMessage(fromPhone10: string, body: string): Promise<boolean> {
  if (fromPhone10 !== ANTHONY_CELL10) return false

  const supabase = getAdmin()
  const keyword = body.trim().toUpperCase().replace(/[^A-Z]/g, "")

  if (keyword === "SEND" || keyword === "CANCEL") {
    const { data: draft } = await supabase
      .from("sms_parser_drafts")
      .select("id, parsed, raw_text")
      .eq("from_phone10", fromPhone10)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!draft) {
      await replyToAnthony("Nothing pending to send. Text me a job first.")
      return true
    }

    if (keyword === "CANCEL") {
      await supabase.from("sms_parser_drafts").update({ status: "cancelled", acted_at: new Date().toISOString() }).eq("id", draft.id)
      await replyToAnthony("Dropped it.")
      return true
    }

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
          ? `Done. Booked job created + customer texted their confirmation, calendar invite & pay link. ${link}`
          : `Done. Client + quote created + quote texted to them to accept. ${link}`
      )
    }
    return true
  }

  // Otherwise: a new job command.
  const parsed = await parseJobText(body)
  if (!parsed) {
    await replyToAnthony("Couldn't read that. Try: name, number, address, services, price, and (optional) day/time.")
    return true
  }

  await supabase.from("sms_parser_drafts").insert({
    from_phone10: fromPhone10,
    raw_text: body,
    parsed: parsed as unknown as Record<string, unknown>,
    status: "pending",
  })

  await replyToAnthony(`${summarize(parsed)}\n\nReply SEND to create + text them, or CANCEL to drop.`)
  return true
}
