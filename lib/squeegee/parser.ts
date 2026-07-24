// Text-to-CRM parser — the primary intake. Anthony texts a freeform job to the
// dedicated parser number; an LLM pulls the fields; on his SEND confirmation we
// build client -> quote -> job -> appointment and fire the customer texts.
// Verbal consent is recorded here (that's how he collects it), with his original
// text kept as the consent record.

import { createClient } from "@supabase/supabase-js"
import { createQuote } from "./create-quote"
import { smsAppointmentConfirmed, smsInvoice } from "./sms-events"
import { normalizePhone } from "./sms"
import { createJobBooking, buildEasternISOString } from "./calcom"

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export interface ParsedJob {
  name: string
  phone: string | null
  address: string
  services: { name: string; price: number }[]
  total_price: number
  was_price: number | null
  notes: string | null
  appointment_date: string | null // YYYY-MM-DD
  appointment_time: string | null // HH:MM (24h)
}

// Exact date lookup table for the next 2 weeks so the model never does weekday
// arithmetic (it's unreliable at it) — it just maps "next Wed" to a listed date.
function dateContext(): string {
  const fmt = (d: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d)
    const g = (t: string) => parts.find((p) => p.type === t)?.value
    return { weekday: g("weekday"), iso: `${g("year")}-${g("month")}-${g("day")}` }
  }
  const today = fmt(new Date())
  const lines = [`Today is ${today.weekday} ${today.iso}. Date reference (America/New_York):`]
  for (let i = 0; i <= 14; i++) {
    const d = fmt(new Date(Date.now() + i * 86_400_000))
    lines.push(`${i === 0 ? "today" : i === 1 ? "tomorrow" : "+" + i + "d"}: ${d.weekday} = ${d.iso}`)
  }
  return lines.join("\n")
}

// --- LLM extraction (OpenAI JSON mode) ---
export async function parseJobText(rawText: string): Promise<ParsedJob | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null

  const system = `You extract a home-service job from a business owner's freeform text into JSON.
${dateContext()}
Use ONLY that table to resolve relative dates ("Thursday", "next Wed", "tomorrow") to an exact YYYY-MM-DD — never compute weekdays yourself. Return ONLY a JSON object with this exact shape:
{
  "name": string,                         // customer name
  "phone": string|null,                   // 10-digit US, digits only, null if absent
  "address": string,                      // service address ("" if absent)
  "services": [{"name": string, "price": number}],  // one entry per service; assign prices that SUM to was_price if a "was"/original price is present, otherwise to total_price
  "total_price": number,                  // the final price to charge (what he stated as the price)
  "was_price": number|null,               // original/"was" price for a struck-through discount, null if none mentioned
  "notes": string|null,                   // gate codes, special instructions, etc.
  "appointment_date": string|null,        // YYYY-MM-DD, null if no date given
  "appointment_time": string|null         // HH:MM 24h, null if no time given
}
If a field is missing, use null (or "" for address, [] for services). Never invent a phone or price.`

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: rawText },
        ],
      }),
    })
    const data = await res.json()
    const text: string = data?.choices?.[0]?.message?.content ?? ""
    if (!text) {
      console.error("[parser] empty LLM response:", data?.error ?? data)
      return null
    }
    const parsed = JSON.parse(text) as ParsedJob
    parsed.phone = normalizePhone(parsed.phone)?.phone10 ?? null
    if (!Array.isArray(parsed.services)) parsed.services = []
    return parsed
  } catch (err) {
    console.error("[parser] LLM parse failed:", err)
    return null
  }
}

// One-line summary for the confirm text back to Anthony.
export function summarize(p: ParsedJob): string {
  const parts = [
    p.name,
    p.phone ? `${p.phone.slice(0, 3)}-${p.phone.slice(3, 6)}-${p.phone.slice(6)}` : "no #",
    p.address || "no address",
    p.services.map((s) => s.name).join(" + ") || "no services",
    p.was_price ? `$${p.was_price}→$${p.total_price}` : `$${p.total_price}`,
    p.appointment_date ? `${p.appointment_date}${p.appointment_time ? " " + p.appointment_time : ""}` : "no appt",
    p.notes ? `(${p.notes})` : "",
  ].filter(Boolean)
  return parts.join(" · ")
}

export interface ExecuteResult {
  ok: boolean
  clientId?: string
  jobId?: string
  quoteToken?: string
  booked: boolean
  error?: string
}

