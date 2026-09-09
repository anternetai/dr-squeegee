// The one snapshot every CRM number is computed from.
//
// loadSnapshot() reads ~300 rows once with the service-role client. Everything
// after that is a pure function of the snapshot: client metrics, pipeline
// state, revenue. The Dashboard, the Revenue page, the Clients page, the crons
// and the Monday digest all call the same functions, so they cannot disagree.
//
// Rules baked in here (verified against prod 2026-09-08):
//   - Revenue is PAID INVOICES. A job marked complete with no paid invoice is
//     "awaiting close-out", not income. Tips are always a separate number.
//   - squeegee_invoices.client_id is NULL on every auto-generated invoice, so a
//     client's money is resolved through the invoice's job.
//   - Numerics arrive from PostgREST as strings; they are coerced once, here.
//   - Every date-only column is an ET calendar day; instants are bucketed on
//     the ET calendar (see dates.ts). paid_at -> completed_at ->
//     appointment_date -> created_at is the fallback chain for "when".
//   - excluded_at rows (test data) are invisible to every metric.

import type { SupabaseClient } from "@supabase/supabase-js"
import { deriveJobServices, normalizeService, normalizeServices, SERVICES, type Service } from "./services.ts"
import { addMonthsYmd, dateKeyET, daysBetweenET, isYmd, todayET } from "./dates.ts"

/* ----------------------------------------------------------------------------
   Row shapes (the columns the math needs, numerics already coerced)
---------------------------------------------------------------------------- */

export interface JobRow {
  id: string
  client_id: string | null
  client_name: string
  client_phone: string | null
  address: string | null
  service_type: string | null
  price: number | null
  status: string
  appointment_date: string | null
  appointment_time: string | null
  created_at: string
  completed_at: string | null
  assigned_employee_id: string | null
  crew_pay: number | null
  lead_source: string | null
  excluded_at: string | null
}

export interface QuoteLineRow {
  name?: string | null
  price?: number | string | null
  detail?: string | null
}

export interface QuoteRow {
  id: string
  token: string | null
  job_id: string | null
  client_name: string | null
  client_phone: string | null
  services: QuoteLineRow[] | null
  total_price: number | null
  subtotal: number | null
  status: string
  accepted_via: string | null
  client_response_at: string | null
  created_at: string
  followup_count: number
  last_followup_at: string | null
  excluded_at: string | null
}

export interface InvoiceRow {
  id: string
  job_id: string | null
  client_id: string | null
  quote_id: string | null
  invoice_number: string
  amount: number
  tip_amount: number
  status: string
  paid_at: string | null
  payment_method: string | null
  created_at: string
  due_date: string | null
  sent_at: string | null
}

export interface ClientRow {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  blacklisted: boolean
  sms_consent: boolean
  tags: string[]
  lead_source: string | null
  created_at: string
}

export interface PlanRow {
  id: string
  client_id: string | null
  client_name: string | null
  client_phone: string | null
  status: string
  total_price: number
  annual_value: number
  billing: string | null
  monthly_price: number | null
  term_start: string | null
  term_end: string | null
  signed_at: string | null
}

export interface ExpenseRow {
  id: string
  spent_on: string
  amount: number
  category: string
  job_id: string | null
}

export interface OutreachRow {
  phone10: string
  channel: string | null
  service_offered: string | null
  created_at: string
  client_name: string | null
}

export interface SmsRow {
  kind: string | null
  phone10: string
  related_type: string | null
  related_id: string | null
  status: string
  created_at: string
}

export interface CrmSnapshot {
  clients: ClientRow[]
  jobs: JobRow[]
  quotes: QuoteRow[]
  invoices: InvoiceRow[]
  plans: PlanRow[]
  expenses: ExpenseRow[]
  outreach: OutreachRow[]
  sms: SmsRow[]
  loadedAt: string
}

/* ----------------------------------------------------------------------------
   Loading
---------------------------------------------------------------------------- */

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function num0(v: unknown): number {
  return num(v) ?? 0
}

export function phone10Of(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "")
  if (digits.length < 10) return null
  return digits.slice(-10)
}

const SMS_LOOKBACK_DAYS = 400

/**
 * PostgREST answers a plain select with at most `db-max-rows` (1000 on this
 * project, measured 2026-09-09) and says NOTHING when it truncates — no error,
 * no flag, just a short array. A `.limit(5000)` does not lift it. Every table
 * here is therefore read in ordered pages until a short page comes back, so the
 * snapshot can never quietly become a subset. sms_messages is the one that will
 * cross 1000 first (T4 starts sending), and a truncated pitch history means
 * offering a customer the same thing twice.
 */
const PAGE_SIZE = 1000

type PagedQuery = {
  range: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>
}

type Raw = Record<string, unknown>

async function selectAll(label: string, build: () => PagedQuery): Promise<Raw[]> {
  const out: Raw[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`loadSnapshot(${label}): ${error.message}`)
    const page = (data ?? []) as Raw[]
    out.push(...page)
    if (page.length < PAGE_SIZE) return out
  }
}

