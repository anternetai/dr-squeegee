// Shared quote-creation logic. Used by BOTH:
//  - app/api/squeegee/quotes/route.ts (existing per-job "Send Quote" flow)
//  - app/api/squeegee/quotes/full/route.ts (new one-screen quick-quote flow)
// so the insert shape and job-flip-to-"quoted" side effect can never drift apart.
import type { SupabaseClient } from "@supabase/supabase-js"
import { smsQuoteReady } from "./sms-events"

export interface QuoteServiceInput {
  name: string
  price: number
  description?: string
  /** Human-readable line detail, e.g. "24 windows · 2-story · in & out". Optional — old quotes/routes don't set it. */
  detail?: string
}

export interface CreateQuoteInput {
  job_id?: string | null
  client_name: string
  client_phone?: string | null
  client_email?: string | null
  address: string
  services: QuoteServiceInput[]
  discount_type?: "percent" | "dollar" | null
  discount_value?: number
}

export interface CreateQuoteResult {
  quote: { id: string; token: string } | null
  total_price: number
  error: string | null
}

export async function createQuote(
  supabase: SupabaseClient,
  input: CreateQuoteInput
): Promise<CreateQuoteResult> {
  const { job_id, client_name, client_phone, client_email, address, services, discount_type, discount_value } = input

  if (!client_name || !address || !services || services.length === 0) {
    return {
      quote: null,
      total_price: 0,
      error: "client_name, address, and services are required",
    }
  }

  const subtotal = services.reduce((sum, s) => sum + Number(s.price), 0)
  const discountVal = Number(discount_value) || 0
  const discountAmount =
    discount_type === "percent" ? Math.round(subtotal * (discountVal / 100) * 100) / 100 : discountVal
  const total_price = Math.max(0, subtotal - discountAmount)

  const { data, error } = await supabase
    .from("squeegee_quotes")
    .insert({
      job_id: job_id ?? null,
      client_name,
      client_phone: client_phone ?? null,
      client_email: client_email ?? null,
      address,
      services,
      subtotal,
      discount_type: discount_type ?? null,
      discount_value: discountVal,
      total_price,
    })
    .select("id, token")
    .single()

  if (error) {
    return { quote: null, total_price, error: error.message }
  }

  // Auto-update job status to "quoted" and set price/service info
  if (job_id) {
    const serviceNames = services.map((s) => s.name).join(", ")
    await supabase
      .from("squeegee_jobs")
      .update({
        status: "quoted",
        price: total_price,
        service_type: serviceNames,
      })
      .eq("id", job_id)
  }

  // Text the customer their quote link (consent-gated + test-mode inside sendSms;
  // a no-consent number is silently skipped, never blocks quote creation).
  if (data && client_phone) {
    await smsQuoteReady({ name: client_name, phone: client_phone, token: data.token, quoteId: data.id }).catch(() => {})
  }

  return { quote: data, total_price, error: null }
}
