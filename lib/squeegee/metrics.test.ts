import { test } from "node:test"
import assert from "node:assert/strict"
import {
  allocateByService,
  bucketMonthET,
  computeClientMetrics,
  computeRevenue,
  derivePipelineState,
  indexSnapshot,
  jobStates,
  paidDateKey,
  quoteWinRate,
  rangeForPreset,
  type ClientRow,
  type CrmSnapshot,
  type InvoiceRow,
  type JobRow,
  type QuoteRow,
} from "./metrics.ts"

/* ---------------- fixtures ---------------- */

let seq = 0
const id = (p: string) => `${p}-${++seq}`

function client(over: Partial<ClientRow> = {}): ClientRow {
  return {
    id: id("c"),
    name: "Client",
    phone: "(704) 555-0100",
    email: null,
    address: "1 Main St",
    notes: null,
    blacklisted: false,
    sms_consent: true,
    tags: [],
    lead_source: null,
    created_at: "2026-01-01T12:00:00Z",
    ...over,
  }
}

function job(over: Partial<JobRow> = {}): JobRow {
  return {
    id: id("j"),
    client_id: null,
    client_name: "Client",
    client_phone: "(704) 555-0100",
    address: "1 Main St",
    service_type: "House Washing",
    price: 300,
    status: "quoted",
    appointment_date: null,
    appointment_time: null,
    created_at: "2026-06-01T12:00:00Z",
    completed_at: null,
    assigned_employee_id: null,
    crew_pay: null,
    lead_source: null,
    excluded_at: null,
    ...over,
  }
}

function quote(over: Partial<QuoteRow> = {}): QuoteRow {
  return {
    id: id("q"),
    token: "tok",
    job_id: null,
    client_name: "Client",
    client_phone: "(704) 555-0100",
    services: [{ name: "House Washing", price: 300 }],
    total_price: 300,
    subtotal: 300,
    status: "pending",
    accepted_via: null,
    client_response_at: null,
    created_at: "2026-06-01T12:00:00Z",
    followup_count: 0,
    last_followup_at: null,
    excluded_at: null,
    ...over,
  }
}

function invoice(over: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: id("i"),
    job_id: null,
    client_id: null,
    quote_id: null,
    invoice_number: "INV-2026-1001",
    amount: 300,
    tip_amount: 0,
    status: "sent",
    paid_at: null,
    payment_method: null,
    created_at: "2026-06-02T12:00:00Z",
    due_date: null,
    sent_at: null,
    ...over,
  }
}

function snapshot(over: Partial<CrmSnapshot> = {}): CrmSnapshot {
  return {
    clients: [],
    jobs: [],
    quotes: [],
    invoices: [],
    plans: [],
    expenses: [],
    outreach: [],
    sms: [],
    loadedAt: "2026-09-08T12:00:00Z",
    ...over,
  }
}

const NOW = new Date("2026-09-08T16:00:00Z") // noon EDT Sep 8

/* ---------------- bucketing ---------------- */

test("money buckets on the ET calendar: 9pm New Year's Eve is December", () => {
  const inv = invoice({ status: "paid", paid_at: "2026-01-01T02:00:00Z" })
  assert.equal(bucketMonthET(inv, null), "2025-12")
})

test("paidDateKey falls back paid_at -> completed_at -> appointment_date -> created_at", () => {
  const j = job({ completed_at: "2026-05-10T15:00:00Z", appointment_date: "2026-05-01" })
  assert.equal(paidDateKey(invoice({ paid_at: "2026-06-03T15:00:00Z" }), j), "2026-06-03")
  assert.equal(paidDateKey(invoice({ paid_at: null }), j), "2026-05-10")
  assert.equal(paidDateKey(invoice({ paid_at: null }), job({ appointment_date: "2026-05-01" })), "2026-05-01")
  assert.equal(paidDateKey(invoice({ paid_at: null, created_at: "2026-04-20T03:00:00Z" }), job()), "2026-04-19")
})

/* ---------------- allocation ---------------- */

test("allocateByService splits proportionally and sums to the cent", () => {
  const lines = [
    { name: "House Washing", price: 300 },
    { name: "Window Cleaning", price: 200 },
  ]
  const out = allocateByService(lines, [], 450) // discounted from 500
  assert.equal(out.house_wash, 270)
  assert.equal(out.windows, 180)
  for (let amount = 1; amount <= 40; amount++) {
    const paid = amount * 33.33
    const alloc = allocateByService([{ name: "Driveway", price: 137 }, { name: "Windows", price: 89 }, { name: "Gutters", price: 61 }], [], paid)
    const sum = Object.values(alloc).reduce((s, v) => s + (v ?? 0), 0)
    assert.equal(Math.round(sum * 100), Math.round(paid * 100), `paid ${paid}`)
  }
})