/** One read of everything the CRM computes from. Throws on any query error. */
export async function loadSnapshot(sb: SupabaseClient): Promise<CrmSnapshot> {
  const smsSince = new Date(Date.now() - SMS_LOOKBACK_DAYS * 86_400_000).toISOString()
  // Ordered by the primary key: offset paging without an ORDER BY can repeat
  // or skip rows between pages.
  const [clients, jobs, quotes, invoices, plans, expenses, outreach, sms] = await Promise.all([
    selectAll("clients", () =>
      sb
        .from("squeegee_clients")
        .select("id, name, phone, email, address, notes, blacklisted, sms_consent, tags, lead_source, created_at")
        .order("id")
    ),
    selectAll("jobs", () =>
      sb
        .from("squeegee_jobs")
        .select(
          "id, client_id, client_name, client_phone, address, service_type, price, status, appointment_date, appointment_time, created_at, completed_at, assigned_employee_id, crew_pay, lead_source, excluded_at"
        )
        .order("id")
    ),
    selectAll("quotes", () =>
      sb
        .from("squeegee_quotes")
        .select(
          "id, token, job_id, client_name, client_phone, services, total_price, subtotal, status, accepted_via, client_response_at, created_at, followup_count, last_followup_at, excluded_at"
        )
        .order("id")
    ),
    selectAll("invoices", () =>
      sb
        .from("squeegee_invoices")
        .select("id, job_id, client_id, quote_id, invoice_number, amount, tip_amount, status, paid_at, payment_method, created_at, due_date, sent_at")
        .order("id")
    ),
    selectAll("plans", () =>
      sb
        .from("squeegee_plans")
        .select("id, client_id, client_name, client_phone, status, total_price, annual_value, billing, monthly_price, term_start, term_end, signed_at")
        .order("id")
    ),
    selectAll("expenses", () => sb.from("squeegee_expenses").select("id, spent_on, amount, category, job_id").order("id")),
    selectAll("outreach", () =>
      sb.from("squeegee_outreach").select("phone10, channel, service_offered, created_at, client_name").order("id")
    ),
    selectAll("sms", () =>
      sb
        .from("sms_messages")
        .select("kind, phone10, related_type, related_id, status, created_at")
        .eq("direction", "outbound")
        .gte("created_at", smsSince)
        .order("id")
    ),
  ])

  const rows = <T>(data: Raw[]) => data.map((x) => x as unknown as T)

  return {
    clients: clients.map((c) => ({
      id: String(c.id),
      name: String(c.name ?? ""),
      phone: (c.phone as string | null) ?? null,
      email: (c.email as string | null) ?? null,
      address: (c.address as string | null) ?? null,
      notes: (c.notes as string | null) ?? null,
      blacklisted: !!c.blacklisted,
      sms_consent: !!c.sms_consent,
      tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
      lead_source: (c.lead_source as string | null) ?? null,
      created_at: String(c.created_at),
    })),
    jobs: jobs.map((j) => ({
      id: String(j.id),
      client_id: (j.client_id as string | null) ?? null,
      client_name: String(j.client_name ?? ""),
      client_phone: (j.client_phone as string | null) ?? null,
      address: (j.address as string | null) ?? null,
      service_type: (j.service_type as string | null) ?? null,
      price: num(j.price),
      status: String(j.status ?? "new"),
      appointment_date: (j.appointment_date as string | null) ?? null,
      appointment_time: (j.appointment_time as string | null) ?? null,
      created_at: String(j.created_at),
      completed_at: (j.completed_at as string | null) ?? null,
      assigned_employee_id: (j.assigned_employee_id as string | null) ?? null,
      crew_pay: num(j.crew_pay),
      lead_source: (j.lead_source as string | null) ?? null,
      excluded_at: (j.excluded_at as string | null) ?? null,
    })),
    quotes: quotes.map((q) => ({
      id: String(q.id),
      token: (q.token as string | null) ?? null,
      job_id: (q.job_id as string | null) ?? null,
      client_name: (q.client_name as string | null) ?? null,
      client_phone: (q.client_phone as string | null) ?? null,
      services: Array.isArray(q.services) ? (q.services as QuoteLineRow[]) : null,
      total_price: num(q.total_price),
      subtotal: num(q.subtotal),
      status: String(q.status ?? "pending"),
      accepted_via: (q.accepted_via as string | null) ?? null,
      client_response_at: (q.client_response_at as string | null) ?? null,
      created_at: String(q.created_at),
      followup_count: num0(q.followup_count),
      last_followup_at: (q.last_followup_at as string | null) ?? null,
      excluded_at: (q.excluded_at as string | null) ?? null,
    })),
    invoices: invoices.map((i) => ({
      id: String(i.id),
      job_id: (i.job_id as string | null) ?? null,
      client_id: (i.client_id as string | null) ?? null,
      quote_id: (i.quote_id as string | null) ?? null,
      invoice_number: String(i.invoice_number ?? ""),
      amount: num0(i.amount),
      tip_amount: num0(i.tip_amount),
      status: String(i.status ?? "draft"),
      paid_at: (i.paid_at as string | null) ?? null,
      payment_method: (i.payment_method as string | null) ?? null,
      created_at: String(i.created_at),
      due_date: (i.due_date as string | null) ?? null,
      sent_at: (i.sent_at as string | null) ?? null,
    })),
    plans: plans.map((p) => ({
      id: String(p.id),
      client_id: (p.client_id as string | null) ?? null,
      client_name: (p.client_name as string | null) ?? null,
      client_phone: (p.client_phone as string | null) ?? null,
      status: String(p.status ?? "draft"),
      total_price: num0(p.total_price),
      annual_value: num0(p.annual_value),
      billing: (p.billing as string | null) ?? null,
      monthly_price: num(p.monthly_price),
      term_start: (p.term_start as string | null) ?? null,
      term_end: (p.term_end as string | null) ?? null,
      signed_at: (p.signed_at as string | null) ?? null,
    })),
    expenses: expenses.map((e) => ({
      id: String(e.id),
      spent_on: String(e.spent_on),
      amount: num0(e.amount),
      category: String(e.category ?? "other"),
      job_id: (e.job_id as string | null) ?? null,
    })),
    outreach: rows<OutreachRow>(outreach),
    sms: rows<SmsRow>(sms),
    loadedAt: new Date().toISOString(),
  }
}

