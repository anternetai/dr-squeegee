// Canonical service taxonomy + normalizer.
//
// `squeegee_jobs.service_type` is a free-text, comma-joined list of quote line
// names ("House Washing, Window Cleaning", "Surface Cleaning, Driveway,
// Retaining Wall") and the text-to-CRM parser can produce any string at all.
// Nothing is stored in canonical form on purpose: everything that needs a
// service bucket (client metrics, revenue by service, offers, cadences) calls
// these functions on read, so there is no second copy of the truth to drift.
//
// Two functions, two jobs:
//   normalizeService(line)  - ONE bucket for ONE quote line (a line has a price
//                             and must land in exactly one bucket). Earliest
//                             match in the string wins: "Roof + Gutter Blow Off"
//                             is a roof line; "Front Entryway Softwash" is a
//                             surfaces line.
//   normalizeServices(text) - the full SET for a job's service_type: split on
//                             the joiners, map each piece, dedupe in order.
//
// Judgement calls, deliberate: Back Deck, Retaining Wall, Entryway, Courtyard,
// Patio, Walkway, Fence -> surfaces (flat/masonry work priced per sqft and
// due on the same 12-month cadence). Placeholders ("Pending Quote", "TBD",
// "Service") -> [] so a finished job with no real service is visible on the
// Data-health page instead of silently counted as "other".
//
// Import-free on purpose: node:test and scripts/ load it directly under
// --experimental-strip-types.

export const SERVICES = [
  "house_wash",
  "windows",
  "driveway",
  "surfaces",
  "pavers",
  "pool_deck",
  "gutters",
  "roof",
  "other",
] as const

export type Service = (typeof SERVICES)[number]

export const SERVICE_LABELS: Record<Service, string> = {
  house_wash: "House wash",
  windows: "Window cleaning",
  driveway: "Driveway",
  surfaces: "Surface cleaning",
  pavers: "Pavers",
  pool_deck: "Pool deck",
  gutters: "Gutters",
  roof: "Roof wash",
  other: "Other",
}

/** Lowercase noun for prose ("your house wash", "your windows"). */
export const SERVICE_NOUNS: Record<Service, string> = {
  house_wash: "house wash",
  windows: "windows",
  driveway: "driveway",
  surfaces: "surfaces",
  pavers: "pavers",
  pool_deck: "pool deck",
  gutters: "gutters",
  roof: "roof",
  other: "service",
}

export function isService(value: unknown): value is Service {
  return typeof value === "string" && (SERVICES as readonly string[]).includes(value)
}

// Order matters only for ties at the same string position; the earliest match
// in the input wins overall. pool_deck must precede the bare /deck/ inside the
// surfaces pattern, which it does because each pattern is tested for position
// and "pool deck" starts before "deck" does.
const PATTERNS: [RegExp, Service][] = [
  [/pool\s*deck/i, "pool_deck"],
  [/paver/i, "pavers"],
  [/gutter/i, "gutters"],
  [/roof/i, "roof"],
  [/house\s*wash(ing)?|siding|soft\s*wash(ing)?\s+(the\s+)?house|whole\s*house/i, "house_wash"],
  [/window|glass|screens?\b/i, "windows"],
  [/driveway|drive\s*way|garage\s*pad/i, "driveway"],
  [
    /surface|concrete|patio|walkway|walk\s*way|sidewalk|deck|entryway|entry\s*way|retaining\s*wall|courtyard|porch|steps|stoop|flatwork|fence|brick|stone|paths?\b/i,
    "surfaces",
  ],
]

const PLACEHOLDERS = /^(pending\s*quote|tbd|tba|service|services|quote|new\s*job|n\/?a|none|unknown|-+|—)$/i

/** Split a joined service string into its pieces. */
export function splitServiceText(raw: string): string[] {
  return raw
    .split(/\s*(?:,|\+|&|\band\b|;|\|)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * The single best bucket for one line of text. Returns null for empty or
 * placeholder input, "other" when the text is real but matches nothing.
 */
export function normalizeService(raw: string | null | undefined): Service | null {
  const text = (raw ?? "").trim()
  if (!text || PLACEHOLDERS.test(text)) return null

  let best: { index: number; service: Service } | null = null
  for (const [pattern, service] of PATTERNS) {
    const m = pattern.exec(text)
    if (!m) continue
    if (!best || m.index < best.index) best = { index: m.index, service }
  }
  return best ? best.service : "other"
}

/**
 * Every bucket a job's service text names, deduped, first-occurrence order.
 * Accepts the raw service_type string, an array of strings, or an array of
 * objects with a `name` (quote line items).
 */
export function normalizeServices(
  raw: string | null | undefined | (string | { name?: string | null } | null | undefined)[]
): Service[] {
  const pieces: string[] = []
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const name = typeof item === "string" ? item : item?.name
      if (name) pieces.push(...splitServiceText(String(name)))
    }
  } else if (raw) {
    pieces.push(...splitServiceText(String(raw)))
  }

  const out: Service[] = []
  for (const piece of pieces) {
    const s = normalizeService(piece)
    if (s && !out.includes(s)) out.push(s)
  }
  return out
}

/**
 * The job-level truth: quote line names when a quote exists (they are the
 * structured source service_type was generated from), else service_type.
 */
export function deriveJobServices(
  quoteLines: { name?: string | null }[] | null | undefined,
  serviceType: string | null | undefined
): Service[] {
  if (quoteLines && quoteLines.length > 0) {
    const fromLines = normalizeServices(quoteLines)
    if (fromLines.length > 0) return fromLines
  }
  return normalizeServices(serviceType)
}

/** Human list: "House wash, windows" */
export function describeServices(services: Service[]): string {
  if (services.length === 0) return "No service recorded"
  return services.map((s, i) => (i === 0 ? SERVICE_LABELS[s] : SERVICE_LABELS[s].toLowerCase())).join(", ")
}
