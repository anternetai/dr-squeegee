// Dr. Squeegee SMS — the one send path. A2P campaign C8TKR2H (VERIFIED) on
// messaging service TWILIO_MESSAGING_SERVICE_SID, number (980) 252-8701.
//
// Rules baked in here so no caller can skip them:
//   1. A number on sms_opt_outs is NEVER texted (STOP is law).
//   2. By default we only text numbers with recorded consent (leads/clients).
//   3. Every send is logged to sms_messages (the A2P volume + audit record).
//   4. Opt-out language is guaranteed on every outbound body.
//   5. Until SMS_LIVE === "true", every message is redirected to SMS_TEST_TO
//      (Anthony's cell) and stamped was_test — so real customers get nothing
//      while we shake it out. The live flip is a human decision, never code's.

import { createClient } from "@supabase/supabase-js"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export function normalizePhone(raw: string | null | undefined): { phone10: string; e164: string } | null {
  const digits = String(raw ?? "").replace(/[^0-9]/g, "")
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits
  if (ten.length !== 10) return null
  return { phone10: ten, e164: `+1${ten}` }
}

export async function isOptedOut(phone10: string): Promise<boolean> {
  const { data } = await getAdmin().from("sms_opt_outs").select("phone10").eq("phone10", phone10).maybeSingle()
  return !!data
}

// A number is textable if it opted in as a lead OR a client marked consent.
// Stored phones are formatted inconsistently ("(704) 555-7777", "704-555-7777"),
// so we narrow by the last 4 digits in SQL, then normalize + exact-match in JS.
export async function hasConsent(phone10: string): Promise<boolean> {
  const supabase = getAdmin()
  const last4 = `%${phone10.slice(-4)}`
  const [{ data: leads }, { data: clients }] = await Promise.all([
    supabase.from("squeegee_leads").select("phone").eq("sms_consent", true).ilike("phone", last4),
    supabase.from("squeegee_clients").select("phone").eq("sms_consent", true).ilike("phone", last4),
  ])
  const matches = (rows: { phone: string | null }[] | null) =>
    (rows ?? []).some((r) => normalizePhone(r.phone)?.phone10 === phone10)
  return matches(leads) || matches(clients)
}

export async function recordOptOut(phone10: string, source = "stop_keyword"): Promise<void> {
  await getAdmin().from("sms_opt_outs").upsert({ phone10, opted_out_at: new Date().toISOString(), source }, { onConflict: "phone10" })
}

export async function recordOptIn(phone10: string): Promise<void> {
  await getAdmin().from("sms_opt_outs").delete().eq("phone10", phone10)
}

const OPT_OUT_TAIL = "Reply STOP to opt out."
function withOptOut(body: string): string {
  return /stop to (opt|unsub|cancel)/i.test(body) ? body : `${body} ${OPT_OUT_TAIL}`
}

export interface SendArgs {
  phone: string | null | undefined
  body: string
  kind: string
  relatedType?: string | null
  relatedId?: string | null
  requireConsent?: boolean // default true
  force?: boolean          // bypass consent check (still blocked by opt-out) — manual admin sends
}

export interface SendResult {
  sent: boolean
  test: boolean
  reason?: string
  sid?: string
}

export async function sendSms(args: SendArgs): Promise<SendResult> {
  const supabase = getAdmin()
  const norm = normalizePhone(args.phone)
  const requireConsent = args.requireConsent !== false
  const live = process.env.SMS_LIVE === "true"

  async function log(status: string, extra: Partial<{ to_phone: string; twilio_sid: string; error: string; was_test: boolean }>) {
    try {
      await supabase.from("sms_messages").insert({
        direction: "outbound",
        phone10: norm?.phone10 ?? "0000000000",
        body: args.body,
        kind: args.kind,
        status,
        related_type: args.relatedType ?? null,
        related_id: args.relatedId ?? null,
        was_test: extra.was_test ?? false,
        to_phone: extra.to_phone ?? null,
        twilio_sid: extra.twilio_sid ?? null,
        error: extra.error ?? null,
      })
    } catch {
      /* logging must never break a send */
    }
  }

  if (!norm) {
    await log("failed", { error: "invalid phone" })
    return { sent: false, test: !live, reason: "invalid phone" }
  }
  if (await isOptedOut(norm.phone10)) {
    await log("blocked", { error: "opted out" })
    return { sent: false, test: !live, reason: "opted out" }
  }
  if (requireConsent && !args.force && !(await hasConsent(norm.phone10))) {
    await log("blocked", { error: "no consent" })
    return { sent: false, test: !live, reason: "no consent" }
  }

  const body = withOptOut(args.body)
  // Test mode: redirect to Anthony's cell, tag the intended recipient.
  const testTo = process.env.SMS_TEST_TO
  const to = live ? norm.e164 : (testTo ?? "")
  const finalBody = live ? body : `[TEST → ${norm.e164}] ${body}`

  if (!to) {
    await log("failed", { error: "no recipient (SMS_TEST_TO unset)" })
    return { sent: false, test: true, reason: "no test recipient configured" }
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const keySid = process.env.TWILIO_API_KEY_SID
  const keySecret = process.env.TWILIO_API_KEY_SECRET
  // Dr. Squeegee sends from its own number (704-286-9696). The number stays in
  // the A2P messaging-service pool for campaign registration; we address it
  // explicitly so this product's texts always come from the Dr. Squeegee line.
  const fromNumber = process.env.SMS_FROM_NUMBER
  if (!accountSid || !keySid || !keySecret || !fromNumber) {
    await log("failed", { error: "twilio env missing", was_test: !live, to_phone: to })
    return { sent: false, test: !live, reason: "twilio not configured" }
  }

  try {
    const params = new URLSearchParams({ From: fromNumber, To: to, Body: finalBody })
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keySid}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      await log("failed", { error: data?.message ?? `HTTP ${res.status}`, was_test: !live, to_phone: to })
      return { sent: false, test: !live, reason: data?.message ?? "send failed" }
    }
    await log(live ? "sent" : "test", { twilio_sid: data?.sid, was_test: !live, to_phone: to })
    return { sent: true, test: !live, sid: data?.sid }
  } catch (err) {
    await log("failed", { error: String(err), was_test: !live, to_phone: to })
    return { sent: false, test: !live, reason: "send error" }
  }
}