/* ----------------------------------------------------------------------------
   Indexes
---------------------------------------------------------------------------- */

export interface SnapshotIndex {
  jobsById: Map<string, JobRow>
  quotesByJob: Map<string, QuoteRow[]>
  invoicesByJob: Map<string, InvoiceRow[]>
  jobsByClient: Map<string, JobRow[]>
  plansByClient: Map<string, PlanRow[]>
  clientsById: Map<string, ClientRow>
  clientIdByPhone10: Map<string, string>
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const arr = map.get(key)
  if (arr) arr.push(value)
  else map.set(key, [value])
}

export function indexSnapshot(snap: CrmSnapshot): SnapshotIndex {
  const idx: SnapshotIndex = {
    jobsById: new Map(),
    quotesByJob: new Map(),
    invoicesByJob: new Map(),
    jobsByClient: new Map(),
    plansByClient: new Map(),
    clientsById: new Map(),
    clientIdByPhone10: new Map(),
  }
  for (const c of snap.clients) {
    idx.clientsById.set(c.id, c)
    const p = phone10Of(c.phone)
    if (p && !idx.clientIdByPhone10.has(p)) idx.clientIdByPhone10.set(p, c.id)
  }
  for (const j of snap.jobs) {
    idx.jobsById.set(j.id, j)
    if (j.client_id) push(idx.jobsByClient, j.client_id, j)
  }
  for (const q of snap.quotes) if (q.job_id) push(idx.quotesByJob, q.job_id, q)
  for (const i of snap.invoices) if (i.job_id) push(idx.invoicesByJob, i.job_id, i)
  for (const p of snap.plans) if (p.client_id) push(idx.plansByClient, p.client_id, p)
  // Newest first everywhere, so "the latest X" is [0].
  const byCreatedDesc = (a: { created_at: string }, b: { created_at: string }) => (a.created_at < b.created_at ? 1 : -1)
  for (const arr of idx.quotesByJob.values()) arr.sort(byCreatedDesc)
  for (const arr of idx.invoicesByJob.values()) arr.sort(byCreatedDesc)
  for (const arr of idx.jobsByClient.values()) arr.sort(byCreatedDesc)
  return idx
}

/* ----------------------------------------------------------------------------
   Small shared predicates
---------------------------------------------------------------------------- */

export const OPEN_QUOTE_STATUSES = new Set(["pending", "help"])
export const OPEN_INVOICE_STATUSES = new Set(["sent", "overdue"])

export function isLiveQuote(q: QuoteRow): boolean {
  return !q.excluded_at && q.status !== "superseded"
}

export function paidInvoiceFor(invoices: InvoiceRow[] | undefined): InvoiceRow | null {
  if (!invoices) return null
  const paid = invoices.filter((i) => i.status === "paid")
  if (paid.length === 0) return null
  // Latest payment wins for "when"; the amounts are summed elsewhere.
  return paid.sort((a, b) => ((a.paid_at ?? a.created_at) < (b.paid_at ?? b.created_at) ? 1 : -1))[0]
}

export function openInvoiceFor(invoices: InvoiceRow[] | undefined): InvoiceRow | null {
  if (!invoices) return null
  return invoices.find((i) => OPEN_INVOICE_STATUSES.has(i.status)) ?? invoices.find((i) => i.status === "draft") ?? null
}

