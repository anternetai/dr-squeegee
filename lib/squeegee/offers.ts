// The offer engine: what to offer a client, ranked.
//
// Four signals (Anthony's pick, 2026-09-08):
//   due        - a service they've had is due again by cadence (or within 30 days)
//   never_had  - a service they've never bought, ordered by how naturally it
//                follows what they have
//   plan       - two or more jobs with us -> pitch the Care Club
//   seasonal   - a service they've had is in its season this month
//
// Suppression: blacklisted, "do-not-upsell", or no completed job yet -> nothing
// (a client who never bought is a lead for the quote follow-ups). A service with an open
// quote, or pitched in the last 90 days, is skipped. A job in the last 30 days
// suppresses due/seasonal nags (never-had and plan still show: right after a
// job is the best time for those).
//
// Nothing in mainstream CRMs computes this; it is the differentiated piece.

import { SERVICE_LABELS, SERVICE_NOUNS, normalizeService, type Service } from "./services.ts"
import { addMonthsYmd, daysBetweenET, monthsBetweenET, monthNumberET, todayET, dateKeyET } from "./dates.ts"
import { isSeasonalMonth, SEASONAL_REASON, type CadenceMonths } from "./cadence.ts"
import { DEFAULT_PIF_DISCOUNT, PLAN_SERVICE_CATALOG } from "./plans.ts"
import { hasTag } from "./tags.ts"
import { phone10Of, type ClientMetrics, type CrmSnapshot } from "./metrics.ts"

export type OfferKind = "due" | "never_had" | "plan" | "seasonal"
export type PitchKey = Service | "plan"

export interface Offer {
  kind: OfferKind
  service: Service | null
  label: string
  reason: string
  dueOn: string | null
  overdueDays: number | null
  suggestedPrice: number | null
  priority: number
}

export interface OfferContext {
  today: string
  monthNumber: number
  cadence: CadenceMonths
  /** Last time each service (or the plan) was pitched to this client, YYYY-MM-DD. */
  pitched: Map<PitchKey, string>
  catalogPrices: Partial<Record<Service, number>>
}

export const CROSS_SELL_ORDER: Service[] = ["house_wash", "windows", "gutters", "driveway", "surfaces", "roof"]
export const DUE_LOOKAHEAD_DAYS = 30
export const PITCH_COOLDOWN_DAYS = 90
export const RECENT_JOB_DAYS = 30
export const SEASONAL_MIN_MONTHS_SINCE = 3
export const PLAN_MIN_JOBS = 2

/** Default price per service from the Care Club catalog (price_per_visit). */
export function catalogPricesByService(): Partial<Record<Service, number>> {
  const out: Partial<Record<Service, number>> = {}
  for (const item of PLAN_SERVICE_CATALOG) {
    const svc = normalizeService(item.name)
    if (svc && out[svc] === undefined) out[svc] = item.price_per_visit
  }
  return out
}

export function makeOfferContext(
  cadence: CadenceMonths,
  pitched: Map<PitchKey, string> = new Map(),
  now: Date = new Date()
): OfferContext {
  return {
    today: todayET(now),
    monthNumber: monthNumberET(now),
    cadence,
    pitched,
    catalogPrices: catalogPricesByService(),
  }
}

export interface DueItem {
  service: Service
  lastOn: string
  dueOn: string
  overdueDays: number
}

/** Every service the client has had, with its cadence-derived due date. */
export function dueItems(m: ClientMetrics, cadence: CadenceMonths, today: string): DueItem[] {
  const out: DueItem[] = []
  for (const service of m.servicesHad) {
    const months = cadence[service]
    const lastOn = m.lastServiceByService[service]
    if (!months || !lastOn) continue
    const dueOn = addMonthsYmd(lastOn, months)
    out.push({ service, lastOn, dueOn, overdueDays: daysBetweenET(dueOn, today) })
  }
  return out.sort((a, b) => b.overdueDays - a.overdueDays)
}

/** The single soonest due service for list rows, or null. */
export function nextDue(m: ClientMetrics, cadence: CadenceMonths, today: string): DueItem | null {
  return dueItems(m, cadence, today)[0] ?? null
}