// --- Execute: build the whole record + fire customer texts ---
export async function executeDraft(p: ParsedJob, rawText: string): Promise<ExecuteResult> {
  const supabase = getAdmin()
  const booked = !!p.appointment_date

  if (!p.name || !p.address || p.services.length === 0) {
    return { ok: false, booked, error: "missing name/address/services" }
  }

  // 1) Upsert client by phone (match, else insert) — record verbal consent + the
  //    original text as the consent record.
  const norm = normalizePhone(p.phone)
  let clientId: string | undefined
  if (norm) {
    const { data: existing } = await supabase
      .from("squeegee_clients")
      .select("id, phone")
      .ilike("phone", `%${norm.phone10.slice(-4)}`)
    const match = (existing ?? []).find((c) => normalizePhone(c.phone)?.phone10 === norm.phone10)
    if (match) clientId = match.id
  }
  const consentFields = {
    sms_consent: true,
    sms_consent_at: new Date().toISOString(),
    sms_consent_method: "verbal",
    sms_consent_note: rawText.slice(0, 500),
  }
  if (clientId) {
    await supabase.from("squeegee_clients").update({ name: p.name, address: p.address, ...consentFields }).eq("id", clientId)
  } else {
    const { data: created } = await supabase
      .from("squeegee_clients")
      .insert({ name: p.name, phone: p.phone, address: p.address, ...consentFields })
      .select("id")
      .single()
    clientId = created?.id
  }

  // 2) Create the job.
  const serviceType = p.services.map((s) => s.name).join(", ")
  const { data: job, error: jobErr } = await supabase
    .from("squeegee_jobs")
    .insert({
      client_id: clientId ?? null,
      client_name: p.name,
      client_phone: p.phone,
      address: p.address,
      service_type: serviceType || "Service",
      status: "new",
      notes: p.notes,
    })
    .select("id")
    .single()
  if (jobErr || !job) return { ok: false, booked, error: jobErr?.message ?? "job insert failed" }

  // 3) Create the quote (fires quoteReady when NOT booked). Land the total on
  //    total_price no matter how the LLM split service prices: the "list price"
  //    (struck-through) = was_price when given, else total_price; scale services
  //    to sum to it, then discount down to total_price.
  const listPrice = p.was_price && p.was_price > p.total_price ? p.was_price : p.total_price
  const svcSum = p.services.reduce((s, x) => s + Math.max(0, Number(x.price || 0)), 0)
  let services = p.services.map((s) => ({ name: s.name, price: Math.max(0, Number(s.price || 0)) }))
  if (svcSum > 0.5 && Math.abs(svcSum - listPrice) > 0.5) {
    const factor = listPrice / svcSum
    services = services.map((s) => ({ name: s.name, price: Math.round(s.price * factor) }))
  } else if (svcSum <= 0.5) {
    if (services.length === 0) services = [{ name: serviceType || "Service", price: 0 }]
    services[0].price = listPrice
  }
  // absorb rounding drift so the subtotal lands exactly on listPrice
  const drift = listPrice - services.reduce((a, s) => a + s.price, 0)
  if (services.length) services[services.length - 1].price += drift
  const discountValue = Math.max(0, listPrice - p.total_price)
  const quote = await createQuote(supabase, {
    job_id: job.id,
    client_name: p.name,
    client_phone: p.phone,
    address: p.address,
    services,
    discount_type: discountValue > 0 ? "dollar" : null,
    discount_value: discountValue,
  })
  if (quote.error || !quote.quote) return { ok: false, booked, error: quote.error ?? "quote failed", clientId, jobId: job.id }

  // 4a) Booked job (appointment present): schedule + accept + invoice + confirm.
  if (booked) {
    const time = p.appointment_time && p.appointment_time.length === 5 ? `${p.appointment_time}:00` : p.appointment_time
    // Best-effort Cal.com booking so it lands on Anthony's Google Calendar too
    // (same as the CRM schedule flow) — never block the intake on it.
    let bookingUid: string | null = null
    try {
      const booking = await createJobBooking({
        title: `${p.name} — ${serviceType}`,
        start: buildEasternISOString(p.appointment_date!, time ?? "09:00:00"),
        clientName: p.name,
        notes: [p.address, `$${p.total_price}`, p.notes].filter(Boolean).join(" — "),
      })
      bookingUid = booking?.uid ?? null
    } catch {
      /* Cal.com is best-effort */
    }
    await supabase
      .from("squeegee_jobs")
      .update({ appointment_date: p.appointment_date, appointment_time: time, status: "scheduled", cal_booking_uid: bookingUid })
      .eq("id", job.id)
    await supabase.from("squeegee_quotes").update({ status: "accepted", client_response_at: new Date().toISOString() }).eq("id", quote.quote.id)

    // Invoice (mirrors the respond-route auto-invoice).
    const { count } = await supabase.from("squeegee_invoices").select("*", { count: "exact", head: true })
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String((count ?? 0) + 1001).padStart(4, "0")}`
    const due = new Date()
    due.setDate(due.getDate() + 7)
    await supabase.from("squeegee_invoices").insert({
      job_id: job.id,
      quote_id: quote.quote.id,
      invoice_number: invoiceNumber,
      amount: p.total_price,
      due_date: due.toISOString().split("T")[0],
      notes: `Auto-created from text-to-CRM. Services: ${serviceType}`,
      status: "sent",
      stripe_payment_link: null,
    })

    // Customer texts: appointment confirmation (+ calendar) and the pay link.
    const { formatApptLabel } = await import("./sms-templates")
    await smsAppointmentConfirmed({
      name: p.name,
      phone: p.phone,
      service: serviceType || "service",
      whenLabel: formatApptLabel(p.appointment_date!, time ?? null),
      jobId: job.id,
    }).catch(() => {})
    await smsInvoice({ name: p.name, phone: p.phone, token: quote.quote.token, quoteId: quote.quote.id }).catch(() => {})
  }
  // 4b) Not booked: createQuote already fired quoteReady to the customer.

  return { ok: true, clientId, jobId: job.id, quoteToken: quote.quote.token, booked }
}