/** The invoice's client: its own column when set, else through the job. */
export function invoiceClientId(inv: InvoiceRow, idx: SnapshotIndex): string | null {
  if (inv.client_id) return inv.client_id
  if (inv.job_id) return idx.jobsById.get(inv.job_id)?.client_id ?? null
  return null
}

/** The quote that describes what was actually done on a job. */
export function quoteForJob(jobId: string, idx: SnapshotIndex, invoice?: InvoiceRow | null): QuoteRow | null {
  const quotes = idx.quotesByJob.get(jobId) ?? []
  if (invoice?.quote_id) {
    const linked = quotes.find((q) => q.id === invoice.quote_id)
    if (linked) return linked
  }
  return quotes.find((q) => q.status === "accepted") ?? quotes.find(isLiveQuote) ?? quotes[0] ?? null
}

export function jobServices(job: JobRow, idx: SnapshotIndex): Service[] {
  const quote = quoteForJob(job.id, idx)
  return deriveJobServices(quote?.services as { name?: string | null }[] | null, job.service_type)
}

/** YYYY-MM-DD the work was done. completed_at -> appointment_date -> paid_at -> created_at. */
export function jobDoneDate(job: JobRow, paid: InvoiceRow | null): string {
  if (job.completed_at) return dateKeyET(job.completed_at)
  if (job.appointment_date && isYmd(job.appointment_date)) return job.appointment_date
  if (paid?.paid_at) return dateKeyET(paid.paid_at)
  return dateKeyET(job.created_at)
}

/** YYYY-MM-DD an invoice's money belongs to. paid_at -> job.completed_at -> job.appointment_date -> invoice.created_at. */
export function paidDateKey(inv: InvoiceRow, job: JobRow | null | undefined): string {
  if (inv.paid_at) return dateKeyET(inv.paid_at)
  if (job?.completed_at) return dateKeyET(job.completed_at)
  if (job?.appointment_date && isYmd(job.appointment_date)) return job.appointment_date
  return dateKeyET(inv.created_at)
}

export function bucketMonthET(inv: InvoiceRow, job: JobRow | null | undefined): string {
  return paidDateKey(inv, job).slice(0, 7)
}

/* ----------------------------------------------------------------------------
   Pipeline state — derived from the strongest signal, never declared
---------------------------------------------------------------------------- */

export type PipelineState =
  | "needs_quote"
  | "waiting_on_yes"
  | "needs_scheduling"
  | "scheduled"
  | "awaiting_closeout"
  | "paid"
  | "lost"
  | "cancelled"
  | "excluded"

export const PIPELINE_LABELS: Record<PipelineState, string> = {
  needs_quote: "Needs a quote",
  waiting_on_yes: "Waiting on a yes",
  needs_scheduling: "Needs scheduling",
  scheduled: "Scheduled",
  awaiting_closeout: "Done, not closed out",
  paid: "Paid",
  lost: "Lost",
  cancelled: "Cancelled",
  excluded: "Excluded",
}

export function derivePipelineState(job: JobRow, quotes: QuoteRow[] = [], invoices: InvoiceRow[] = []): PipelineState {
  if (job.excluded_at) return "excluded"
  if (job.status === "cancelled") return "cancelled"
  if (invoices.some((i) => i.status === "paid")) return "paid"
  if (job.status === "complete" || job.completed_at) return "awaiting_closeout"
  if (job.status === "scheduled") return "scheduled"

  const live = quotes.filter(isLiveQuote)
  const won = job.status === "approved" || live.some((q) => q.status === "accepted")
  if (won) return job.appointment_date ? "scheduled" : "needs_scheduling"
  if (live.some((q) => OPEN_QUOTE_STATUSES.has(q.status))) return "waiting_on_yes"
  if (live.length > 0 && live.every((q) => q.status === "declined")) return "lost"
  return "needs_quote"
}

export function appointmentPassed(job: JobRow, today: string): boolean {
  return !!job.appointment_date && isYmd(job.appointment_date) && job.appointment_date < today
}

export interface JobState {
  job: JobRow
  state: PipelineState
  paid: InvoiceRow | null
  openInvoice: InvoiceRow | null
  quotes: QuoteRow[]
  services: Service[]
  /** What close-out would charge: open invoice -> job price -> quote total. */
  closeOutAmount: number | null
}

export function jobStates(snap: CrmSnapshot, idx: SnapshotIndex = indexSnapshot(snap)): JobState[] {
  return snap.jobs.map((job) => {
    const quotes = idx.quotesByJob.get(job.id) ?? []
    const invoices = idx.invoicesByJob.get(job.id) ?? []
    const paid = paidInvoiceFor(invoices)
    const openInvoice = openInvoiceFor(invoices)
    const quote = quoteForJob(job.id, idx, paid ?? openInvoice)
    const closeOutAmount = openInvoice?.amount ?? job.price ?? quote?.total_price ?? null
    return {
      job,
      state: derivePipelineState(job, quotes, invoices),
      paid,
      openInvoice,
      quotes,
      services: deriveJobServices(quote?.services as { name?: string | null }[] | null, job.service_type),
      closeOutAmount,
    }
  })
}

