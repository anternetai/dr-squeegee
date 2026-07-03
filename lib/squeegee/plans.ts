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

// Spread a plan's visits across a 12-month term. Recurring services are evenly
// spaced (quarterly for 4x, etc.); one-off services fill the gaps between them.
// All dates are editable in the CRM afterward.
export function generateVisitSchedule(
  services: PlanService[],
  termStart: Date
): { service_name: string; seq: number; scheduled_date: string }[] {
  const visits: { service_name: string; seq: number; scheduled_date: string }[] = []

  const recurring = services.filter((s) => s.visits_per_year > 1)
  const oneOffs = services.filter((s) => s.visits_per_year === 1)

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
