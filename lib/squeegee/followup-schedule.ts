// Which pending quotes get an automatic follow-up text today, and which touch.
//
// Cadence: day 2, day 7, day 14 after the quote was created, then stop. Three
// touches, ever. A quote in "help" is never auto-texted (the customer asked a
// question - that is Anthony's reply to write). A job that has moved past
// "quoted" stops the sequence even if the quote row somehow still says
// pending, so a race can never text someone who just booked.
//
// Pure. The cron (app/api/cron/followups) does the I/O and MUST only count a
// touch when the send actually reached the customer: sendSms returns
// sent:true in test mode (redirected to SMS_TEST_TO), so the cron increments
// followup_count only when `result.sent && !result.test`.

import { hourET } from "./dates.ts"

export const FOLLOWUP_DAYS = [2, 7, 14] as const
export const FOLLOWUP_MAX = FOLLOWUP_DAYS.length
export const MIN_GAP_DAYS = 2
export const WINNABLE_DAYS = 45

export type FollowupTouch = 1 | 2 | 3

export interface FollowupCandidate {
  id: string
  createdAt: string
  followupCount: number
  lastFollowupAt: string | null
  quoteStatus: string
  /** null = orphan quote with no job; still eligible. */
  jobStatus: string | null
  hasPhone: boolean
  optedOut: boolean
  excluded?: boolean
}

const OPEN_JOB_STATUSES = new Set<string | null>([null, "new", "quoted"])

function daysSince(iso: string, now: Date): number {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return -1
  return (now.getTime() - t) / 86_400_000
}

/** The touch number to send now, or null. */
export function selectFollowupTouch(c: FollowupCandidate, now: Date): FollowupTouch | null {
  if (c.excluded) return null
  if (c.quoteStatus !== "pending") return null
  if (!OPEN_JOB_STATUSES.has(c.jobStatus)) return null
  if (!c.hasPhone || c.optedOut) return null
  if (c.followupCount >= FOLLOWUP_MAX || c.followupCount < 0) return null

  const age = daysSince(c.createdAt, now)
  if (age < 0 || age > WINNABLE_DAYS) return null
  if (age < FOLLOWUP_DAYS[c.followupCount]) return null

  if (c.lastFollowupAt) {
    const gap = daysSince(c.lastFollowupAt, now)
    if (gap < MIN_GAP_DAYS) return null
  }
  return (c.followupCount + 1) as FollowupTouch
}

/** 9:00-19:59 ET by default. Inclusive start, exclusive end. */
export function withinSendWindowET(now: Date, startHour = 9, endHour = 20): boolean {
  const h = hourET(now)
  return h >= startHour && h < endHour
}
