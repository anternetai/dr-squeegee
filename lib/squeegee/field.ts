// The crew's field lifecycle — pure. No Supabase, no Next, so it unit-tests
// under node:test and both the /team portal and the /crm surfaces read the
// same rules. Re-exported from ./crew.ts for existing imports.
//
// Pipeline status (new → quoted → approved → scheduled → complete) is a SEPARATE
// axis on squeegee_jobs.status. This is squeegee_jobs.field_status: what the
// crew is doing right now.

export type FieldStatus = "on_my_way" | "arrived" | "in_progress"

// Four taps, in order. Only the next legal one is ever shown as a button — a
// tech should never have to pick from a menu on a wet phone.
export const FIELD_STEPS = [
  { key: "on_my_way", label: "On my way", done: "On the way" },
  { key: "arrived", label: "Arrived", done: "Arrived" },
  { key: "in_progress", label: "Start job", done: "Working" },
  { key: "complete", label: "Done", done: "Complete" },
] as const

export type FieldStepKey = (typeof FIELD_STEPS)[number]["key"]

const ORDER: (FieldStatus | null)[] = [null, "on_my_way", "arrived", "in_progress"]

/** The one action a crew member can legally take next, or null when finished. */
export function nextStep(job: { status: string; field_status: string | null }): FieldStepKey | null {
  if (job.status === "complete") return null
  const idx = ORDER.indexOf((job.field_status as FieldStatus | null) ?? null)
  const next = ORDER[idx + 1]
  return next ?? "complete"
}

/** Has this step been reached (for the step bar)? */
export function stepReached(
  job: { status: string; field_status: string | null },
  key: FieldStepKey
): boolean {
  if (job.status === "complete") return true
  if (key === "complete") return false
  const cur = ORDER.indexOf((job.field_status as FieldStatus | null) ?? null)
  return cur >= ORDER.indexOf(key)
}

/** Plain sentence for the current state. Only the changing verb is emphasised. */
export function fieldStateSentence(job: {
  status: string
  field_status: string | null
}): { prefix: string; verb: string; suffix: string } {
  if (job.status === "complete") return { prefix: "This job is ", verb: "complete", suffix: "." }
  if (job.field_status === "in_progress") return { prefix: "You are ", verb: "working", suffix: " this job." }
  if (job.field_status === "arrived") return { prefix: "You have ", verb: "arrived", suffix: "." }
  if (job.field_status === "on_my_way") return { prefix: "You are ", verb: "on the way", suffix: "." }
  return { prefix: "You haven't ", verb: "started", suffix: " yet." }
}

// ---- services on a job ----
//
// squeegee_jobs.service_type is a comma-joined label ("House Wash, Windows").
// The quote builder can repeat one ("Window Cleaning, Window Cleaning" is real
// data), so dedupe case-insensitively and keep the first spelling.

export function serviceList(serviceType: string | null | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of (serviceType ?? "").split(",")) {
    const s = raw.trim()
    if (!s) continue
    const k = s.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(s)
  }
  return out.length ? out : ["Job"]
}

// ---- photo gate, per service ----
//
// Every service on the job needs at least one BEFORE photo before work starts
// and one AFTER photo before it can be marked done. A photo with service = null
// predates this rule (or was taken against a job whose services changed) and
// counts for every service — the gate must never brick an in-flight job.

export type PhotoKind = "before" | "after"

export interface ServicePhoto {
  kind: string
  service: string | null
}

export function missingServices(
  kind: PhotoKind,
  services: string[],
  photos: ServicePhoto[]
): string[] {
  const ofKind = photos.filter((p) => p.kind === kind)
  if (ofKind.some((p) => p.service == null)) return []
  const have = new Set(ofKind.map((p) => (p.service as string).trim().toLowerCase()))
  return services.filter((s) => !have.has(s.trim().toLowerCase()))
}

/**
 * Why work can't start (before) or finish (after) yet, or null when it can. The
 * reason is written to be shown ON the disabled button — never buried in a
 * toast the crew will miss on a bright driveway.
 */
export function photoGateReason(
  kind: PhotoKind,
  services: string[],
  photos: ServicePhoto[]
): string | null {
  const missing = missingServices(kind, services, photos)
  if (missing.length === 0) return null
  const article = kind === "before" ? "a before" : "an after"
  if (missing.length === 1) {
    return services.length === 1
      ? `Add ${article} photo first`
      : `Add ${article} photo of the ${missing[0]} first`
  }
  return `${kind === "before" ? "Before" : "After"} photos still needed: ${missing.join(", ")}`
}

// ---- Anthony's reply to a crew alert ----

/** "YES" / "y" / "Yes!" → "yes"; "NO" / "n" → "no"; anything else → null. */
export function crewReplyKeyword(body: string): "yes" | "no" | null {
  const k = body.trim().toUpperCase().replace(/[^A-Z]/g, "")
  if (k === "YES" || k === "Y") return "yes"
  if (k === "NO" || k === "N") return "no"
  return null
}