/* ----------------------------------------------------------------------------
   Client metrics
---------------------------------------------------------------------------- */

export interface ClientMetrics {
  clientId: string
  name: string
  phone: string | null
  phone10: string | null
  email: string | null
  address: string | null
  blacklisted: boolean
  smsConsent: boolean
  tags: string[]
  leadSource: string | null
  clientSince: string
  lifetimeValue: number
  lifetimeTips: number
  paidInvoiceCount: number
  lastPaidAt: string | null
  openBalance: number
  openInvoiceCount: number
  draftBalance: number
  jobCount: number
  completedJobCount: number
  awaitingCloseoutCount: number
  firstJobAt: string | null
  lastJobAt: string | null
  /** YYYY-MM-DD of the most recent completed job. */
  lastServiceAt: string | null
  lastServiceByService: Partial<Record<Service, string>>
  servicesHad: Service[]
  openQuoteServices: Service[]
  careClub: boolean
  planStatus: string | null
  repeat: boolean
}

export function computeClientMetrics(snap: CrmSnapshot, idx: SnapshotIndex = indexSnapshot(snap)): Map<string, ClientMetrics> {
  const out = new Map<string, ClientMetrics>()
  const states = jobStates(snap, idx)
  const statesByClient = new Map<string, JobState[]>()
  for (const s of states) {
    if (s.job.client_id && s.state !== "excluded") push(statesByClient, s.job.client_id, s)
  }

  // Open quotes with no job (6 in prod on 2026-09-09, 4 of them matching a
  // client) still belong to somebody: match on phone10, the way
  // buildPitchHistory does. Without this an orphan quote for a service would
  // not suppress an offer for that same service, and the customer gets pitched
  // something they are already holding a quote for.
  const orphanQuoteServices = new Map<string, Set<Service>>()
  for (const q of snap.quotes) {
    if (q.job_id || !isLiveQuote(q) || !OPEN_QUOTE_STATUSES.has(q.status)) continue
    const p = phone10Of(q.client_phone)
    const cid = p ? idx.clientIdByPhone10.get(p) : undefined
    if (!cid) continue
    let set = orphanQuoteServices.get(cid)
    if (!set) {
      set = new Set()
      orphanQuoteServices.set(cid, set)
    }
    for (const svc of normalizeServices(q.services)) set.add(svc)
  }

  // Money by client, resolved through the job when the invoice has no client.
  const money = new Map<string, { value: number; tips: number; count: number; lastPaidAt: string | null; open: number; openCount: number; drafts: number }>()
  for (const inv of snap.invoices) {
    const job = inv.job_id ? idx.jobsById.get(inv.job_id) : null
    if (job?.excluded_at) continue
    const cid = invoiceClientId(inv, idx)
    if (!cid) continue
    const m = money.get(cid) ?? { value: 0, tips: 0, count: 0, lastPaidAt: null, open: 0, openCount: 0, drafts: 0 }
    if (inv.status === "paid") {
      m.value += inv.amount
      m.tips += inv.tip_amount
      m.count += 1
      const when = inv.paid_at ?? inv.created_at
      if (!m.lastPaidAt || when > m.lastPaidAt) m.lastPaidAt = when
    } else if (OPEN_INVOICE_STATUSES.has(inv.status)) {
      m.open += inv.amount
      m.openCount += 1
    } else if (inv.status === "draft") {
      m.drafts += inv.amount
    }
    money.set(cid, m)
  }

  for (const c of snap.clients) {
    const js = statesByClient.get(c.id) ?? []
    const m = money.get(c.id)
    const lastServiceByService: Partial<Record<Service, string>> = {}
    let lastServiceAt: string | null = null
    let completed = 0
    let awaiting = 0
    let firstJobAt: string | null = null
    let lastJobAt: string | null = null
    const openQuoteServices = new Set<Service>(orphanQuoteServices.get(c.id) ?? [])

    for (const s of js) {
      if (s.state === "cancelled") continue
      if (!firstJobAt || s.job.created_at < firstJobAt) firstJobAt = s.job.created_at
      if (!lastJobAt || s.job.created_at > lastJobAt) lastJobAt = s.job.created_at
      if (s.state === "waiting_on_yes") for (const svc of s.services) openQuoteServices.add(svc)
      const done = s.state === "paid" || s.state === "awaiting_closeout"
      if (!done) continue
      completed += 1
      if (s.state === "awaiting_closeout") awaiting += 1
      const doneOn = jobDoneDate(s.job, s.paid)
      if (!lastServiceAt || doneOn > lastServiceAt) lastServiceAt = doneOn
      for (const svc of s.services) {
        const prev = lastServiceByService[svc]
        if (!prev || doneOn > prev) lastServiceByService[svc] = doneOn
      }
    }

    const plans = (idx.plansByClient.get(c.id) ?? []).filter((p) => p.status === "signed" || p.status === "active")
    const servicesHad = SERVICES.filter((s) => lastServiceByService[s] !== undefined)

    out.set(c.id, {
      clientId: c.id,
      name: c.name,
      phone: c.phone,
      phone10: phone10Of(c.phone),
      email: c.email,
      address: c.address,
      blacklisted: c.blacklisted,
      smsConsent: c.sms_consent,
      tags: c.tags,
      leadSource: c.lead_source,
      clientSince: c.created_at,
      lifetimeValue: round2(m?.value ?? 0),
      lifetimeTips: round2(m?.tips ?? 0),
      paidInvoiceCount: m?.count ?? 0,
      lastPaidAt: m?.lastPaidAt ?? null,
      openBalance: round2(m?.open ?? 0),
      openInvoiceCount: m?.openCount ?? 0,
      draftBalance: round2(m?.drafts ?? 0),
      jobCount: js.filter((s) => s.state !== "cancelled").length,
      completedJobCount: completed,
      awaitingCloseoutCount: awaiting,
      firstJobAt,
      lastJobAt,
      lastServiceAt,
      lastServiceByService,
      servicesHad,
      openQuoteServices: [...openQuoteServices],
      careClub: plans.length > 0,
      planStatus: plans[0]?.status ?? null,
      repeat: completed >= 2,
    })
  }
  return out
}