test("allocateByService falls back to an even split, then to other", () => {
  assert.deepEqual(allocateByService(null, ["house_wash", "windows"], 100), { house_wash: 50, windows: 50 })
  assert.deepEqual(allocateByService([], [], 100), { other: 100 })
  // Zero-priced lines are ignored (an "included" line item must not eat a share).
  assert.deepEqual(allocateByService([{ name: "House Washing", price: 0 }], ["house_wash"], 100), { house_wash: 100 })
})

/* ---------------- win rate ---------------- */

test("quote win rate counts customer answers only; booked rate counts everything", () => {
  const quotes = [
    quote({ status: "accepted", accepted_via: "customer" }),
    quote({ status: "accepted", accepted_via: null }), // legacy = customer
    quote({ status: "accepted", accepted_via: "auto_close" }),
    quote({ status: "accepted", accepted_via: "close_out" }),
    quote({ status: "declined" }),
    quote({ status: "pending" }),
    quote({ status: "superseded" }),
    quote({ status: "accepted", accepted_via: "customer", excluded_at: "2026-09-01T00:00:00Z" }),
  ]
  const r = quoteWinRate(quotes)
  assert.equal(r.n, 3)
  assert.equal(r.winRate, 2 / 3)
  assert.equal(r.bookedRate, 4 / 5)
  assert.equal(quoteWinRate([]).winRate, null)
})

/* ---------------- pipeline state (the real stuck-row shapes) ---------------- */

test("derivePipelineState uses the strongest signal", () => {
  // The 8 stuck rows: approved, no date, invoice still 'sent'
  assert.equal(derivePipelineState(job({ status: "approved" }), [quote({ status: "accepted" })], [invoice({ status: "sent" })]), "needs_scheduling")
  // Complete with a pending quote and no invoice (Cervantes / Nesbitt / Leatherwood)
  assert.equal(derivePipelineState(job({ status: "complete" }), [quote({ status: "pending" })], []), "awaiting_closeout")
  // Complete and paid
  assert.equal(derivePipelineState(job({ status: "complete" }), [quote({ status: "pending" })], [invoice({ status: "paid" })]), "paid")
  // Scheduled with a pending quote (Lyons, Marchionni, Pede Self)
  assert.equal(derivePipelineState(job({ status: "scheduled", appointment_date: "2026-08-28" }), [quote({ status: "pending" })], []), "scheduled")
  // Quoted, waiting
  assert.equal(derivePipelineState(job({ status: "quoted" }), [quote({ status: "pending" })], []), "waiting_on_yes")
  assert.equal(derivePipelineState(job({ status: "quoted" }), [quote({ status: "help" })], []), "waiting_on_yes")
  // Quoted, every quote declined
  assert.equal(derivePipelineState(job({ status: "quoted" }), [quote({ status: "declined" })], []), "lost")
  // Quoted, declined + superseded only
  assert.equal(derivePipelineState(job({ status: "quoted" }), [quote({ status: "declined" }), quote({ status: "superseded" })], []), "lost")
  // New, nothing
  assert.equal(derivePipelineState(job({ status: "new" }), [], []), "needs_quote")
  // Quoted job whose quote was accepted by reconcile but status never moved: won
  assert.equal(derivePipelineState(job({ status: "quoted" }), [quote({ status: "accepted", accepted_via: "reconcile" })], []), "needs_scheduling")
  assert.equal(derivePipelineState(job({ status: "quoted", appointment_date: "2026-09-20" }), [quote({ status: "accepted" })], []), "scheduled")
  // Terminal
  assert.equal(derivePipelineState(job({ status: "cancelled" }), [quote({ status: "pending" })], []), "cancelled")
  assert.equal(derivePipelineState(job({ status: "complete", excluded_at: "2026-09-01T00:00:00Z" }), [], [invoice({ status: "paid" })]), "excluded")
  // completed_at alone means done even if status lagged
  assert.equal(derivePipelineState(job({ status: "scheduled", completed_at: "2026-09-01T00:00:00Z" }), [], []), "awaiting_closeout")
})

/* ---------------- client metrics ---------------- */

