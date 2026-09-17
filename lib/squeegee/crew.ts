// Dr. Squeegee crew — the field lifecycle, the per-job clock, and the photo gate.
//
// Both the /team portal and the /crm admin surface read this file, so the crew
// and Anthony always see the same vocabulary and the same rules. Job pipeline
// status (new → quoted → approved → scheduled → complete) is a SEPARATE axis and
// lives on squeegee_jobs.status; this is squeegee_jobs.field_status, which only
// ever describes what the crew is doing right now.

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { ServicePhoto } from "./field"

export function getCrewAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ---- field lifecycle ----
//
// Lives in ./field.ts (pure, unit-tested). Re-exported so every existing import
// of these names from ./crew keeps working.
export {
  FIELD_STEPS,
  crewProfit,
  crewReplyKeyword,
  crewVerdict,
  fieldStateSentence,
  missingServices,
  nextStep,
  photoGateReason,
  serviceList,
  stepReached,
} from "./field"
export type {
  CrewJobRow,
  CrewProfit,
  CrewVerdict,
  FieldStatus,
  FieldStepKey,
  PhotoKind,
  ServicePhoto,
} from "./field"

/**
 * A scheduled job whose day has passed without completion. Derived, never stored
 * — the same way Jobber does it — and surfaced to Anthony only, never the crew.
 */
export function isLate(job: {
  status: string
  appointment_date: string | null
}): boolean {
  if (job.status === "complete" || !job.appointment_date) return false
  return job.appointment_date < todayKey()
}

export function todayKey(): string {
  // The business runs in one timezone; ET is the only clock that matters here.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return `${get("year")}-${get("month")}-${get("day")}`
}

// ---- per-job clock ----
//
// Driven entirely by the status taps above. There is deliberately NO separate
// clock button: a day timer running alongside job timers is the documented source
// of accidental-timer complaints in every product we looked at.
//
//   On my way -> open a `drive` segment
//   Start job -> close `drive`, open `work`
//   Done      -> close `work`

export type TimeKind = "drive" | "work"

/** Close whatever segment this employee has open. Safe to call when none is. */
export async function closeOpenSegment(
  supabase: SupabaseClient,
  employeeId: string,
  at: string = new Date().toISOString()
): Promise<void> {
  await supabase
    .from("squeegee_job_time")
    .update({ ended_at: at })
    .eq("employee_id", employeeId)
    .is("ended_at", null)
}

/**
 * Start a segment, closing any other one first. A unique partial index enforces
 * one-open-per-employee at the DB level too, so a double tap can't double-count.
 */
export async function openSegment(
  supabase: SupabaseClient,
  args: { employeeId: string; jobId: string; kind: TimeKind }
): Promise<void> {
  await closeOpenSegment(supabase, args.employeeId)
  await supabase.from("squeegee_job_time").insert({
    job_id: args.jobId,
    employee_id: args.employeeId,
    kind: args.kind,
  })
}

export interface TimeSegment {
  kind: TimeKind
  started_at: string
  ended_at: string | null
}

/** Milliseconds across segments. An open segment counts up to `now`. */
export function totalMs(segments: TimeSegment[], kind?: TimeKind): number {
  const now = Date.now()
  return segments.reduce((sum, s) => {
    if (kind && s.kind !== kind) return sum
    const start = new Date(s.started_at).getTime()
    const end = s.ended_at ? new Date(s.ended_at).getTime() : now
    return sum + Math.max(0, end - start)
  }, 0)
}

export function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

/**
 * "12m ago" / "3h ago" / "2d ago". Server-side only — it reads the clock, so
 * calling it from a client component's render would be impure.
 */
export function relativeLabel(ts: string): string {
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

/** Is this lockout still in force? */
export function lockActive(lockedUntil: string | null | undefined): boolean {
  return !!lockedUntil && new Date(lockedUntil).getTime() > Date.now()
}

export function hoursFrom(ms: number): number {
  return Math.round((ms / 3600000) * 100) / 100
}

// ---- photo gate ----
//
// The rule itself is photoGateReason() in ./field.ts (per service). This is just
// the loader: the (kind, service) rows the gate needs, for one job.

export async function jobPhotos(supabase: SupabaseClient, jobId: string): Promise<ServicePhoto[]> {
  const { data } = await supabase
    .from("squeegee_job_photos")
    .select("kind, service")
    .eq("job_id", jobId)
  return (data ?? []) as ServicePhoto[]
}

export const PHOTO_BUCKET = "job-photos"

/** Signed URLs for a set of photos, in one round trip. Bucket is private. */
export async function signPhotos(
  supabase: SupabaseClient,
  paths: string[],
  expiresIn = 60 * 60
): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, expiresIn)
  const out: Record<string, string> = {}
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out[row.path] = row.signedUrl
  }
  return out
}

// ---- crew pay ----
//
// The crew sees THEIR pay and never the customer price. Mirrors the "Field crew"
// permission preset every product in this category ships with, and it is the whole
// reason squeegee_jobs.price is not selected anywhere under /team.

export function crewPayFor(
  employee: { pay_type: string; pay_rate: number | null },
  args: { workedMs: number; jobCrewPay: number | null }
): number | null {
  if (employee.pay_type === "per_job") return args.jobCrewPay
  if (employee.pay_type === "hourly") {
    if (employee.pay_rate == null) return null
    return Math.round(hoursFrom(args.workedMs) * employee.pay_rate * 100) / 100
  }
  return null // day_rate is settled off-app; showing a guess would be worse than nothing
}

export function money(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
