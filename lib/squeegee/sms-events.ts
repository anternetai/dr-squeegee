// Lifecycle SMS triggers. Thin wrappers over sendSms so each hook (quote create,
// accept, job complete, follow-up) stays a one-liner. Consent + opt-out +
// test-mode are all enforced inside sendSms; these just pick the template and
// dedupe where a double-send is possible.
//
// Templates that carry a URL return { body, link } and route through
// sendSmsWithLink, which sends the prose and then the bare URL as a SECOND
// message — the only shape iMessage will draw a preview card for and the only
// shape that reliably stays tappable on Android. See sms-templates.ts.

import { createClient } from "@supabase/supabase-js"
import { sendSms, sendSmsWithLink, type SendResult } from "./sms"
import { smsTemplates } from "./sms-templates"
import type { LinkedSms } from "./sms-templates"
import { signApptToken } from "./appt-token"

const SITE = "https://www.drsqueegeeclt.com"

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

interface Envelope {
  phone: string | null
  kind: string
  relatedType?: string | null
  relatedId?: string | null
  force?: boolean
}

// A template returns either plain prose or a prose+link pair. Route each to the
// right sender so no caller has to remember which is which.
function dispatch(env: Envelope, msg: LinkedSms | string): Promise<SendResult> {
  if (typeof msg === "string") {
    return sendSms({ ...env, body: msg })
  }
  return sendSmsWithLink({ ...env, body: msg.body, link: msg.link })
}

export async function smsQuoteReady(args: { name: string; phone: string | null; token: string; quoteId: string }): Promise<SendResult> {
  return dispatch(
    { phone: args.phone, kind: "quote_ready", relatedType: "quote", relatedId: args.quoteId },
    smsTemplates.quoteReady(args.name, args.token)
  )
}

export async function smsInvoice(args: { name: string; phone: string | null; token: string; quoteId: string }): Promise<SendResult> {
  return dispatch(
    { phone: args.phone, kind: "invoice", relatedType: "quote", relatedId: args.quoteId },
    smsTemplates.invoice(args.name, args.token)
  )
}

// Fired once payment clears (Stripe webhook) or when Anthony re-sends from the
// CRM. `force` because a paying customer has plainly transacted with us — but
// an explicit STOP still blocks it inside sendSms.
export async function smsReceipt(args: {
  name: string
  phone: string | null
  receiptToken: string
  totalPaid: number
  invoiceId: string
}): Promise<SendResult> {
  return dispatch(
    { phone: args.phone, kind: "receipt", relatedType: "invoice", relatedId: args.invoiceId, force: true },
    smsTemplates.receipt(args.name, args.receiptToken, args.totalPaid)
  )
}

// Fired the moment a quote is accepted. whenLabel non-null when the job already
// has an appointment on it (rare — usually scheduling happens after accept).
export async function smsQuoteAccepted(args: {
  name: string
  phone: string | null
  whenLabel: string | null
  quoteId: string
  jobId?: string | null
}): Promise<SendResult> {
  const calUrl =
    args.whenLabel && args.jobId ? `${SITE}/appt/${await signApptToken(args.jobId)}` : undefined
  return dispatch(
    { phone: args.phone, kind: "quote_accepted", relatedType: "quote", relatedId: args.quoteId },
    smsTemplates.quoteAccepted(args.name, args.whenLabel, calUrl)
  )
}

// Fired the moment a job is scheduled/rescheduled — immediate confirmation,
// separate from the day-before appointmentReminder cron.
export async function smsAppointmentConfirmed(args: {
  name: string
  phone: string | null
  service: string
  whenLabel: string
  jobId: string
}): Promise<SendResult> {
  const calUrl = `${SITE}/appt/${await signApptToken(args.jobId)}`
  return dispatch(
    { phone: args.phone, kind: "appointment_confirmed", relatedType: "job", relatedId: args.jobId },
    smsTemplates.appointmentConfirmed(args.name, args.service, args.whenLabel, calUrl)
  )
}

// Review ask after a completed job. Gated on GOOGLE_REVIEW_URL and de-duped so a
// job completed by crew AND touched in the CRM only ever gets one review text.
export async function smsReviewOnce(args: { jobId: string; name: string; phone: string | null }): Promise<SendResult | null> {
  const reviewUrl = process.env.GOOGLE_REVIEW_URL
  if (!reviewUrl) return null

  const supabase = getAdmin()
  const { data: prior } = await supabase
    .from("sms_messages")
    .select("id")
    .eq("kind", "review")
    .eq("related_type", "job")
    .eq("related_id", args.jobId)
    .not("status", "eq", "blocked") // a blocked attempt can retry once consent lands
    .limit(1)
    .maybeSingle()
  if (prior) return null

  return dispatch(
    { phone: args.phone, kind: "review", relatedType: "job", relatedId: args.jobId },
    smsTemplates.reviewRequest(args.name, reviewUrl)
  )
}