/* ----------------------------------------------------------------------------
   Revenue
---------------------------------------------------------------------------- */

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Split one paid amount across service buckets, proportional to quote line prices. Sums to the amount to the cent. */
export function allocateByService(
  lines: QuoteLineRow[] | null | undefined,
  jobServicesFallback: Service[],
  paidAmount: number
): Partial<Record<Service, number>> {
  const out: Partial<Record<Service, number>> = {}
  const add = (s: Service, v: number) => {
    out[s] = round2((out[s] ?? 0) + v)
  }

  const priced = (lines ?? [])
    .map((l) => ({ service: normalizeService(l.name ?? "") ?? ("other" as Service), price: Math.max(0, num(l.price) ?? 0) }))
    .filter((l) => l.price > 0)
  const lineSum = priced.reduce((s, l) => s + l.price, 0)

  if (lineSum > 0) {
    for (const l of priced) add(l.service, (l.price / lineSum) * paidAmount)
  } else if (jobServicesFallback.length > 0) {
    for (const s of jobServicesFallback) add(s, paidAmount / jobServicesFallback.length)
  } else {
    add("other", paidAmount)
  }

  // Rounding drift lands on the biggest bucket so the total is exact.
  const total = Object.values(out).reduce((s, v) => s + (v ?? 0), 0)
  const drift = round2(paidAmount - total)
  if (drift !== 0) {
    const biggest = (Object.keys(out) as Service[]).sort((a, b) => (out[b] ?? 0) - (out[a] ?? 0))[0]
    if (biggest) out[biggest] = round2((out[biggest] ?? 0) + drift)
  }
  return out
}

export interface WinRate {
  /** Customer-answered quotes only: accepted by the customer / (those + declined). */
  winRate: number | null
  /** Everything that became work, however it got there / everything decided. */
  bookedRate: number | null
  /** Customer-answered count (the headline's denominator). */
  n: number
  accepted: number
  declined: number
}

const CUSTOMER_ACCEPT = new Set([null, "customer", "sms_intake"])

export function quoteWinRate(quotes: QuoteRow[]): WinRate {
  const live = quotes.filter(isLiveQuote)
  const declined = live.filter((q) => q.status === "declined").length
  const customerAccepted = live.filter((q) => q.status === "accepted" && CUSTOMER_ACCEPT.has(q.accepted_via)).length
  const accepted = live.filter((q) => q.status === "accepted").length
  const n = customerAccepted + declined
  const decided = accepted + declined
  return {
    winRate: n > 0 ? customerAccepted / n : null,
    bookedRate: decided > 0 ? accepted / decided : null,
    n,
    accepted,
    declined,
  }
}

export type RangePreset = "this_month" | "last_month" | "ytd" | "last_12_months" | "all"

export interface DateRange {
  from: string
  to: string
  preset?: RangePreset
}

