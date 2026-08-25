// Receipts for paid work.
//
// A receipt is not a separate record — it IS a paid invoice, presented as proof
// of payment. So it lives on the invoice row (receipt_token) rather than in its
// own table: one paid invoice can only ever produce one receipt, and re-sending
// has to land the customer on the same URL they already have.
//
// What a receipt must show (matching what Jobber / Housecall Pro / Square put on
// theirs, because customers file these for taxes and warranty claims):
//   - the word RECEIPT and a receipt number, distinct from the invoice number
//   - who was paid: legal entity, address, phone, site
//   - who paid, and the service address the work was done at
//   - itemised work, not just a total
//   - subtotal, discount, tip, and AMOUNT PAID broken out
//   - date paid, method, and card brand + last 4 when it was a card
//   - a transaction reference that can be matched against a bank statement

import { createClient } from "@supabase/supabase-js"
import { receiptNumberFor, type ReceiptData, type ReceiptService } from "./receipt-format"

// Presentation helpers live in receipt-format.ts so the client receipt page can
// import them without dragging a service-role Supabase client into the browser
// bundle. Re-exported here so server callers have one import site.
export { paymentLabel, receiptNumberFor, RECEIPT_BUSINESS } from "./receipt-format"
export type { ReceiptData, ReceiptService } from "./receipt-format"

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

/**
 * Guarantee the invoice has a receipt token, returning it. Safe to call twice —
 * an invoice that already has one keeps it, so a re-sent receipt never changes
 * the URL a customer has already saved.
 */
