// Shared crew constants + helpers used by both the CRM admin surface and the
// /team field portal. Keep display labels here so they read the same everywhere.

import { randomBytes } from "node:crypto"

export const ROLES = [
  { value: "tech", label: "Technician" },
  { value: "lead", label: "Crew Lead" },
  { value: "admin", label: "Admin" },
] as const

export const STATUSES = [
  { value: "invited", label: "Invited", tone: "amber" },
  { value: "onboarding", label: "Onboarding", tone: "amber" },
  { value: "active", label: "Active", tone: "teal" },
  { value: "inactive", label: "Inactive", tone: "muted" },
] as const

export const PAY_TYPES = [
  { value: "per_job", label: "Per job" },
  { value: "hourly", label: "Hourly" },
  { value: "day_rate", label: "Day rate" },
] as const

// Onboarding availability grid — 7 days, Mon-first.
export const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
] as const

export function roleLabel(value: string): string {
  return ROLES.find((r) => r.value === value)?.label ?? value
}

export function statusLabel(value: string): string {
  return STATUSES.find((s) => s.value === value)?.label ?? value
}

export function payLabel(payType: string, rate: number | null): string {
  const kind = PAY_TYPES.find((p) => p.value === payType)?.label ?? payType
  if (rate == null) return kind
  const money = `$${Number(rate).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
  const suffix =
    payType === "hourly" ? "/hr" : payType === "day_rate" ? "/day" : "/job"
  return `${money}${suffix}`
}

// URL-safe invite/onboarding token — same shape as plan/portal tokens.
export function generateInviteToken(): string {
  return randomBytes(8).toString("hex")
}

// What a /team/join/[token] link should do for the row it resolves to.
//
//   onboard — never set up: the full welcome → info → agreement → PIN flow.
//   set_pin — set up, but no PIN on file. Either they onboarded under the old
//             email+password portal, or Anthony reset a forgotten PIN. They pick
//             a PIN and nothing else; the agreement they signed stands.
//   done    — set up and has a PIN: the link is spent, send them to log in.
//
// Kept pure (no Supabase, no Next) so it can be unit-tested; both the page and
// the API route call this so they can never disagree about which screen to show.
export type JoinMode = "onboard" | "set_pin" | "done"

export function joinMode(emp: { onboarded_at: string | null; pin_hash: string | null }): JoinMode {
  if (!emp.onboarded_at) return "onboard"
  if (!emp.pin_hash) return "set_pin"
  return "done"
}
