// Dr. Squeegee quote pricing — tunable constants for the smart quote line builder
// (components/squeegee/smart-quote-lines.tsx). Adjust the numbers below after real
// jobs; nothing else in the quote flow needs to change. Ported/simplified from the
// doors in-field tally tool (doors/lib/window-pricing.ts) — window cleaning here is
// a single flat "standard window" type rather than the 3-type tally, by design.

export type Story = 1 | 2 | 3
export type Coverage = "exterior" | "both"

// ─────────────────────────── WINDOW CLEANING ───────────────────────────
export const WINDOW_PRICING = {
  base: 7, // $ per window, exterior-only, 1st story
  storyMult: { 1: 1, 2: 1.3, 3: 1.7 } as Record<Story, number>,
  coverageMult: { exterior: 1, both: 1.8 } as Record<Coverage, number>,
  minJob: 200, // never quote a window job below this
  roundTo: 5, // round to the nearest $5
}

export const STORY_LABEL: Record<Story, string> = { 1: "1-story", 2: "2-story", 3: "3-story" }
export const STORY_SHORT_LABEL: Record<Story, string> = { 1: "1st", 2: "2nd", 3: "3rd" }
export const COVERAGE_LABEL: Record<Coverage, string> = { exterior: "exterior only", both: "in & out" }

/** Per-story window counts for the single combined "Window Cleaning" line — one job, one price, split by story. */
export type WindowCounts = Partial<Record<Story, number>>

export function computeWindowPrice(count: number, story: Story, coverage: Coverage): number {
  if (!count || count <= 0) return 0
  const raw =
    count * WINDOW_PRICING.base * WINDOW_PRICING.storyMult[story] * WINDOW_PRICING.coverageMult[coverage]
  const rounded = Math.round(raw / WINDOW_PRICING.roundTo) * WINDOW_PRICING.roundTo
  return Math.max(WINDOW_PRICING.minJob, rounded)
}

export function windowDetail(count: number, story: Story, coverage: Coverage): string {
  return `${count} window${count === 1 ? "" : "s"} · ${STORY_LABEL[story]} · ${COVERAGE_LABEL[coverage]}`
}

/** Total window count across all stories. */
export function windowCountsTotal(counts: WindowCounts): number {
  return ([1, 2, 3] as Story[]).reduce((sum, s) => sum + (counts[s] ?? 0), 0)
}

/**
 * One combined price for a single "Window Cleaning" line covering multiple
 * stories at once (e.g. 8 windows on the 1st floor + 4 on the 2nd). Sums the
 * per-story subtotal first, then applies the job minimum / rounding ONCE to
 * the combined total — matches how a real quote reads (one line, one price).
 */
export function computeWindowPriceMulti(counts: WindowCounts, coverage: Coverage): number {
  const total = windowCountsTotal(counts)
  if (total <= 0) return 0
  const raw = ([1, 2, 3] as Story[]).reduce((sum, s) => {
    const c = counts[s] ?? 0
    if (c <= 0) return sum
    return sum + c * WINDOW_PRICING.base * WINDOW_PRICING.storyMult[s]
  }, 0) * WINDOW_PRICING.coverageMult[coverage]
  const rounded = Math.round(raw / WINDOW_PRICING.roundTo) * WINDOW_PRICING.roundTo
  return Math.max(WINDOW_PRICING.minJob, rounded)
}

export function windowDetailMulti(counts: WindowCounts, coverage: Coverage): string {
  const total = windowCountsTotal(counts)
  const parts = ([1, 2, 3] as Story[])
    .filter((s) => (counts[s] ?? 0) > 0)
    .map((s) => `${counts[s]} ${STORY_SHORT_LABEL[s]}`)
  return `${total} window${total === 1 ? "" : "s"} (${parts.join(" + ")}) · ${COVERAGE_LABEL[coverage]}`
}

// ─────────────────────────── SQFT SERVICES ───────────────────────────
// $/sqft defaults — editable per-line in the UI.
export const SQFT_SERVICE_DEFAULTS = {
  Driveway: 0.20,
  "Surface Cleaning": 0.18,
  "Pool Deck": 0.22,
  Pavers: 0.25,
} as const

export type SqftServiceName = keyof typeof SQFT_SERVICE_DEFAULTS

export const SQFT_SERVICE_NAMES = Object.keys(SQFT_SERVICE_DEFAULTS) as SqftServiceName[]

export function computeSqftPrice(sqft: number, rate: number): number {
  if (!sqft || sqft <= 0 || !rate || rate <= 0) return 0
  return Math.round(sqft * rate)
}

export function sqftDetail(sqft: number, rate: number): string {
  return `${sqft} sqft @ $${rate.toFixed(2)}/sqft`
}

// ─────────────────────────── HOUSE WASHING ───────────────────────────
export const HOUSE_WASH_TIERS = [
  { key: "1-story-standard", label: "1-story, up to 1,500 sqft", price: 300 },
  { key: "1-story-large", label: "1-story, large (1,500+ sqft)", price: 350 },
  { key: "2-story-standard", label: "2-story, up to 2,500 sqft", price: 400 },
  { key: "2-story-large", label: "2-story, large (2,500+ sqft)", price: 475 },
  { key: "3-story", label: "3-story", price: 550 },
] as const

export type HouseWashTierKey = (typeof HOUSE_WASH_TIERS)[number]["key"]

export function houseWashTier(key: HouseWashTierKey) {
  return HOUSE_WASH_TIERS.find((t) => t.key === key) ?? HOUSE_WASH_TIERS[0]
}