export async function ensureReceiptToken(invoiceId: string): Promise<string | null> {
  const supabase = getAdmin()
  const { data: existing } = await supabase
    .from("squeegee_invoices")
    .select("receipt_token")
    .eq("id", invoiceId)
    .maybeSingle()

  if (existing?.receipt_token) return existing.receipt_token as string

  // 5 bytes = 10 hex chars, same shape as the quote token.
  const token = Array.from(crypto.getRandomValues(new Uint8Array(5)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  const { error } = await supabase
    .from("squeegee_invoices")
    .update({ receipt_token: token })
    .eq("id", invoiceId)
    .is("receipt_token", null)

  if (error) {
    console.error("[receipt] could not set receipt_token:", error.message)
    // Lost a race with a concurrent writer — re-read rather than fail.
    const { data: retry } = await supabase
      .from("squeegee_invoices")
      .select("receipt_token")
      .eq("id", invoiceId)
      .maybeSingle()
    return (retry?.receipt_token as string) ?? null
  }
  return token
}

interface InvoiceJoin {
  id: string
  invoice_number: string
  amount: number | string
  tip_amount: number | string | null
  status: string
  paid_at: string | null
  payment_method: string | null
  card_brand: string | null
  card_last4: string | null
  stripe_payment_intent_id: string | null
  receipt_token: string | null
  job_id: string | null
  client_id: string | null
  quote_id: string | null
}

async function assemble(inv: InvoiceJoin): Promise<ReceiptData | null> {
  if (!inv.receipt_token) return null
  const supabase = getAdmin()

  const [{ data: quote }, { data: job }, { data: client }] = await Promise.all([
    inv.quote_id
      ? supabase
          .from("squeegee_quotes")
          .select("services, subtotal, discount_type, discount_value, total_price, client_name, client_phone, client_email, address")
          .eq("id", inv.quote_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    inv.job_id
      ? supabase
          .from("squeegee_jobs")
          .select("service_type, address, client_name, client_phone, client_email, appointment_date, completed_at")
          .eq("id", inv.job_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    inv.client_id
      ? supabase.from("squeegee_clients").select("name, phone, email, address").eq("id", inv.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const serviceTotal = Number(inv.amount) || 0
  const tip = Number(inv.tip_amount) || 0

  // Prefer the quote's line items — that is the itemisation the customer agreed
  // to. Fall back to the job's service type as a single line so a receipt is
  // never just a bare number.
  let services: ReceiptService[] = []
  if (quote?.services && Array.isArray(quote.services)) {
    services = (quote.services as ReceiptService[]).map((s) => ({
      name: String(s.name),
      price: Number(s.price) || 0,
      detail: s.detail,
      description: s.description,
    }))
  }
  if (services.length === 0) {
    services = [{ name: (job?.service_type as string) || "Exterior cleaning service", price: serviceTotal }]
  }

  const lineSum = services.reduce((sum, s) => sum + s.price, 0)
  const subtotal = Number(quote?.subtotal) || lineSum || serviceTotal

  // Reconstruct the discount from the quote, but trust the invoice for what was
  // actually charged — the invoice is the amount Stripe collected.
  let discountAmount = 0
  let discountLabel: string | null = null
  if (quote?.discount_type && Number(quote.discount_value) > 0) {
    const dv = Number(quote.discount_value)
    if (quote.discount_type === "percent") {
      discountAmount = Math.round(subtotal * (dv / 100) * 100) / 100
      discountLabel = `Discount (${dv}%)`
    } else {
      discountAmount = dv
      discountLabel = "Discount"
    }
  } else if (subtotal > serviceTotal) {
    discountAmount = Math.round((subtotal - serviceTotal) * 100) / 100
    discountLabel = "Discount"
  }

  const clientName =
    (client?.name as string) || (quote?.client_name as string) || (job?.client_name as string) || "Customer"
  const address = (job?.address as string) || (quote?.address as string) || (client?.address as string) || ""

  return {
    receiptToken: inv.receipt_token,
    receiptNumber: receiptNumberFor(inv.invoice_number),
    invoiceNumber: inv.invoice_number,
    invoiceId: inv.id,
    jobId: inv.job_id,

    clientName,
    clientPhone: (client?.phone as string) || (quote?.client_phone as string) || (job?.client_phone as string) || null,
    clientEmail: (client?.email as string) || (quote?.client_email as string) || (job?.client_email as string) || null,
    address,

    services,
    subtotal,
    discountLabel,
    discountAmount,
    serviceTotal,
    tip,
    totalPaid: Math.round((serviceTotal + tip) * 100) / 100,

    paidAt: inv.paid_at,
    paymentMethod: inv.payment_method,
    cardBrand: inv.card_brand,
    cardLast4: inv.card_last4,
    transactionRef: inv.stripe_payment_intent_id,

    jobServiceType: (job?.service_type as string) ?? null,
    servicedOn: (job?.completed_at as string) || (job?.appointment_date as string) || null,
  }
}

const INVOICE_COLUMNS =
  "id, invoice_number, amount, tip_amount, status, paid_at, payment_method, card_brand, card_last4, stripe_payment_intent_id, receipt_token, job_id, client_id, quote_id"

/** Public lookup for /r/[token]. Only ever resolves a PAID invoice. */
export async function getReceiptByToken(token: string): Promise<ReceiptData | null> {
  const { data } = await getAdmin()
    .from("squeegee_invoices")
    .select(INVOICE_COLUMNS)
    .eq("receipt_token", token)
    .maybeSingle()
  if (!data || data.status !== "paid") return null
  return assemble(data as InvoiceJoin)
}

/** Internal lookup for the send paths. Mints the token if it is missing. */
export async function getReceiptByInvoiceId(invoiceId: string): Promise<ReceiptData | null> {
  const supabase = getAdmin()
  const { data } = await supabase.from("squeegee_invoices").select(INVOICE_COLUMNS).eq("id", invoiceId).maybeSingle()
  if (!data) return null
  if (data.status !== "paid") return null

  let row = data as InvoiceJoin
  if (!row.receipt_token) {
    const token = await ensureReceiptToken(invoiceId)
    if (!token) return null
    row = { ...row, receipt_token: token }
  }
  return assemble(row)
}
