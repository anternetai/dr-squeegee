// Dr. Squeegee — Annual Exterior Care Plans
// Shared types, service catalog, pricing math, and schedule generation.

export interface PlanService {
  name: string
  description: string
  visits_per_year: number
  price_per_visit: number
}

export type PlanBilling = "paid_in_full" | "monthly"
export type PlanStatus = "draft" | "sent" | "signed" | "active" | "cancelled"
export type VisitStatus = "scheduled" | "reschedule_requested" | "completed" | "skipped"

export interface SqueegeePlan {
  id: string
  created_at: string
  token: string
  portal_token: string
  client_id: string | null
  client_name: string
  client_phone: string | null
  client_email: string | null
  address: string
  plan_name: string
  services: PlanService[]
  annual_value: number
  billing: PlanBilling
  discount_percent: number
  total_price: number
  monthly_price: number | null
  status: PlanStatus
  term_start: string | null
  term_end: string | null
  signed_at: string | null
  signed_name: string | null
  signature_type: "drawn" | "typed" | null
  signature_data: string | null
  signed_ip: string | null
  notes: string | null
  onboarded_at: string | null
  schedule_prefs: SchedulePick[] | null
}

// A customer's month choices from portal onboarding.
// months are "YYYY-MM" strings; count matches the service's visits_per_year.
export interface SchedulePick {
  service_name: string
  months: string[]
}

export interface PlanVisit {
  id: string
  created_at: string
  plan_id: string
  service_name: string
  seq: number
  scheduled_date: string | null
  status: VisitStatus
  reschedule_requested_date: string | null
  reschedule_note: string | null
  job_id: string | null
  notes: string | null
}

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  signed: "Signed",
  active: "Active",
  cancelled: "Cancelled",
}

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  scheduled: "Scheduled",
  reschedule_requested: "Reschedule Requested",
  completed: "Completed",
  skipped: "Skipped",
}

// Default catalog for the plan builder — prices are starting points, editable per house.
export const PLAN_SERVICE_CATALOG: PlanService[] = [
  {
    name: "Window Cleaning",
    description: "Streak-free cleaning of exterior windows, frames, and sills.",
    visits_per_year: 4,
    price_per_visit: 250,
  },
  {
    name: "Roof Wash + Gutter Clean",
    description: "Soft wash roof treatment to remove algae streaks, plus full gutter clean-out.",
    visits_per_year: 1,
    price_per_visit: 550,
  },
  {
    name: "House Washing",
    description: "Soft wash of all exterior siding, eaves, and trim to remove dirt, mildew, and algae.",
    visits_per_year: 1,
    price_per_visit: 400,
  },
  {
    name: "Driveway / Courtyard Pressure Wash",
    description: "Full pressure wash of driveway and courtyard surfaces to remove stains and buildup.",
    visits_per_year: 1,
    price_per_visit: 350,
  },
  {
    name: "Surface Cleaning",
    description: "High-pressure cleaning of concrete, brick, or stone walkways and patios.",
    visits_per_year: 1,
    price_per_visit: 250,
  },
  {
    name: "Pool Deck",
    description: "Pressure wash and surface treatment of pool deck for a clean, slip-safe finish.",
    visits_per_year: 1,
    price_per_visit: 300,
  },
]

export const DEFAULT_PIF_DISCOUNT = 30

export interface PlanPricing {
  annualValue: number
  pifTotal: number
  monthlyPrice: number
}

export function computePlanPricing(
  services: PlanService[],
  discountPercent: number = DEFAULT_PIF_DISCOUNT
): PlanPricing {
  const annualValue = services.reduce(
    (sum, s) => sum + Number(s.visits_per_year) * Number(s.price_per_visit),
    0
  )
  const pifTotal = Math.round(annualValue * (1 - discountPercent / 100) * 100) / 100
  const monthlyPrice = Math.round((annualValue / 12) * 100) / 100
  return { annualValue, pifTotal, monthlyPrice }
}

export function totalVisits(services: PlanService[]): number {
  return services.reduce((sum, s) => sum + Number(s.visits_per_year), 0)
}

// True when any service runs more often than monthly (storefront routes) —
// those plans skip customer month-picking and auto-schedule by day spacing.
export function isHighFrequencyPlan(services: PlanService[]): boolean {
  return services.some((s) => Number(s.visits_per_year) > 12)
}

