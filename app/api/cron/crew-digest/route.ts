import { NextRequest, NextResponse } from "next/server"
import { getCrewAdmin, todayKey } from "@/lib/squeegee/crew"
import { pushToActiveCrew, pushToEmployee } from "@/lib/squeegee/push"

/**
 * The 6 AM crew digest.
 *
 * Two messages, both push-only (Anthony's call — no SMS to the crew):
 *   - to each crew member holding work today: what they have and where it starts
 *   - to everyone, if unclaimed work is still sitting on the board for today
 *
 * Runs every morning; sends nothing on a day with no work, because a daily
 * notification that's usually empty is a notification people learn to ignore.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getCrewAdmin()
  const today = todayKey()

  const { data: jobs } = await supabase
    .from("squeegee_jobs")
    .select("id, client_name, address, assigned_employee_id, appointment_time")
    .eq("status", "scheduled")
    .eq("appointment_date", today)
    .order("appointment_time", { ascending: true, nullsFirst: false })

  const rows = (jobs ?? []) as {
    id: string
    client_name: string | null
    address: string | null
    assigned_employee_id: string | null
    appointment_time: string | null
  }[]

  const timeLabel = (t: string | null): string => {
    if (!t) return "sometime today"
    const [h, m] = t.split(":").map(Number)
    const ampm = h >= 12 ? "PM" : "AM"
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`
  }

  // Per-crew-member digest.
  const byEmployee = new Map<string, typeof rows>()
  for (const j of rows) {
    if (!j.assigned_employee_id) continue
    const list = byEmployee.get(j.assigned_employee_id) ?? []
    list.push(j)
    byEmployee.set(j.assigned_employee_id, list)
  }

  let digests = 0
  for (const [employeeId, list] of byEmployee) {
    const first = list[0]
    const where = (first.address ?? "").split(",")[0]
    await pushToEmployee(employeeId, {
      title: `${list.length} stop${list.length === 1 ? "" : "s"} today`,
      body: `First is ${timeLabel(first.appointment_time)}${where ? ` at ${where}` : ""}.`,
      url: "/team",
      tag: "crew-digest",
    }).catch(() => null)
    digests++
  }

  // Anything still unclaimed for today goes to everyone who could run it.
  const unclaimed = rows.filter((j) => !j.assigned_employee_id)
  if (unclaimed.length > 0) {
    await pushToActiveCrew({
      title: `${unclaimed.length} job${unclaimed.length === 1 ? "" : "s"} still open today`,
      body: "Nobody has claimed them yet. Tap to pick one up.",
      url: "/team",
      tag: "crew-open-board",
    }).catch(() => null)
  }

  return NextResponse.json({
    ok: true,
    date: today,
    digests,
    unclaimed: unclaimed.length,
  })
}
