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
import { sanitizeForSms, isSendableLink, smsInfo } from "./gsm7"

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

// Record consent for a phone by flagging any matching client rows. Formatting-
// robust (last-4 + JS-normalize like hasConsent). Used by accept-as-opt-in and
// the text-to-CRM intake (method = 'accept' | 'verbal' | 'optin').
export async function recordConsentByPhone(phone: string | null | undefined, method: string): Promise<void> {
  const norm = normalizePhone(phone)
  if (!norm) return
  const supabase = getAdmin()
  const { data: clients } = await supabase
    .from("squeegee_clients")
    .select("id, phone")
    .ilike("phone", `%${norm.phone10.slice(-4)}`)
  const ids = (clients ?? []).filter((c) => normalizePhone(c.phone)?.phone10 === norm.phone10).map((c) => c.id)
  if (ids.length === 0) return
  await supabase
    .from("squeegee_clients")
    .update({ sms_consent: true, sms_consent_at: new Date().toISOString(), sms_consent_method: method })
    .in("id", ids)
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
  // Send `body` byte-for-byte: no opt-out tail, no [TEST] prefix. ONLY for the
  // bare-URL half of sendSmsWithLink — a link message has to be nothing but the
  // link or iMessage won't draw a preview card. Never set this by hand; the
  // opt-out language must ride on the prose message that precedes it.
  bare?: boolean
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

  // Smart punctuation is transliterated to GSM-7 on EVERY outbound body. One em
  // dash flips the whole message to UCS-2 and splits it into segments the
  // handset has to rejoin — which is where link auto-detection dies. See gsm7.ts.
  const body = args.bare ? sanitizeForSms(args.body) : withOptOut(sanitizeForSms(args.body))
  // Test mode: redirect to Anthony's cell, tag the intended recipient. A bare
  // link message is never tagged — the [TEST] prefix would stop it being a
  // URL-only message, which is the exact behaviour a test send needs to prove.
  const testTo = process.env.SMS_TEST_TO
  const to = live ? norm.e164 : (testTo ?? "")
  const finalBody = live || args.bare ? body : `[TEST → ${norm.e164}] ${body}`

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

/**
 * Send a link the way phones actually want to receive one: prose first, then a
 * second message containing nothing but the URL.
 *
 * Why two messages rather than one:
 *   - iMessage draws its rich preview card ONLY when the message body is just a
 *     URL. Wrapped in a sentence it renders as plain blue text with no card.
 *   - Android/RCS linkifiers routinely swallow punctuation that touches a URL
 *     ("...pay here: https://x/q/abc." -> the trailing dot lands in the href and
 *     the tap 404s).
 *   - A bare ASCII URL is always GSM-7 and always a single segment, so it never
 *     depends on multi-segment reassembly — which is the failure mode that made
 *     links unclickable on both platforms.
 *
 * The prose message carries the opt-out language, so the pair stays compliant
 * with what the A2P campaign registered.
 */
export interface SendLinkArgs extends Omit<SendArgs, "bare"> {
  link: string
}

export interface SendLinkResult extends SendResult {
  /** The bare-URL message. Undefined when the prose message never went out. */
  linkResult?: SendResult
}

export async function sendSmsWithLink(args: SendLinkArgs): Promise<SendLinkResult> {
  // A malformed link would silently become an unclickable text message — the
  // very bug this function exists to kill. Say so loudly rather than send it.
  if (!isSendableLink(args.link)) {
    console.error(
      `[sms] refusing to send an unsafe link message (kind=${args.kind}): ${JSON.stringify(args.link)} — ` +
        `must be a bare https URL, no whitespace, no trailing punctuation, single GSM-7 segment ` +
        `(${JSON.stringify(smsInfo(args.link))})`
    )
    return { sent: false, test: process.env.SMS_LIVE !== "true", reason: "unsafe link" }
  }

  // 1) Prose. Consent, opt-out, test-mode and logging all enforced inside sendSms.
  const prose = await sendSms({ ...args, body: args.body })
  // If the prose was blocked (opted out, no consent, bad number), the link must
  // not go out on its own — that would be an unsolicited bare URL.
  if (!prose.sent) return prose

  // 2) The link, alone. Awaited after the prose so they arrive in order.
  const linkResult = await sendSms({
    ...args,
    body: args.link,
    kind: `${args.kind}_link`,
    bare: true,
    // The consent decision was already made and passed one line above; re-running
    // it can only produce a prose-without-link split if state changed mid-send.
    force: true,
  })

  if (!linkResult.sent) {
    console.error(`[sms] prose sent but link message failed (kind=${args.kind}): ${linkResult.reason}`)
  }
  return { ...prose, linkResult }
}