export function rangeForPreset(preset: RangePreset, now: Date = new Date()): DateRange {
  const today = todayET(now)
  const month = today.slice(0, 7)
  switch (preset) {
    case "this_month":
      return { from: `${month}-01`, to: today, preset }
    case "last_month": {
      const start = addMonthsYmd(`${month}-01`, -1)
      const end = addMonthsYmd(`${month}-01`, 0)
      return { from: start, to: addDays(end, -1), preset }
    }
    case "ytd":
      return { from: `${today.slice(0, 4)}-01-01`, to: today, preset }
    case "last_12_months":
      return { from: addMonthsYmd(`${month}-01`, -11), to: today, preset }
    case "all":
    default:
      return { from: "2000-01-01", to: today, preset: "all" }
  }
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`
}

function inRange(ymd: string, range: DateRange): boolean {
  return ymd >= range.from && ymd <= range.to
}

export interface MonthBucket {
  month: string
  collected: number
  tips: number
  awaiting: number
  paidCount: number
}

export interface CloseoutItem {
  jobId: string
  clientId: string | null
  clientName: string
  serviceType: string | null
  amount: number | null
  doneOn: string
  reason: "complete_unpaid" | "appointment_passed"
}

export interface RevenueSummary {
  range: DateRange
  collected: number
  tips: number
  paidCount: number
  averageJob: number | null
  awaitingCloseout: { count: number; amount: number; items: CloseoutItem[] }
  sentUnpaid: { count: number; amount: number }
  drafts: { count: number; amount: number }
  byMonth: MonthBucket[]
  byService: Partial<Record<Service, number>>
  byMethod: Record<string, { count: number; amount: number }>
  byLeadSource: Record<string, { count: number; amount: number }>
  winRate: WinRate
  repeatRate: number | null
  repeatClients: number
  activeClients: number
  returningShare: number | null
  topClients: { clientId: string; name: string; value: number; jobs: number }[]
  careClub: { plans: number; contracted: number; monthly: number }
  staleQuotes: { count: number; amount: number }
  expenses: { total: number; byCategory: Record<string, number> }
  crewPay: number
  profit: number
  margin: number | null
}

export const STALE_QUOTE_DAYS = 45

export function computeRevenue(
  snap: CrmSnapshot,
  range: DateRange,
  opts: { now?: Date; idx?: SnapshotIndex; clientMetrics?: Map<string, ClientMetrics> } = {}
): RevenueSummary {
  const now = opts.now ?? new Date()
  const today = todayET(now)
  const idx = opts.idx ?? indexSnapshot(snap)
  const metrics = opts.clientMetrics ?? computeClientMetrics(snap, idx)
  const states = jobStates(snap, idx)
  const stateByJob = new Map(states.map((s) => [s.job.id, s]))

  const excludedJob = (jobId: string | null) => !!(jobId && idx.jobsById.get(jobId)?.excluded_at)

  // Paid invoices in range
  let collected = 0
  let tips = 0
  let paidCount = 0
  const byService: Partial<Record<Service, number>> = {}
  const byMethod: Record<string, { count: number; amount: number }> = {}
  const byLeadSource: Record<string, { count: number; amount: number }> = {}
  const paidJobIds = new Set<string>()
  let returning = 0

  for (const inv of snap.invoices) {
    if (inv.status !== "paid" || excludedJob(inv.job_id)) continue
    const job = inv.job_id ? idx.jobsById.get(inv.job_id) ?? null : null
    if (!inRange(paidDateKey(inv, job), range)) continue
    collected += inv.amount
    tips += inv.tip_amount
    paidCount += 1
    if (job) paidJobIds.add(job.id)

    const quote = job ? quoteForJob(job.id, idx, inv) : null
    const services = job ? deriveJobServices(quote?.services as { name?: string | null }[] | null, job.service_type) : []
    for (const [svc, amt] of Object.entries(allocateByService(quote?.services, services, inv.amount))) {
      byService[svc as Service] = round2((byService[svc as Service] ?? 0) + (amt ?? 0))
    }

    const method = inv.payment_method ?? "unrecorded"
    byMethod[method] = { count: (byMethod[method]?.count ?? 0) + 1, amount: round2((byMethod[method]?.amount ?? 0) + inv.amount) }

    const source = job?.lead_source ?? "unknown"
    byLeadSource[source] = { count: (byLeadSource[source]?.count ?? 0) + 1, amount: round2((byLeadSource[source]?.amount ?? 0) + inv.amount) }

    const cid = invoiceClientId(inv, idx)
    if (cid && metrics.get(cid)?.repeat) returning += inv.amount
  }

  // Awaiting close-out: done, not paid (all-time — money on the table has no range)
  const items: CloseoutItem[] = []
  for (const s of states) {
    if (s.state === "awaiting_closeout") {
      items.push({
        jobId: s.job.id,
        clientId: s.job.client_id,
        clientName: s.job.client_name,
        serviceType: s.job.service_type,
        amount: s.closeOutAmount,
        doneOn: jobDoneDate(s.job, null),
        reason: "complete_unpaid",
      })
    } else if (s.state === "scheduled" && appointmentPassed(s.job, today)) {
      items.push({
        jobId: s.job.id,
        clientId: s.job.client_id,
        clientName: s.job.client_name,
        serviceType: s.job.service_type,
        amount: s.closeOutAmount,
        doneOn: s.job.appointment_date as string,
        reason: "appointment_passed",
      })
    }
  }
  items.sort((a, b) => (a.doneOn < b.doneOn ? -1 : 1))

  // Open invoices (all-time)
  let sentUnpaid = { count: 0, amount: 0 }
  let drafts = { count: 0, amount: 0 }
  for (const inv of snap.invoices) {
    if (excludedJob(inv.job_id)) continue
    if (OPEN_INVOICE_STATUSES.has(inv.status)) sentUnpaid = { count: sentUnpaid.count + 1, amount: round2(sentUnpaid.amount + inv.amount) }
    else if (inv.status === "draft") drafts = { count: drafts.count + 1, amount: round2(drafts.amount + inv.amount) }
  }

  // By month: 13 buckets ending at the range's last month
  const endMonth = range.to.slice(0, 7)
  const months: string[] = []
  for (let i = 12; i >= 0; i--) months.push(addMonthsYmd(`${endMonth}-01`, -i).slice(0, 7))
  const byMonthMap = new Map<string, MonthBucket>(months.map((m) => [m, { month: m, collected: 0, tips: 0, awaiting: 0, paidCount: 0 }]))
  for (const inv of snap.invoices) {
    if (inv.status !== "paid" || excludedJob(inv.job_id)) continue
    const job = inv.job_id ? idx.jobsById.get(inv.job_id) ?? null : null
    const b = byMonthMap.get(bucketMonthET(inv, job))
    if (!b) continue
    b.collected = round2(b.collected + inv.amount)
    b.tips = round2(b.tips + inv.tip_amount)
    b.paidCount += 1
  }
  for (const it of items) {
    if (it.reason !== "complete_unpaid") continue
    const b = byMonthMap.get(it.doneOn.slice(0, 7))
    if (b) b.awaiting = round2(b.awaiting + (it.amount ?? 0))
  }

  // Quotes
  const liveQuotes = snap.quotes.filter((q) => !excludedJob(q.job_id))
  const winRate = quoteWinRate(liveQuotes)
  let staleQuotes = { count: 0, amount: 0 }
  for (const q of liveQuotes) {
    if (!isLiveQuote(q) || !OPEN_QUOTE_STATUSES.has(q.status)) continue
    const st = q.job_id ? stateByJob.get(q.job_id)?.state : "waiting_on_yes"
    if (st !== "waiting_on_yes" && st !== "needs_quote" && q.job_id) continue
    if (daysBetweenET(q.created_at, today) > STALE_QUOTE_DAYS) {
      staleQuotes = { count: staleQuotes.count + 1, amount: round2(staleQuotes.amount + (q.total_price ?? 0)) }
    }
  }

  // Clients
  const all = [...metrics.values()]
  const active = all.filter((m) => m.completedJobCount >= 1)
  const repeatClients = active.filter((m) => m.repeat).length
  const topClients = all
    .filter((m) => m.lifetimeValue > 0)
    .sort((a, b) => b.lifetimeValue - a.lifetimeValue)
    .slice(0, 10)
    .map((m) => ({ clientId: m.clientId, name: m.name, value: m.lifetimeValue, jobs: m.completedJobCount }))

  // Care Club (contracted, not collected)
  const signedPlans = snap.plans.filter((p) => p.status === "signed" || p.status === "active")
  const careClub = {
    plans: signedPlans.length,
    contracted: round2(signedPlans.reduce((s, p) => s + p.total_price, 0)),
    monthly: round2(signedPlans.reduce((s, p) => s + (p.billing === "monthly" ? p.monthly_price ?? p.total_price / 12 : p.total_price / 12), 0)),
  }

  // Profit
  let expensesTotal = 0
  const byCategory: Record<string, number> = {}
  for (const e of snap.expenses) {
    if (!inRange(e.spent_on, range)) continue
    expensesTotal += e.amount
    byCategory[e.category] = round2((byCategory[e.category] ?? 0) + e.amount)
  }
  let crewPay = 0
  for (const jobId of paidJobIds) crewPay += idx.jobsById.get(jobId)?.crew_pay ?? 0

  collected = round2(collected)
  const profit = round2(collected - expensesTotal - crewPay)

  return {
    range,
    collected,
    tips: round2(tips),
    paidCount,
    averageJob: paidCount > 0 ? round2(collected / paidCount) : null,
    awaitingCloseout: { count: items.length, amount: round2(items.reduce((s, i) => s + (i.amount ?? 0), 0)), items },
    sentUnpaid,
    drafts,
    byMonth: months.map((m) => byMonthMap.get(m) as MonthBucket),
    byService,
    byMethod,
    byLeadSource,
    winRate,
    repeatRate: active.length > 0 ? repeatClients / active.length : null,
    repeatClients,
    activeClients: active.length,
    returningShare: collected > 0 ? round2(returning) / collected : null,
    topClients,
    careClub,
    staleQuotes,
    expenses: { total: round2(expensesTotal), byCategory },
    crewPay: round2(crewPay),
    profit,
    margin: collected > 0 ? profit / collected : null,
  }
}