function pitchedRecently(ctx: OfferContext, key: PitchKey): boolean {
  const last = ctx.pitched.get(key)
  return !!last && daysBetweenET(last, ctx.today) < PITCH_COOLDOWN_DAYS
}

function recentJob(m: ClientMetrics, today: string): boolean {
  return !!m.lastJobAt && daysBetweenET(m.lastJobAt, today) < RECENT_JOB_DAYS
}

export function computeOffers(m: ClientMetrics, ctx: OfferContext): Offer[] {
  if (m.blacklisted || hasTag(m.tags, "do-not-upsell")) return []
  // Offers are for customers. A client who has never bought anything is a
  // lead: they belong to the quote follow-up flow, not the offer list. Without
  // this line 33 of 69 clients would each show "never had a house wash".
  if (m.completedJobCount < 1) return []
  const offers: Offer[] = []
  const openQuote = new Set(m.openQuoteServices)
  const quietForNags = recentJob(m, ctx.today)
  const listed = new Set<Service>()

  // due
  for (const d of dueItems(m, ctx.cadence, ctx.today)) {
    if (d.overdueDays < -DUE_LOOKAHEAD_DAYS) continue
    if (openQuote.has(d.service) || pitchedRecently(ctx, d.service) || quietForNags) continue
    const overdue = d.overdueDays >= 0
    const noun = SERVICE_NOUNS[d.service]
    offers.push({
      kind: "due",
      service: d.service,
      label: `${SERVICE_LABELS[d.service]} ${overdue ? "due" : "due soon"}`,
      reason: overdue
        ? `Last ${noun} ${monthsBetweenET(d.lastOn, ctx.today)} months ago - ${describeOverdue(d.overdueDays)}`
        : `Last ${noun} ${monthsBetweenET(d.lastOn, ctx.today)} months ago - due in ${-d.overdueDays} days`,
      dueOn: d.dueOn,
      overdueDays: d.overdueDays,
      suggestedPrice: ctx.catalogPrices[d.service] ?? null,
      priority: overdue ? 100 + (Math.min(d.overdueDays, 365) / 365) * 50 : 60 + ((DUE_LOOKAHEAD_DAYS + d.overdueDays) / DUE_LOOKAHEAD_DAYS) * 20,
    })
    listed.add(d.service)
  }

  // plan
  if (!m.careClub && m.completedJobCount >= PLAN_MIN_JOBS && !pitchedRecently(ctx, "plan")) {
    const annual = m.servicesHad.reduce((s, svc) => s + (ctx.catalogPrices[svc] ?? 0), 0)
    offers.push({
      kind: "plan",
      service: null,
      label: "Pitch the Care Club",
      reason: `${m.completedJobCount} jobs with us - a plan locks the schedule and saves ${DEFAULT_PIF_DISCOUNT}% paid in full`,
      dueOn: null,
      overdueDays: null,
      suggestedPrice: annual > 0 ? Math.round(annual * (1 - DEFAULT_PIF_DISCOUNT / 100)) : null,
      priority: 55,
    })
  }

  // never had
  const had = new Set(m.servicesHad)
  for (const svc of CROSS_SELL_ORDER) {
    if (had.has(svc) || openQuote.has(svc) || pitchedRecently(ctx, svc)) continue
    const price = ctx.catalogPrices[svc] ?? null
    offers.push({
      kind: "never_had",
      service: svc,
      label: `Never had ${SERVICE_NOUNS[svc] === "windows" ? "windows done" : `a ${SERVICE_NOUNS[svc]}`}`,
      reason: crossSellReason(svc, m),
      dueOn: null,
      overdueDays: null,
      suggestedPrice: price,
      // Order is the natural upsell path; price only breaks ties inside it.
      priority: 40 - CROSS_SELL_ORDER.indexOf(svc) + (price ?? 0) / 10000,
    })
  }

  // seasonal
  if (!quietForNags) {
    for (const svc of m.servicesHad) {
      if (listed.has(svc) || !isSeasonalMonth(svc, ctx.monthNumber)) continue
      if (openQuote.has(svc) || pitchedRecently(ctx, svc)) continue
      const lastOn = m.lastServiceByService[svc]
      if (lastOn && monthsBetweenET(lastOn, ctx.today) < SEASONAL_MIN_MONTHS_SINCE) continue
      offers.push({
        kind: "seasonal",
        service: svc,
        label: `${SERVICE_LABELS[svc]} season`,
        reason: SEASONAL_REASON[svc],
        dueOn: null,
        overdueDays: null,
        suggestedPrice: ctx.catalogPrices[svc] ?? null,
        priority: 30,
      })
    }
  }

  return offers.sort((a, b) => b.priority - a.priority)
}

