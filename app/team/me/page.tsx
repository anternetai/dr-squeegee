import { redirect } from "next/navigation"
import { getSessionEmployee } from "@/lib/squeegee/employee-auth"
import { crewPayFor, getCrewAdmin, totalMs } from "@/lib/squeegee/crew"
import { MeView } from "./me-view"

export const dynamic = "force-dynamic"

function weekStart(): Date {
  const now = new Date()
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const dow = (et.getDay() + 6) % 7 // Monday = 0
  et.setDate(et.getDate() - dow)
  et.setHours(0, 0, 0, 0)
  return et
}

export default async function CrewMePage() {
  const employee = await getSessionEmployee()
  if (!employee) redirect("/team/login")

  const supabase = getCrewAdmin()
  const start = weekStart()

  const [{ data: segments }, { data: doneJobs }, { data: subs }] = await Promise.all([
    supabase
      .from("squeegee_job_time")
      .select("kind, started_at, ended_at")
      .eq("employee_id", employee.id)
      .gte("started_at", start.toISOString()),
    supabase
      .from("squeegee_jobs")
      .select("id, crew_pay")
      .eq("assigned_employee_id", employee.id)
      .eq("status", "complete")
      .gte("completed_at", start.toISOString()),
    supabase
      .from("squeegee_push_subscriptions")
      .select("id")
      .eq("employee_id", employee.id)
      .limit(1),
  ])

  const segs = (segments ?? []) as {
    kind: "drive" | "work"
    started_at: string
    ended_at: string | null
  }[]
  const workedMs = totalMs(segs, "work")
  const driveMs = totalMs(segs, "drive")

  const perJobTotal = (doneJobs ?? []).reduce(
    (sum, j) => sum + Number((j as { crew_pay: number | null }).crew_pay ?? 0),
    0
  )

  // Their pay, never the customer's price.
  const pay = crewPayFor(employee, {
    workedMs: workedMs + driveMs,
    jobCrewPay: perJobTotal || null,
  })

  return (
    <MeView
      name={employee.name}
      payType={employee.pay_type}
      workedMs={workedMs}
      driveMs={driveMs}
      jobsDone={(doneJobs ?? []).length}
      pay={pay}
      pushRegistered={(subs ?? []).length > 0}
      vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
    />
  )
}
