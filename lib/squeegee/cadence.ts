// Service cadences: how many months after a service a customer is "due" again.
// Industry defaults (Anthony's pick, 2026-09-08): house wash yearly, windows and
// gutters twice a year, flat surfaces yearly, roof every two years. Every number
// is overridable from /crm/settings (squeegee_settings key "cadence_months").
//
// Seasonal months are the calendar months a service is worth pushing even when
// the cadence says "not yet": gutters after the leaves drop, house wash and
// surfaces with spring pollen, windows before the holidays, pool deck before
// pool season. These mirror recommendMonth() in plans.ts for the Care Club.

import { SERVICES, type Service } from "./services.ts"

export type CadenceMonths = Record<Service, number | null>

export const DEFAULT_CADENCE_MONTHS: CadenceMonths = {
  house_wash: 12,
  windows: 6,
  gutters: 6,
  driveway: 12,
  surfaces: 12,
  pavers: 12,
  pool_deck: 12,
  roof: 24,
  other: null,
}

/** Calendar months (1-12) in which each service gets a seasonal push. */
export const SEASONAL_MONTHS: Record<Service, number[]> = {
  gutters: [10, 11],
  house_wash: [3, 4],
  surfaces: [3, 4],
  driveway: [3, 4],
  pavers: [3, 4],
  pool_deck: [4, 5],
  windows: [11, 12],
  roof: [4, 10],
  other: [],
}

export const SEASONAL_REASON: Record<Service, string> = {
  gutters: "Leaves are down - gutters fill up now",
  house_wash: "Spring pollen and winter grime - house wash season",
  surfaces: "Warm, dry weather gives concrete the best results",
  driveway: "Warm, dry weather gives concrete the best results",
  pavers: "Warm, dry weather gives pavers the best results",
  pool_deck: "A clean deck right before pool season",
  windows: "Streak-free windows before the holidays",
  roof: "Mild weather is ideal for soft-washing a roof",
  other: "",
}

const MIN_MONTHS = 1
const MAX_MONTHS = 60

/**
 * Merge a stored override (any shape; came from a jsonb column) onto the
 * defaults. Invalid entries are ignored rather than thrown: a bad settings row
 * must never take the CRM down.
 */
export function mergeCadence(override: unknown): CadenceMonths {
  const out: CadenceMonths = { ...DEFAULT_CADENCE_MONTHS }
  if (!override || typeof override !== "object") return out
  for (const service of SERVICES) {
    const raw = (override as Record<string, unknown>)[service]
    if (raw === null) {
      out[service] = null
      continue
    }
    const n = typeof raw === "string" ? Number(raw) : raw
    if (typeof n === "number" && Number.isFinite(n) && n >= MIN_MONTHS && n <= MAX_MONTHS) {
      out[service] = Math.round(n)
    }
  }
  return out
}

export function isSeasonalMonth(service: Service, monthNumber: number): boolean {
  return SEASONAL_MONTHS[service].includes(monthNumber)
}
