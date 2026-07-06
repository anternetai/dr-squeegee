// Care Club Pitch Tool — cadence tiers, member-rate suggestions, and
// per-service price history from a customer's actual jobs.
// All suggestions are starting points; every number is editable per deal.

import { PLAN_SERVICE_CATALOG } from "@/lib/squeegee/plans"

export interface Cadence {
  label: string
  short: string
  visitsPerYear: number
  suggestedDiscountPct: number
  group: "residential" | "storefront"
}

export const CADENCES: Cadence[] = [
  { label: "Twice a year", short: "2×/yr", visitsPerYear: 2, suggestedDiscountPct: 10, group: "residential" },
  { label: "3 times a year", short: "3×/yr", visitsPerYear: 3, suggestedDiscountPct: 15, group: "residential" },
  { label: "Quarterly", short: "4×/yr", visitsPerYear: 4, suggestedDiscountPct: 20, group: "residential" },
  { label: "Every other month", short: "6×/yr", visitsPerYear: 6, suggestedDiscountPct: 25, group: "residential" },
  { label: "Monthly", short: "12×/yr", visitsPerYear: 12, suggestedDiscountPct: 30, group: "residential" },
  { label: "Every 3 weeks", short: "17×/yr", visitsPerYear: 17, suggestedDiscountPct: 35, group: "storefront" },
  { label: "Bi-weekly", short: "26×/yr", visitsPerYear: 26, suggestedDiscountPct: 35, group: "storefront" },
  { label: "Weekly", short: "52×/yr", visitsPerYear: 52, suggestedDiscountPct: 40, group: "storefront" },
]

// Member per-visit rate: one-time price minus the cadence tier, to the nearest $5.
export function suggestMemberRate(oneTimePrice: number, discountPct: number): number {
  if (!oneTimePrice || oneTimePrice <= 0) return 0
  const raw = oneTimePrice * (1 - discountPct / 100)
  return Math.max(5, Math.round(raw / 5) * 5)
}

// Map a job's service_type text onto a catalog service family.
const FAMILY_KEYWORDS: { family: string; keywords: string[] }[] = [
  { family: "Window Cleaning", keywords: ["window"] },
  { family: "Roof Wash + Gutter Clean", keywords: ["roof", "gutter"] },
  { family: "House Washing", keywords: ["house", "siding", "soft wash", "softwash"] },
  { family: "Driveway / Courtyard Pressure Wash", keywords: ["driveway", "courtyard", "concrete"] },
  { family: "Surface Cleaning", keywords: ["surface", "walkway", "patio", "sidewalk"] },
  { family: "Pool Deck", keywords: ["pool"] },
]

export function serviceFamilyOf(serviceType: string | null | undefined): string | null {
  const t = (serviceType || "").toLowerCase()
  if (!t) return null
  for (const f of FAMILY_KEYWORDS) {
    if (f.keywords.some((k) => t.includes(k))) return f.family
  }
  return null
}

export interface HistoryJob {
  service_type: string | null
  price: number | null
  appointment_date: string | null
  created_at: string
}

export interface ServiceHistoryEntry {
  family: string
  lastPrice: number
  lastDate: string | null
}

// Latest price we actually charged this customer, per service family.
// Jobs must be passed newest-first.
export function servicePriceHistory(jobs: HistoryJob[]): Map<string, ServiceHistoryEntry> {
  const out = new Map<string, ServiceHistoryEntry>()
  for (const j of jobs) {
    const family = serviceFamilyOf(j.service_type)
    const price = Number(j.price) || 0
    if (!family || price <= 0 || out.has(family)) continue
    out.set(family, {
      family,
      lastPrice: price,
      lastDate: j.appointment_date || j.created_at?.slice(0, 10) || null,
    })
  }
  return out
}

// Catalog default per-visit price for a service family.
export function catalogPriceOf(family: string): number {
  return PLAN_SERVICE_CATALOG.find((s) => s.name === family)?.price_per_visit ?? 250
}