// Spread a plan's visits across a 12-month term. Recurring services are evenly
// spaced (quarterly for 4x, etc.); one-off services fill the gaps between them.
// Services above 12×/year are day-spaced (365/n) instead of month-slotted.
// All dates are editable in the CRM afterward.
export function generateVisitSchedule(
  services: PlanService[],
  termStart: Date
): { service_name: string; seq: number; scheduled_date: string }[] {
  const visits: { service_name: string; seq: number; scheduled_date: string }[] = []

  const highFreq = services.filter((s) => s.visits_per_year > 12)
  const recurring = services.filter((s) => s.visits_per_year > 1 && s.visits_per_year <= 12)
  const oneOffs = services.filter((s) => s.visits_per_year === 1)

  for (const s of highFreq) {
    const stepDays = Math.max(1, Math.floor(365 / s.visits_per_year))
    // First route visit ~a week out; then every stepDays.
    for (let i = 0; i < s.visits_per_year; i++) {
      const d = new Date(termStart.getTime() + (7 + i * stepDays) * 864e5)
      visits.push({
        service_name: s.name,
        seq: i + 1,
        scheduled_date: d.toISOString().slice(0, 10),
      })
    }
  }

  const usedMonths = new Set<number>()

  for (const s of recurring) {
    const interval = 12 / s.visits_per_year
    for (let i = 0; i < s.visits_per_year; i++) {
      const monthOffset = Math.round(i * interval)
      usedMonths.add(monthOffset)
      visits.push({
        service_name: s.name,
        seq: i + 1,
        scheduled_date: addMonthsISO(termStart, monthOffset),
      })
    }
  }

  // Slot one-offs into months not taken by recurring visits, spaced out.
  let candidate = 1
  for (const s of oneOffs) {
    while (usedMonths.has(candidate) && candidate < 12) candidate++
    const monthOffset = Math.min(candidate, 11)
    usedMonths.add(monthOffset)
    visits.push({
      service_name: s.name,
      seq: 1,
      scheduled_date: addMonthsISO(termStart, monthOffset),
    })
    candidate += 2
  }

  visits.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
  return visits
}

function addMonthsISO(start: Date, months: number): string {
  const d = new Date(start.getFullYear(), start.getMonth() + months, start.getDate())
  // Clamp overflow (e.g., Jan 31 + 1mo) back into the target month
  if (d.getMonth() !== (start.getMonth() + months) % 12) d.setDate(0)
  return d.toISOString().slice(0, 10)
}

// ---- Onboarding: month picking + recommendations ----

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const

export function monthKeyLabel(key: string): string {
  const m = Number(key.slice(5, 7)) - 1
  return `${MONTH_LABELS[m]} ${key.slice(0, 4)}`
}