test("client metrics resolve money through the job and track last service per service", () => {
  const c = client({ id: "c1", name: "Eric" })
  const j1 = job({ id: "j1", client_id: "c1", status: "complete", completed_at: "2026-03-10T15:00:00Z", service_type: "House Washing, Window Cleaning", price: 500 })
  const j2 = job({ id: "j2", client_id: "c1", status: "complete", appointment_date: "2026-07-31", service_type: "House Washing, Surface Cleaning", price: 360 })
  const j3 = job({ id: "j3", client_id: "c1", status: "quoted", service_type: "Driveway", price: 200 })
  const snap = snapshot({
    clients: [c],
    jobs: [j1, j2, j3],
    quotes: [
      quote({ id: "q1", job_id: "j1", status: "accepted", services: [{ name: "House Washing", price: 300 }, { name: "Window Cleaning", price: 200 }] }),
      quote({ id: "q3", job_id: "j3", status: "pending", services: [{ name: "Driveway", price: 200 }] }),
    ],
    invoices: [
      invoice({ id: "i1", job_id: "j1", client_id: null, quote_id: "q1", status: "paid", paid_at: "2026-03-11T15:00:00Z", amount: 500, tip_amount: 25 }),
      invoice({ id: "i2", job_id: "j2", client_id: null, status: "sent", amount: 360 }),
    ],
  })
  const m = computeClientMetrics(snap).get("c1")!
  assert.equal(m.lifetimeValue, 500)
  assert.equal(m.lifetimeTips, 25)
  assert.equal(m.paidInvoiceCount, 1)
  assert.equal(m.openBalance, 360)
  assert.equal(m.jobCount, 3)
  assert.equal(m.completedJobCount, 2)
  assert.equal(m.awaitingCloseoutCount, 1)
  assert.equal(m.repeat, true)
  assert.equal(m.lastServiceAt, "2026-07-31")
  assert.deepEqual(m.lastServiceByService, { house_wash: "2026-07-31", windows: "2026-03-10", surfaces: "2026-07-31" })
  assert.deepEqual(m.servicesHad, ["house_wash", "windows", "surfaces"])
  assert.deepEqual(m.openQuoteServices, ["driveway"])
  assert.equal(m.careClub, false)
  assert.equal(m.phone10, "7045550100")
})

test("excluded jobs are invisible", () => {
  const c = client({ id: "c1" })
  const snap = snapshot({
    clients: [c],
    jobs: [job({ id: "j1", client_id: "c1", status: "complete", excluded_at: "2026-09-01T00:00:00Z" })],
    invoices: [invoice({ job_id: "j1", status: "paid", paid_at: "2026-08-01T00:00:00Z", amount: 999 })],
  })
  const m = computeClientMetrics(snap).get("c1")!
  assert.equal(m.lifetimeValue, 0)
  assert.equal(m.jobCount, 0)
  assert.equal(jobStates(snap)[0].state, "excluded")
})

/* ---------------- revenue ---------------- */

