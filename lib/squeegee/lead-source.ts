// Lead source. Two questions, two columns:
//   squeegee_clients.lead_source - how the RELATIONSHIP began. Set once.
//   squeegee_jobs.lead_source    - how THIS JOB arrived. A repeat client's
//                                  third job must not re-credit door knocking.
// "repeat" is derived, never typed: the client column's CHECK constraint does
// not even allow it, and resolveJobLeadSource() assigns it whenever the client
// already has a prior job.
//
// Import-free so node:test can load it under --experimental-strip-types.

export const LEAD_SOURCES = [
  "door_knock",
  "google",
  "referral",
  "nextdoor",
  "yard_sign",
  "social",
  "website",
  "other",
] as const

export type LeadSource = (typeof LEAD_SOURCES)[number]
export type JobLeadSource = LeadSource | "repeat"

export const LEAD_SOURCE_LABELS: Record<JobLeadSource, string> = {
  door_knock: "Door knock",
  google: "Google",
  referral: "Referral",
  nextdoor: "Nextdoor",
  yard_sign: "Yard sign",
  social: "Social",
  website: "Website",
  other: "Other",
  repeat: "Repeat customer",
}

export function isLeadSource(value: unknown): value is LeadSource {
  return typeof value === "string" && (LEAD_SOURCES as readonly string[]).includes(value)
}

export function isJobLeadSource(value: unknown): value is JobLeadSource {
  return value === "repeat" || isLeadSource(value)
}

/**
 * The job's source. An explicit pick from the owner wins; otherwise any prior
 * job on the client makes this one "repeat"; otherwise the job inherits the
 * relationship's origin; otherwise it is unknown (null, shown as "unknown" in
 * revenue, never guessed).
 */
export function resolveJobLeadSource(
  explicit: unknown,
  priorJobCount: number,
  clientLeadSource: unknown
): JobLeadSource | null {
  if (isJobLeadSource(explicit)) return explicit
  if (priorJobCount > 0) return "repeat"
  if (isLeadSource(clientLeadSource)) return clientLeadSource
  return null
}

/** Map a web-form lead's `source`/`utm_source` onto the taxonomy. */
export function leadSourceFromWebLead(source: string | null | undefined, utmSource: string | null | undefined): LeadSource {
  const u = (utmSource ?? "").toLowerCase()
  if (/google|gclid|adwords/.test(u)) return "google"
  if (/nextdoor/.test(u)) return "nextdoor"
  if (/facebook|instagram|fb|ig|tiktok|youtube|meta/.test(u)) return "social"
  if (/referr/.test(u)) return "referral"
  const s = (source ?? "").toLowerCase()
  if (/landing|website|web|site/.test(s)) return "website"
  return "other"
}
