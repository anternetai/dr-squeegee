import { test } from "node:test"
import assert from "node:assert/strict"
import { buildPitchHistory, catalogPricesByService, computeOffers, makeOfferContext, nextDue } from "./offers.ts"
import { DEFAULT_CADENCE_MONTHS } from "./cadence.ts"
import type { ClientMetrics, CrmSnapshot } from "./metrics.ts"

const TODAY = "2026-09-08"
const NOW = new Date("2026-09-08T16:00:00Z") // September

function metrics(over: Partial<ClientMetrics> = {}): ClientMetrics {
  return {
    clientId: "c1",
    name: "Client",
    phone: "(704) 555-0100",
    phone10: "7045550100",
    email: null,
    address: null,
    blacklisted: false,
    smsConsent: true,
    tags: [],
    leadSource: null,
    clientSince: "2025-01-01T00:00:00Z",
    lifetimeValue: 0,
    lifetimeTips: 0,
    paidInvoiceCount: 0,
    lastPaidAt: null,
    openBalance: 0,
    openInvoiceCount: 0,
    draftBalance: 0,
    jobCount: 1,
    completedJobCount: 1,
    awaitingCloseoutCount: 0,
    firstJobAt: "2025-08-01T00:00:00Z",
    lastJobAt: "2025-08-01T00:00:00Z",
    lastServiceAt: "2025-08-01",
    lastServiceByService: { house_wash: "2025-08-01" },
    servicesHad: ["house_wash"],
    openQuoteServices: [],
    careClub: false,
    planStatus: null,
    repeat: false,
    ...over,
  }
}

const ctx = () => makeOfferContext(DEFAULT_CADENCE_MONTHS, new Map(), NOW)

test("a 13-month-old house wash is due, a 10-month-old one is not", () => {
  const due = computeOffers(metrics(), ctx()).filter((o) => o.kind === "due")
  assert.equal(due.length, 1)
  assert.equal(due[0].service, "house_wash")
  assert.equal(due[0].dueOn, "2026-08-01")
  assert.equal(due[0].overdueDays, 38)
  assert.match(due[0].reason, /overdue/)

  const notYet = computeOffers(metrics({ lastServiceByService: { house_wash: "2025-11-01" }, lastJobAt: "2025-11-01T00:00:00Z" }), ctx())
  assert.equal(notYet.filter((o) => o.kind === "due").length, 0)
  // Due within the 30-day lookahead shows as "due soon"
  const soon = computeOffers(metrics({ lastServiceByService: { house_wash: "2025-09-20" }, lastJobAt: "2025-09-20T00:00:00Z" }), ctx()).filter((o) => o.kind === "due")
  assert.equal(soon.length, 1)
  assert.match(soon[0].label, /due soon/)
})

test("nextDue picks the most overdue service", () => {
  const m = metrics({ lastServiceByService: { house_wash: "2025-08-01", windows: "2025-12-01" }, servicesHad: ["house_wash", "windows"] })
  const d = nextDue(m, DEFAULT_CADENCE_MONTHS, TODAY)!
  assert.equal(d.service, "windows") // 6-month cadence -> due 2026-06-01, 99 days overdue
  assert.equal(d.overdueDays, 99)
})

test("never-had cross-sells exclude what they have and rank house wash first", () => {
  const offers = computeOffers(metrics({ servicesHad: ["windows"], lastServiceByService: { windows: "2026-01-15" } }), ctx())
  const never = offers.filter((o) => o.kind === "never_had").map((o) => o.service)
  assert.deepEqual(never, ["house_wash", "gutters", "driveway", "surfaces", "roof"])
  assert.equal(offers.find((o) => o.kind === "never_had")!.suggestedPrice, catalogPricesByService().house_wash)
})

test("two completed jobs earn a Care Club pitch; members never see it", () => {
  const two = computeOffers(metrics({ completedJobCount: 2, servicesHad: ["house_wash", "windows"], lastServiceByService: { house_wash: "2026-07-31", windows: "2026-07-31" }, lastJobAt: "2026-07-31T00:00:00Z" }), ctx())
  const plan = two.find((o) => o.kind === "plan")!
  assert.ok(plan)
  assert.equal(plan.suggestedPrice, Math.round((400 + 250) * 0.7))
  assert.equal(computeOffers(metrics({ completedJobCount: 2, careClub: true }), ctx()).some((o) => o.kind === "plan"), false)
  assert.equal(computeOffers(metrics({ completedJobCount: 1 }), ctx()).some((o) => o.kind === "plan"), false)
})