test("computeRevenue: paid first, tips separate, awaiting flagged, profit net of expenses and crew pay", () => {
  const c1 = client({ id: "c1", name: "Repeat Rita" })
  const c2 = client({ id: "c2", name: "One-time Otto" })
  const c3 = client({ id: "c3", name: "Once Olga" })
  const jobs = [
    job({ id: "j1", client_id: "c1", status: "complete", completed_at: "2026-08-02T15:00:00Z", service_type: "House Washing", price: 400, crew_pay: 80, lead_source: "google" }),
    job({ id: "j2", client_id: "c1", status: "complete", completed_at: "2026-09-01T15:00:00Z", service_type: "House Washing, Window Cleaning", price: 500, crew_pay: 100, lead_source: "repeat" }),
    job({ id: "j3", client_id: "c2", status: "complete", completed_at: "2026-09-03T15:00:00Z", service_type: "Driveway", price: 300 }), // done, never paid
    job({ id: "j4", client_id: "c2", status: "scheduled", appointment_date: "2026-09-01", service_type: "Windows", price: 250 }), // appointment passed
    job({ id: "j5", client_id: "c3", status: "complete", completed_at: "2026-05-03T15:00:00Z", service_type: "Driveway", price: 350 }),
  ]
  const invoices = [
    invoice({ id: "i1", job_id: "j1", status: "paid", paid_at: "2026-08-03T15:00:00Z", amount: 400, payment_method: "stripe" }),
    invoice({ id: "i2", job_id: "j2", status: "paid", paid_at: "2026-09-02T15:00:00Z", amount: 500, tip_amount: 50, payment_method: null }),
    invoice({ id: "i3", job_id: "j3", status: "sent", amount: 300 }),
    invoice({ id: "i5", job_id: "j5", status: "paid", paid_at: "2026-05-04T15:00:00Z", amount: 350, payment_method: "cash" }),
    invoice({ id: "i6", job_id: null, status: "draft", amount: 120 }),
  ]
  const snap = snapshot({
    clients: [c1, c2, c3],
    jobs,
    invoices,
    quotes: [
      quote({ id: "q2", job_id: "j2", status: "accepted", accepted_via: "customer", services: [{ name: "House Washing", price: 300 }, { name: "Window Cleaning", price: 250 }], total_price: 500 }),
      quote({ id: "qx", job_id: null, status: "pending", total_price: 700, created_at: "2026-06-01T12:00:00Z" }), // orphan, stale
    ],
    expenses: [
      { id: "e1", spent_on: "2026-09-05", amount: 75.5, category: "chemicals", job_id: null },
      { id: "e2", spent_on: "2026-07-05", amount: 999, category: "fuel", job_id: null },
    ],
    plans: [{ id: "p1", client_id: "c1", client_name: "Rita", client_phone: null, status: "signed", total_price: 1610, annual_value: 2300, billing: "paid_in_full", monthly_price: null, term_start: null, term_end: null, signed_at: "2026-07-01T00:00:00Z" }],
  })

  const r = computeRevenue(snap, { from: "2026-08-01", to: "2026-09-08" }, { now: NOW })
  assert.equal(r.collected, 900)
  assert.equal(r.tips, 50)
  assert.equal(r.paidCount, 2)
  assert.equal(r.averageJob, 450)
  assert.equal(r.awaitingCloseout.count, 2)
  assert.equal(r.awaitingCloseout.amount, 550)
  assert.deepEqual(r.awaitingCloseout.items.map((i) => i.reason), ["appointment_passed", "complete_unpaid"])
  assert.deepEqual(r.sentUnpaid, { count: 1, amount: 300 })
  assert.deepEqual(r.drafts, { count: 1, amount: 120 })
  // by service: j1 no quote -> house_wash 400; j2 lines 300/250 scaled to 500 -> 272.73 / 227.27
  assert.equal(r.byService.house_wash, 672.73)
  assert.equal(r.byService.windows, 227.27)
  assert.deepEqual(r.byMethod, { stripe: { count: 1, amount: 400 }, unrecorded: { count: 1, amount: 500 } })
  assert.deepEqual(r.byLeadSource, { google: { count: 1, amount: 400 }, repeat: { count: 1, amount: 500 } })
  assert.equal(r.byMonth.length, 13)
  assert.equal(r.byMonth[12].month, "2026-09")
  assert.equal(r.byMonth[12].collected, 500)
  assert.equal(r.byMonth[11].collected, 400)
  assert.equal(r.byMonth[12].awaiting, 300)
  assert.equal(r.expenses.total, 75.5)
  assert.equal(r.crewPay, 180)
  assert.equal(r.profit, 644.5)
  assert.equal(r.margin, 644.5 / 900)
  assert.equal(r.repeatClients, 1) // Rita: two done jobs. Otto has one done (awaiting close-out) + one scheduled.
  assert.equal(r.activeClients, 3)
  assert.equal(r.repeatRate, 1 / 3)
  assert.equal(r.returningShare, 1) // both in-range payments are Rita's
  assert.equal(r.topClients[0].name, "Repeat Rita")
  assert.equal(r.topClients[0].value, 900)
  assert.deepEqual(r.careClub, { plans: 1, contracted: 1610, monthly: 134.17 })
  assert.deepEqual(r.staleQuotes, { count: 1, amount: 700 })
  assert.equal(r.winRate.bookedRate, 1)
})

test("rangeForPreset uses ET days", () => {
  assert.deepEqual(rangeForPreset("this_month", NOW), { from: "2026-09-01", to: "2026-09-08", preset: "this_month" })
  assert.deepEqual(rangeForPreset("last_month", NOW), { from: "2026-08-01", to: "2026-08-31", preset: "last_month" })
  assert.deepEqual(rangeForPreset("ytd", NOW), { from: "2026-01-01", to: "2026-09-08", preset: "ytd" })
  assert.equal(rangeForPreset("last_12_months", NOW).from, "2025-10-01")
  // Jan 1 02:00Z is still Dec 31 in ET
  assert.equal(rangeForPreset("this_month", new Date("2026-01-01T02:00:00Z")).from, "2025-12-01")
})

test("indexSnapshot sorts newest-first and maps phones", () => {
  const snap = snapshot({
    clients: [client({ id: "c1", phone: "704-555-0100" })],
    jobs: [job({ id: "j1", client_id: "c1", created_at: "2026-01-01T00:00:00Z" }), job({ id: "j2", client_id: "c1", created_at: "2026-02-01T00:00:00Z" })],
  })
  const idx = indexSnapshot(snap)
  assert.equal(idx.jobsByClient.get("c1")![0].id, "j2")
  assert.equal(idx.clientIdByPhone10.get("7045550100"), "c1")
})
