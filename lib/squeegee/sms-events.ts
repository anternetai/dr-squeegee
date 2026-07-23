// Lifecycle SMS triggers. Thin wrappers over sendSms so each hook (quote create,
// accept, job complete, follow-up) stays a one-liner. Consent + opt-out +
// test-mode are all enforced inside sendSms; these just pick the template and
// dedupe where a double-send is possible.

import { createClient } from "@supabase/supabase-js"
import { sendSms, type SendResult } from "./sms"
import { smsTemplates } from "./sms-templates"

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function smsQuoteReady(args: { name: string; phone: string | null; token: string; quoteId: string }): Promise<SendResult> {
  return sendSms({
    phone: args.phone,
    body: smsTemplates.quoteReady(args.name, args.token),
    kind: "quote_ready",
    relatedType: "quote",
    relatedId: args.quoteId,
  })
}

export async function smsInvoice(args: { name: string; phone: string | null; token: string; quoteId: string }): Promise<SendResult> {
  return sendSms({
    phone: args.phone,
    body: smsTemplates.invoice(args.name, args.token),
    kind: "invoice",
    relatedType: "quote",
    relatedId: args.quoteId,
  })
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

  return sendSms({
    phone: args.phone,
    body: smsTemplates.reviewRequest(args.name, reviewUrl),
    kind: "review",
    relatedType: "job",
    relatedId: args.jobId,
  })
}