test("seasonal only in season, only for services they've had, and not right after a job", () => {
  const march = makeOfferContext(DEFAULT_CADENCE_MONTHS, new Map(), new Date("2026-03-15T16:00:00Z"))
  const m = metrics({ lastServiceByService: { house_wash: "2025-10-01" }, lastJobAt: "2025-10-01T00:00:00Z" })
  const inSeason = computeOffers(m, march)
  assert.equal(inSeason.some((o) => o.kind === "seasonal" && o.service === "house_wash"), true)
  const july = makeOfferContext(DEFAULT_CADENCE_MONTHS, new Map(), new Date("2026-07-15T16:00:00Z"))
  assert.equal(computeOffers(m, july).some((o) => o.kind === "seasonal"), false)
  // Gutters in October for a client who has had gutters, but a due offer already lists it -> no duplicate
  const oct = makeOfferContext(DEFAULT_CADENCE_MONTHS, new Map(), new Date("2026-10-15T16:00:00Z"))
  const g = computeOffers(metrics({ servicesHad: ["gutters"], lastServiceByService: { gutters: "2026-01-01" } }), oct)
  assert.equal(g.filter((o) => o.service === "gutters").length, 1)
  assert.equal(g.find((o) => o.service === "gutters")!.kind, "due")
})

test("suppression rules", () => {
  assert.deepEqual(computeOffers(metrics({ blacklisted: true }), ctx()), [])
  assert.deepEqual(computeOffers(metrics({ tags: ["do-not-upsell"] }), ctx()), [])
  // open quote for the service
  const openQ = computeOffers(metrics({ openQuoteServices: ["house_wash"] }), ctx())
  assert.equal(openQ.some((o) => o.service === "house_wash"), false)
  // pitched 30 days ago
  const pitched = makeOfferContext(DEFAULT_CADENCE_MONTHS, new Map([["house_wash", "2026-08-10"]]), NOW)
  assert.equal(computeOffers(metrics(), pitched).some((o) => o.service === "house_wash"), false)
  // pitched 100 days ago is fine again
  const old = makeOfferContext(DEFAULT_CADENCE_MONTHS, new Map([["house_wash", "2026-05-01"]]), NOW)
  assert.equal(computeOffers(metrics(), old).some((o) => o.service === "house_wash"), true)
  // a job in the last 30 days silences due/seasonal but keeps never-had
  const recent = computeOffers(metrics({ lastJobAt: "2026-09-01T00:00:00Z" }), ctx())
  assert.equal(recent.some((o) => o.kind === "due"), false)
  assert.equal(recent.some((o) => o.kind === "never_had"), true)
})

test("offers are ranked: overdue due first, then plan, then cross-sells, then seasonal", () => {
  const march = makeOfferContext(DEFAULT_CADENCE_MONTHS, new Map(), new Date("2026-03-15T16:00:00Z"))
  const m = metrics({
    completedJobCount: 2,
    servicesHad: ["house_wash", "surfaces"],
    lastServiceByService: { house_wash: "2025-01-01", surfaces: "2025-10-01" },
    lastJobAt: "2025-10-01T00:00:00Z",
  })
  const kinds = computeOffers(m, march).map((o) => o.kind)
  assert.equal(kinds[0], "due")
  assert.ok(kinds.indexOf("plan") < kinds.indexOf("never_had"))
  assert.equal(kinds[kinds.length - 1], "seasonal")
})

test("buildPitchHistory reads the outreach log and outbound texts", () => {
  const snap: CrmSnapshot = {
    clients: [{ id: "c1", name: "A", phone: "(704) 555-0100", email: null, address: null, notes: null, blacklisted: false, sms_consent: true, tags: [], lead_source: null, created_at: "2026-01-01T00:00:00Z" }],
    jobs: [],
    quotes: [],
    invoices: [],
    plans: [],
    expenses: [],
    outreach: [
      { phone10: "7045550100", channel: "sms", service_offered: "Window Cleaning", created_at: "2026-08-01T15:00:00Z", client_name: "A" },
      { phone10: "7045550100", channel: "note", service_offered: "Care Club plan", created_at: "2026-07-01T15:00:00Z", client_name: "A" },
    ],
    sms: [
      { kind: "rebook_house_wash", phone10: "7045550100", related_type: "client", related_id: "c1", status: "sent", created_at: "2026-08-20T15:00:00Z" },
      { kind: "rebook_gutters", phone10: "7045550100", related_type: "client", related_id: "c1", status: "blocked", created_at: "2026-08-21T15:00:00Z" },
      { kind: "review", phone10: "7045550100", related_type: "job", related_id: "j1", status: "sent", created_at: "2026-08-22T15:00:00Z" },
    ],
    loadedAt: "2026-09-08T00:00:00Z",
  }
  const h = buildPitchHistory(snap).get("c1")!
  assert.equal(h.get("windows"), "2026-08-01")
  assert.equal(h.get("plan"), "2026-07-01")
  assert.equal(h.get("house_wash"), "2026-08-20")
  assert.equal(h.get("gutters"), undefined)
})
