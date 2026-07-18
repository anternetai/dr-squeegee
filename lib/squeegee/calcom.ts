/**
 * Cal.com API v2 integration for Dr. Squeegee job scheduling.
 *
 * Verified against the live account (username `drsqclt`) on 2026-07-17 via a
 * throwaway probe script — v1 is dead (410), v2 needs `cal-api-version`
 * headers that differ per resource:
 *   - event-types: 2024-06-14
 *   - bookings:    2024-08-13
 *
 * Booking title caveat (load-bearing, don't "fix" this later without re-checking):
 * Cal v2 does NOT accept a top-level `title` on POST /bookings (400: "title
 * property is wrong, property title should not exist"). The booking's title
 * is always auto-generated as "<Event Type Title> between <Host> and
 * <attendee.name>". There is no override. So we embed the desired title text
 * ("<client> — <service>") into `attendee.name` — that's what actually shows
 * up as the booking/calendar-event title. `bookingFieldsResponses.notes` maps
 * directly to the booking `description` field (verified) — that's where real
 * job notes go.
 *
 * Similarly, `lengthInMinutes` cannot be overridden per-booking on a
 * single-length event type (400: "event type does not have multiple possible
 * lengths") — duration is fixed by the event type itself (60 min, set below).
 *
 * The Cal.com account has Google Calendar connected (primary
 * anternetai@gmail.com), so every booking created here lands on Anthony's
 * real calendar automatically — no separate sync step needed. NOTE: this is
 * independent of this repo's own googleapis/OAuth Google Calendar sync
 * (lib/google-calendar.ts, the "Sync to Google Calendar" button on the job
 * page) — using both on the same job will create two calendar events for the
 * same appointment. That's a pre-existing risk this file doesn't attempt to
 * resolve; flagged in the build report.
 *
 * Every exported function is a safe no-op (returns null/false + console.warn)
 * if CAL_COM_API_KEY is missing or any call fails — scheduling in the CRM
 * must never be blocked by Cal.com being down or misconfigured.
 */

const CAL_API_BASE = "https://api.cal.com/v2"
const EVENT_TYPE_SLUG = "service-job"
const EVENT_TYPE_TITLE = "Service Job"
const DEFAULT_LENGTH_MINUTES = 60

// Clients are phone-first (SMS confirmations sent separately from the job
// page) — Cal booking/confirmation emails route to the owner's own inbox,
// never to the customer.
const ATTENDEE_EMAIL = "care@drsqueegeeclt.com"

// Cached for the lifetime of the serverless invocation — avoids an extra
// list-event-types round trip on every schedule call. Fine to recompute on
// cold start.
let cachedEventTypeId: number | null = null

function getApiKey(): string | null {
  const key = process.env.CAL_COM_API_KEY
  if (!key) {
    console.warn("[calcom] CAL_COM_API_KEY not set — Cal.com sync disabled; job scheduling continues CRM-only")
    return null
  }
  return key
}

async function calFetch(
  path: string,
  apiVersion: string,
  init: RequestInit = {}
): Promise<any | null> {
  const key = getApiKey()
  if (!key) return null

  try {
    const res = await fetch(`${CAL_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "cal-api-version": apiVersion,
        ...(init.headers || {}),
      },
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      console.warn(`[calcom] ${init.method || "GET"} ${path} -> ${res.status}`, JSON.stringify(json))
      return null
    }
    return json
  } catch (err) {
    console.warn(`[calcom] request failed: ${init.method || "GET"} ${path}`, err)
    return null
  }
}

/** Finds the hidden "service-job" event type, creating it on first use. */
async function getOrCreateEventTypeId(): Promise<number | null> {
  if (cachedEventTypeId) return cachedEventTypeId

  const list = await calFetch("/event-types", "2024-06-14")
  const existing = Array.isArray(list?.data)
    ? list.data.find((et: { slug?: string; id?: number }) => et.slug === EVENT_TYPE_SLUG)
    : null

  if (existing?.id) {
    cachedEventTypeId = existing.id
    return cachedEventTypeId
  }

  const created = await calFetch("/event-types", "2024-06-14", {
    method: "POST",
    body: JSON.stringify({
      title: EVENT_TYPE_TITLE,
      slug: EVENT_TYPE_SLUG,
      lengthInMinutes: DEFAULT_LENGTH_MINUTES,
      hidden: true,
    }),
  })

  if (created?.data?.id) {
    cachedEventTypeId = created.data.id
    return cachedEventTypeId
  }

  console.warn("[calcom] could not find or create the 'service-job' event type")
  return null
}

/**
 * America/New_York's current UTC offset ("-04:00" in EDT, "-05:00" in EST)
 * for a given calendar date — DST-correct, no hardcoded month ranges.
 */
export function easternOffsetFor(dateStr: string): string {
  try {
    const dt = new Date(`${dateStr}T12:00:00Z`) // noon UTC avoids day-boundary rollover
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      timeZoneName: "longOffset",
    }).formatToParts(dt)
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value // "GMT-04:00"
    const match = tzPart?.match(/GMT([+-]\d{2}:\d{2})/)
    return match ? match[1] : "-05:00"
  } catch {
    return "-05:00"
  }
}

/** Builds a DST-correct ISO 8601 string (with explicit ET offset) from a wall-clock date + time. */
export function buildEasternISOString(date: string, time: string): string {
  const t = time.length === 5 ? `${time}:00` : time
  return `${date}T${t}${easternOffsetFor(date)}`
}

export interface CreateJobBookingParams {
  /** "<client_name> — <service_type>" — embedded into attendee.name (see file header). */
  title: string
  /** ISO 8601 string with explicit ET offset — build with buildEasternISOString(). */
  start: string
  /** Accepted for interface completeness; Cal enforces the event type's fixed 60-min length (see file header). */
  lengthMinutes?: number
  clientName: string
  notes?: string
}

/** Creates a Cal.com booking for a job. Returns null (never throws) on any failure or missing config. */
export async function createJobBooking(
  params: CreateJobBookingParams
): Promise<{ uid: string } | null> {
  if (!getApiKey()) return null

  const eventTypeId = await getOrCreateEventTypeId()
  if (!eventTypeId) return null

  const result = await calFetch("/bookings", "2024-08-13", {
    method: "POST",
    body: JSON.stringify({
      eventTypeId,
      start: params.start,
      attendee: {
        name: params.title,
        email: ATTENDEE_EMAIL,
        timeZone: "America/New_York",
      },
      ...(params.notes ? { bookingFieldsResponses: { notes: params.notes } } : {}),
    }),
  })

  const uid = result?.data?.uid
  if (!uid) {
    console.warn("[calcom] booking creation returned no uid — treating as failure")
    return null
  }
  return { uid }
}

/** Cancels a Cal.com booking by uid. Returns false (never throws) on any failure or missing config. */
export async function cancelJobBooking(uid: string): Promise<boolean> {
  if (!uid) return false
  if (!getApiKey()) return false

  const result = await calFetch(`/bookings/${uid}/cancel`, "2024-08-13", {
    method: "POST",
    body: JSON.stringify({ cancellationReason: "Rescheduled or removed in Dr. Squeegee CRM" }),
  })

  return result !== null
}
