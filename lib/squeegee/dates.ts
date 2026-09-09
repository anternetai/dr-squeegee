// Eastern-time date helpers. The business runs on ET; the database and Vercel
// run on UTC. Every date-only value (appointment_date, paid_on, spent_on) is a
// calendar day in ET and must never be turned into an instant with `new
// Date("YYYY-MM-DD")`, which is midnight UTC = 8pm ET the day BEFORE. Anchor
// at noon ET instead: noon survives both DST transitions and the UTC offset.
//
// Import-free so node:test can load it under --experimental-strip-types.

export const ET = "America/New_York"

type Parts = { year: number; month: number; day: number; hour: number; minute: number }

function partsInET(at: Date): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
  const map: Record<string, number> = {}
  for (const p of fmt.formatToParts(at)) {
    if (p.type !== "literal") map[p.type] = Number(p.value)
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour === 24 ? 0 : map.hour,
    minute: map.minute,
  }
}

/** Milliseconds to ADD to an ET wall-clock time to get the UTC instant. */
function etOffsetMs(at: Date): number {
  const p = partsInET(at)
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  return at.getTime() - wallAsUtc
}

export function isYmd(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** "2026-09-02" -> the ISO instant of 12:00 ET on that day. */
export function etNoonInstant(ymd: string): string {
  if (!isYmd(ymd)) throw new Error(`etNoonInstant: expected YYYY-MM-DD, got ${String(ymd)}`)
  const [y, m, d] = ymd.split("-").map(Number)
  const wallUtc = Date.UTC(y, m - 1, d, 12, 0, 0)
  // Guess EDT first; the offset lookup on the guess corrects for EST.
  const guess = new Date(wallUtc + 4 * 3_600_000)
  return new Date(wallUtc + etOffsetMs(guess)).toISOString()
}

/** ISO instant (or Date) -> "YYYY-MM-DD" in ET. */
export function dateKeyET(at: string | Date): string {
  const d = typeof at === "string" ? new Date(at) : at
  if (Number.isNaN(d.getTime())) throw new Error(`dateKeyET: invalid date ${String(at)}`)
  const p = partsInET(d)
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`
}

/** ISO instant (or Date) -> "YYYY-MM" in ET. */
export function monthKeyET(at: string | Date): string {
  return dateKeyET(at).slice(0, 7)
}

/** Hour of day (0-23) in ET. */
export function hourET(at: Date): number {
  return partsInET(at).hour
}

/** Calendar month number (1-12) in ET. */
export function monthNumberET(at: Date): number {
  return partsInET(at).month
}

export function todayET(now: Date = new Date()): string {
  return dateKeyET(now)
}

/** Whole days from a to b (b - a) on the ET calendar. Negative when b is earlier. */
export function daysBetweenET(a: string | Date, b: string | Date): number {
  const ka = isYmd(a) ? a : dateKeyET(a)
  const kb = isYmd(b) ? b : dateKeyET(b)
  const [ay, am, ad] = ka.split("-").map(Number)
  const [by, bm, bd] = kb.split("-").map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/** Add calendar months to a YYYY-MM-DD, clamping the day (Jan 31 + 1 -> Feb 28/29). */
export function addMonthsYmd(ymd: string, months: number): string {
  if (!isYmd(ymd)) throw new Error(`addMonthsYmd: expected YYYY-MM-DD, got ${String(ymd)}`)
  const [y, m, d] = ymd.split("-").map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  const day = Math.min(d, lastDay)
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** Approximate whole months between two dates on the ET calendar. */
export function monthsBetweenET(a: string | Date, b: string | Date): number {
  return Math.floor(daysBetweenET(a, b) / 30.4375)
}

/** First day of the ET month containing `at`, as YYYY-MM-DD. */
export function monthStartYmd(monthKey: string): string {
  return `${monthKey}-01`
}

/** Short label for a YYYY-MM key: "Sep 2026". */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** Short ET date label from an instant or YYYY-MM-DD: "Sep 2". */
export function shortDateET(at: string | Date | null | undefined): string {
  if (!at) return "—"
  const key = isYmd(at) ? at : dateKeyET(at)
  const [y, m, d] = key.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}