function describeOverdue(days: number): string {
  if (days < 7) return "due now"
  if (days < 60) return `${Math.round(days / 7)} weeks overdue`
  return `${Math.round(days / 30)} months overdue`
}

function crossSellReason(svc: Service, m: ClientMetrics): string {
  const has = (s: Service) => m.servicesHad.includes(s)
  switch (svc) {
    case "windows":
      return has("house_wash") ? "Clean siding shows dirty glass - windows finish the house" : "Streak-free glass, inside and out"
    case "house_wash":
      return has("driveway") || has("surfaces") ? "Clean concrete makes the siding look worse - the house is next" : "Soft wash for siding, eaves and trim"
    case "gutters":
      return has("house_wash") || has("roof") ? "Same ladder, same visit - gutters while we're up there" : "Clean gutters protect the roof and the foundation"
    case "driveway":
      return has("house_wash") ? "The driveway is the first thing they see - match the clean house" : "Per-square-foot pressure wash"
    case "surfaces":
      return "Patio, walkway and porch while the equipment is out"
    case "roof":
      return "Black streaks are algae - a soft wash adds years to the roof"
    default:
      return SERVICE_LABELS[svc]
  }
}

/* ----------------------------------------------------------------------------
   Pitch history: what has already been offered to whom, and when
---------------------------------------------------------------------------- */

const SMS_PITCH_KIND = /^(rebook|offer)_([a-z_]+)$/

/** clientId -> (service | "plan") -> last pitch YYYY-MM-DD, from the outreach log and outbound texts. */
export function buildPitchHistory(snap: CrmSnapshot): Map<string, Map<PitchKey, string>> {
  const out = new Map<string, Map<PitchKey, string>>()
  const byPhone = new Map<string, string>()
  for (const c of snap.clients) {
    const p = phone10Of(c.phone)
    if (p && !byPhone.has(p)) byPhone.set(p, c.id)
  }
  const note = (clientId: string, key: PitchKey, when: string) => {
    const day = dateKeyET(when)
    let m = out.get(clientId)
    if (!m) {
      m = new Map()
      out.set(clientId, m)
    }
    const prev = m.get(key)
    if (!prev || day > prev) m.set(key, day)
  }

  for (const o of snap.outreach) {
    const cid = byPhone.get(o.phone10)
    if (!cid || !o.service_offered) continue
    const raw = o.service_offered.toLowerCase()
    const key: PitchKey | null = /plan|club|member/.test(raw) ? "plan" : normalizeService(o.service_offered)
    if (key && key !== "other") note(cid, key, o.created_at)
  }

  for (const s of snap.sms) {
    if (s.status === "blocked" || s.status === "failed") continue
    const cid = (s.related_type === "client" && s.related_id) || byPhone.get(s.phone10)
    if (!cid) continue
    if (s.kind === "plan_pitch") {
      note(cid, "plan", s.created_at)
      continue
    }
    const m = s.kind ? SMS_PITCH_KIND.exec(s.kind) : null
    if (!m) continue
    const svc = normalizeService(m[2].replace(/_/g, " ")) ?? (m[2] as Service)
    note(cid, svc, s.created_at)
  }
  return out
}

/** Convenience: every client's offers, keyed by client id. */
export function computeAllOffers(
  metrics: Map<string, ClientMetrics>,
  snap: CrmSnapshot,
  cadence: CadenceMonths,
  now: Date = new Date()
): Map<string, Offer[]> {
  const history = buildPitchHistory(snap)
  const out = new Map<string, Offer[]>()
  for (const [id, m] of metrics) {
    out.set(id, computeOffers(m, makeOfferContext(cadence, history.get(id), now)))
  }
  return out
}
