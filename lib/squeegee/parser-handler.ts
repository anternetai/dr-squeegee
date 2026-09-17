// Shared text-to-CRM message handling. Lives here (not in the route) because
// BOTH inbound webhooks can receive Anthony's commands: the parser number's own
// hook, and the shared /api/twilio/sms-inbound hook (a Messaging Service's
// inbound URL overrides a number's own SmsUrl, and the parser number must live
// in that service to be A2P-registered / deliverable).

import { createClient } from "@supabase/supabase-js"
import { parseJobText, summarize, executeDraft, type ParsedJob } from "./parser"
import { crewReplyKeyword } from "./field"
import { smsCrewEventOnce } from "./sms-events"
import type { SendResult } from "./sms"

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

// The crew-alert half of Anthony's inbound texts. Returns false when there is
// nothing pending for him to answer, so the caller can keep parsing.
//
// "Newest pending in the last 12 hours, regardless of job": he answers the
// question he was just asked. Anything older has aged out — the crew is long
// past that moment and a customer text about it would be wrong.
const ALERT_WINDOW_MS = 12 * 60 * 60 * 1000

async function handleCrewAlertReply(
  supabase: ReturnType<typeof getAdmin>,
  reply: "yes" | "no"
): Promise<boolean> {
  const since = new Date(Date.now() - ALERT_WINDOW_MS).toISOString()
  const { data: alert } = await supabase
    .from("squeegee_crew_alerts")
    .select("id, job_id, kind, eta_minutes")
    .eq("status", "pending")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!alert) return false

  const actedAt = new Date().toISOString()

  if (reply === "no") {
    await supabase
      .from("squeegee_crew_alerts")
      .update({ status: "declined", acted_at: actedAt })
      .eq("id", alert.id)
    await replyToAnthony("Skipped.")
    return true
  }

  // Claim the alert BEFORE texting the customer. If the send throws, the alert
  // is already spent — better a missed courtesy text than a duplicate one every
  // time he taps YES twice on a flaky signal.
  await supabase
    .from("squeegee_crew_alerts")
    .update({ status: "confirmed", acted_at: actedAt })
    .eq("id", alert.id)

  const { data: job } = await supabase
    .from("squeegee_jobs")
    .select("client_name, client_phone")
    .eq("id", alert.job_id as string)
    .single()

  const name = (job?.client_name as string | undefined) ?? ""
  const custFirst = (name || "them").trim().split(/\s+/)[0]

  const result = await smsCrewEventOnce({
    jobId: alert.job_id as string,
    kind: alert.kind as "on_my_way" | "arrived",
    name,
    phone: (job?.client_phone as string | null | undefined) ?? null,
    etaMinutes: (alert.eta_minutes as number | null) ?? undefined,
  }).catch((err): SendResult => {
    console.error("[crew-alert] customer text failed:", err)
    return { sent: false, test: false, reason: "send error" }
  })

  if (result === null) {
    await replyToAnthony(`Already texted ${custFirst}.`)
    return true
  }

  if (result.id) {
    await supabase
      .from("squeegee_crew_alerts")
      .update({ customer_sms_id: result.id })
      .eq("id", alert.id)
  }

  await replyToAnthony(
    result.sent ? `Sent to ${custFirst}.` : `Couldn't text ${custFirst}: ${result.reason ?? "send failed"}.`
  )
  return true
}

// Returns true if the message was a text-to-CRM command we handled.
export async function handleParserMessage(fromPhone10: string, body: string): Promise<boolean> {
  if (fromPhone10 !== ANTHONY_CELL10) return false

  const supabase = getAdmin()
  const keyword = body.trim().toUpperCase().replace(/[^A-Z]/g, "")

  // YES/NO answers the newest crew alert (on the way / arrived). Checked BEFORE
  // the draft branch because a crew alert is the more time-sensitive question,
  // and "YES" can never be a SEND/CANCEL. With no live alert this returns false
  // rather than swallowing the message, so a stray YES falls through to the
  // opt-in path harmlessly.
  const reply = crewReplyKeyword(body)
  if (reply) {
    const handled = await handleCrewAlertReply(supabase, reply)
    if (handled) return true
  }

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
