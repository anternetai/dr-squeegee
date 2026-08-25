// Delivering a receipt. One function, two callers: the Stripe webhook (the
// moment payment clears) and the CRM's manual "Send receipt" button (cash,
// check, Zelle, or a re-send).
//
// SMS is the primary channel, not a fallback: most Dr. Squeegee customers have a
// phone and no email on file. Email goes out additionally when an address exists.

import { createClient } from "@supabase/supabase-js"
import { getReceiptByInvoiceId, type ReceiptData } from "./receipt"
import { smsReceipt } from "./sms-events"
import { sendReceiptEmail } from "./email"

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export interface SendReceiptResult {
  ok: boolean
  reason?: string
  receiptUrl?: string
  sms?: { sent: boolean; reason?: string; test?: boolean }
  email?: { sent: boolean; reason?: string }
  receipt?: ReceiptData
}

const SITE = "https://www.drsqueegeeclt.com"

/**
 * Build and deliver the receipt for a paid invoice.
 *
 * Never throws — a delivery failure must not roll back a payment that Stripe has
 * already captured. Failures come back in the result and are logged.
 */
export async function sendReceiptForInvoice(
  invoiceId: string,
  opts: { channels?: ("sms" | "email")[] } = {}
): Promise<SendReceiptResult> {
  const channels = opts.channels ?? ["sms", "email"]

  let receipt: ReceiptData | null = null
  try {
    receipt = await getReceiptByInvoiceId(invoiceId)
  } catch (err) {
    console.error("[receipt] lookup failed:", err)
    return { ok: false, reason: "lookup failed" }
  }
  if (!receipt) {
    return { ok: false, reason: "invoice not found or not paid" }
  }

  const receiptUrl = `${SITE}/r/${receipt.receiptToken}`
  const result: SendReceiptResult = { ok: false, receiptUrl, receipt }

  if (channels.includes("sms") && receipt.clientPhone) {
    try {
      const r = await smsReceipt({
        name: receipt.clientName,
        phone: receipt.clientPhone,
        receiptToken: receipt.receiptToken,
        totalPaid: receipt.totalPaid,
        invoiceId: receipt.invoiceId,
      })
      result.sms = { sent: r.sent, reason: r.reason, test: r.test }
    } catch (err) {
      console.error("[receipt] sms failed:", err)
      result.sms = { sent: false, reason: "send error" }
    }
  } else if (channels.includes("sms")) {
    result.sms = { sent: false, reason: "no phone on file" }
  }

  if (channels.includes("email") && receipt.clientEmail) {
    try {
      await sendReceiptEmail(receipt, receiptUrl)
      result.email = { sent: true }
    } catch (err) {
      console.error("[receipt] email failed:", err)
      result.email = { sent: false, reason: "send error" }
    }
  } else if (channels.includes("email")) {
    result.email = { sent: false, reason: "no email on file" }
  }

  result.ok = Boolean(result.sms?.sent || result.email?.sent)

  // Stamp only on a real delivery, so a failed attempt still looks unsent in the
  // CRM and Anthony knows to retry.
  if (result.ok) {
    const supabase = getAdmin()
    try {
      await supabase
        .from("squeegee_invoices")
        .update({ receipt_sent_at: new Date().toISOString() })
        .eq("id", invoiceId)

      await supabase.from("squeegee_activity").insert({
        job_id: receipt.jobId,
        type: "receipt_sent",
        note: `Receipt ${receipt.receiptNumber} sent to ${receipt.clientName} ($${receipt.totalPaid.toFixed(2)})`,
      })
    } catch (err) {
      // Bookkeeping only — the customer already has the receipt.
      console.error("[receipt] post-send bookkeeping failed:", err)
    }
  }

  return result
}