// 12 schedulable months ("YYYY-MM"), starting with the month the plan begins.
export function termMonthKeys(start: Date): string[] {
  const keys: string[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  return keys
}

// Evenly-spaced rotation options for a recurring service (e.g. quarterly windows).
// Offsets start next month so the first visit never lands in a rush.
export function rotationOptions(termKeys: string[], visitsPerYear: number): string[][] {
  // Month-picking caps at monthly; >12×/yr plans auto-schedule by day spacing.
  const n = Math.min(visitsPerYear, 12)
  const interval = Math.max(1, Math.floor(12 / n))
  if (interval <= 1) return [termKeys.slice(0, n)]
  const options: string[][] = []
  for (let offset = 1; offset <= Math.min(3, interval); offset++) {
    const months: string[] = []
    for (let i = 0; i < n; i++) {
      months.push(termKeys[(offset + i * interval) % 12])
    }
    options.push(months)
  }
  return options
}

// Best month for a one-off service, with the "why" — shown during onboarding.
export function recommendMonth(
  serviceName: string,
  termKeys: string[],
  usedKeys: string[] = []
): { month: string; reason: string } {
  const name = serviceName.toLowerCase()

  function keyForCalendarMonth(target: number): string {
    return termKeys.find((k) => Number(k.slice(5, 7)) - 1 === target) ?? termKeys[2]
  }
  function avoidCollision(key: string): string {
    if (!usedKeys.includes(key)) return key
    const idx = termKeys.indexOf(key)
    for (let step = 1; step < 12; step++) {
      const next = termKeys[(idx + step) % 12]
      if (!usedKeys.includes(next)) return next
    }
    return key
  }

  let pick: { month: string; reason: string }
  if (name.includes("gutter")) {
    pick = { month: keyForCalendarMonth(10), reason: "After the leaves drop — the perfect gutter reset" }
  } else if (name.includes("roof")) {
    const apr = keyForCalendarMonth(3)
    const oct = keyForCalendarMonth(9)
    pick = {
      month: termKeys.indexOf(apr) <= termKeys.indexOf(oct) ? apr : oct,
      reason: "Mild weather is ideal for soft-washing your roof",
    }
  } else if (name.includes("house")) {
    pick = { month: keyForCalendarMonth(3), reason: "Spring refresh — washes away winter grime and pollen" }
  } else if (name.includes("pool")) {
    pick = { month: keyForCalendarMonth(4), reason: "A clean deck right before pool season" }
  } else if (
    name.includes("driveway") || name.includes("surface") ||
    name.includes("paver") || name.includes("courtyard")
  ) {
    pick = { month: keyForCalendarMonth(5), reason: "Warm, dry weather gives concrete the best results" }
  } else {
    pick = { month: termKeys[2], reason: "A quiet spot in your schedule" }
  }
  return { ...pick, month: avoidCollision(pick.month) }
}

// Turn onboarding month picks into dated visits. Day-of-month is a mid-month
// anchor — Anthony confirms exact dates with the customer before each visit.
export function buildVisitsFromPicks(
  picks: SchedulePick[],
  services: PlanService[],
  now: Date = new Date()
): { service_name: string; seq: number; scheduled_date: string }[] | { error: string } {
  const minFirst = new Date(now.getTime() + 10 * 864e5)
  const maxDate = new Date(now.getTime() + 380 * 864e5)
  const visits: { service_name: string; seq: number; scheduled_date: string }[] = []

  for (const svc of services) {
    const pick = picks.find((p) => p.service_name === svc.name)
    if (!pick || !Array.isArray(pick.months) || pick.months.length !== Number(svc.visits_per_year)) {
      return { error: `Month selection missing for ${svc.name}` }
    }
    const sorted = [...pick.months].sort()
    for (let i = 0; i < sorted.length; i++) {
      const key = sorted[i]
      if (!/^\d{4}-\d{2}$/.test(key)) return { error: "Invalid month format" }
      let date = new Date(`${key}-15T12:00:00`)
      if (isNaN(date.getTime()) || date > maxDate) return { error: "Month is outside your plan year" }
      if (date < minFirst) date = new Date(now.getTime() + 14 * 864e5)
      visits.push({
        service_name: svc.name,
        seq: i + 1,
        scheduled_date: date.toISOString().slice(0, 10),
      })
    }
  }

  visits.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
  return visits
}

// Reschedule parameters for the member portal
export const RESCHEDULE_MIN_NOTICE_HOURS = 48
export const RESCHEDULE_WINDOW_DAYS = 14

export function validateRescheduleRequest(
  currentDate: string,
  requestedDate: string,
  now: Date = new Date()
): { ok: true } | { ok: false; reason: string } {
  const current = new Date(currentDate + "T12:00:00")
  const requested = new Date(requestedDate + "T12:00:00")

  if (isNaN(requested.getTime())) return { ok: false, reason: "Invalid date." }

  const hoursUntilVisit = (current.getTime() - now.getTime()) / 36e5
  if (hoursUntilVisit < RESCHEDULE_MIN_NOTICE_HOURS) {
    return {
      ok: false,
      reason: `Visits can be rescheduled up to ${RESCHEDULE_MIN_NOTICE_HOURS} hours before the scheduled date. Please call or text us instead.`,
    }
  }

  if (requested.getTime() < now.getTime()) {
    return { ok: false, reason: "The new date must be in the future." }
  }

  const daysDiff = Math.abs(requested.getTime() - current.getTime()) / 864e5
  if (daysDiff > RESCHEDULE_WINDOW_DAYS) {
    return {
      ok: false,
      reason: `New dates must be within ${RESCHEDULE_WINDOW_DAYS} days of the original visit so we can keep your plan on track. Need something further out? Call or text us.`,
    }
  }

  return { ok: true }
}

export function formatMoney(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
  })
}
