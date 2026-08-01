import type { JobStatus } from "@/lib/squeegee/types"

/* ---------------------------------------------------------------------------
   Job status → tone
   ---------------------------------------------------------------------------
   The CRM used five saturated hues (blue / yellow / purple / emerald / green)
   that carried no meaning beyond "different". In a one-accent palette that
   reads as noise, and it made every list look like a bag of skittles.

   The tone answers one question instead: does this need Anthony, or not?
     attention — the ball is in his court (quote it, schedule it)
     idle      — the ball is in the customer's court, nothing to do
     accent    — money, on track or earned
--------------------------------------------------------------------------- */

export type Tone = "idle" | "attention" | "accent" | "dead"

export const STATUS_TONE: Record<JobStatus, Tone> = {
  new: "attention",       // needs a quote
  quoted: "idle",         // waiting on them
  approved: "attention",  // won, but sitting with no date
  scheduled: "accent",    // on the calendar
  complete: "accent",     // earned
}

export const TONE_CLASS: Record<Tone, string> = {
  idle: "bg-[var(--crm-idle-bg)] text-[var(--crm-idle)]",
  attention: "bg-[var(--crm-attention-bg)] text-[var(--crm-attention)]",
  accent: "bg-[var(--crm-active-bg)] text-[var(--crm-active)]",
  dead: "bg-[var(--crm-dead-bg)] text-[var(--crm-dead)]",
}

export function statusClass(status: JobStatus): string {
  return TONE_CLASS[STATUS_TONE[status]]
}

/** Money formatting used across the CRM. Whole dollars in lists — cents are
 *  noise when you are scanning twenty rows; the detail view shows them. */
export function money(n: number, opts?: { cents?: boolean; short?: boolean }): string {
  if (opts?.short && Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: opts?.cents ? 2 : 0,
    maximumFractionDigits: opts?.cents ? 2 : 0,
  })}`
}
