// Web Push for the /team crew portal.
//
// Push is the crew's only notification channel by Anthony's call — no SMS to the
// crew. That makes reliability visible rather than assumed: every send updates
// last_success_at / failure_count on the subscription, and a dead subscription
// shows up in /crm/team so a silent failure is something Anthony can SEE instead
// of discovering when a job gets missed.
//
// The board is always the source of truth. A missed notification must never mean
// a missed job — /team shows the real schedule whether or not a push arrived.

import webpush from "web-push"
import { getCrewAdmin } from "./crew"

let configured = false

function configure(): boolean {
  if (configured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:anternetai@gmail.com",
    publicKey,
    privateKey
  )
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

interface SubRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  failure_count: number
}

/**
 * Send to every device an employee has registered. Never throws — a notification
 * failure must not fail the action that triggered it.
 */
export async function pushToEmployee(
  employeeId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!configure()) return { sent: 0, failed: 0 }

  const supabase = getCrewAdmin()
  const { data } = await supabase
    .from("squeegee_push_subscriptions")
    .select("id, endpoint, p256dh, auth, failure_count")
    .eq("employee_id", employeeId)

  const subs = (data ?? []) as SubRow[]
  let sent = 0
  let failed = 0

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        )
        sent++
        await supabase
          .from("squeegee_push_subscriptions")
          .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
          .eq("id", sub.id)
      } catch (err) {
        failed++
        const status = (err as { statusCode?: number }).statusCode
        // 404/410 = the browser threw the subscription away. It will never work
        // again, so drop it rather than counting failures forever.
        if (status === 404 || status === 410) {
          await supabase.from("squeegee_push_subscriptions").delete().eq("id", sub.id)
        } else {
          await supabase
            .from("squeegee_push_subscriptions")
            .update({ failure_count: sub.failure_count + 1 })
            .eq("id", sub.id)
        }
      }
    })
  )

  return { sent, failed }
}

/**
 * A job was scheduled or rescheduled.
 *
 * Unassigned -> tell everyone there's work on the board to claim.
 * Already claimed -> tell only the person holding it that their day moved.
 *
 * Both use a per-job `tag`, so a run of edits REPLACES the notification on the
 * phone instead of stacking six of them. That's the practical version of the
 * debounce a queue would give us, without adding a queue.
 */
export async function notifyJobScheduled(job: {
  id: string
  client_name: string | null
  service_type: string | null
  assigned_employee_id: string | null
  whenLabel: string
}): Promise<void> {
  const service = job.service_type || "Job"
  const who = job.client_name || "a customer"

  if (job.assigned_employee_id) {
    await pushToEmployee(job.assigned_employee_id, {
      title: "Your schedule changed",
      body: `${service} for ${who} is now ${job.whenLabel}.`,
      url: `/team/jobs/${job.id}`,
      tag: `job-${job.id}`,
    }).catch(() => null)
    return
  }

  await pushToActiveCrew({
    title: "New job on the board",
    body: `${service} for ${who} - ${job.whenLabel}. Tap to claim it.`,
    url: "/team",
    tag: `job-${job.id}`,
  }).catch(() => null)
}

/** Everyone who could claim work — used when a job lands on the open board. */
export async function pushToActiveCrew(payload: PushPayload): Promise<void> {
  const supabase = getCrewAdmin()
  const { data } = await supabase
    .from("squeegee_employees")
    .select("id")
    .in("status", ["active", "onboarding"])

  await Promise.all(
    (data ?? []).map((e) => pushToEmployee((e as { id: string }).id, payload).catch(() => null))
  )
}
