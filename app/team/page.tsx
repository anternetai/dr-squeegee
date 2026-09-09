import { redirect } from "next/navigation"
import { getSessionEmployee } from "@/lib/squeegee/employee-auth"
import { ONBOARDING_TASKS } from "@/lib/squeegee/company"
import { getCrewAdmin, todayKey, totalMs } from "@/lib/squeegee/crew"
import { TeamView, type CrewJob, type ChecklistItem } from "./team-view"

export const dynamic = "force-dynamic"

export default async function TeamHome() {
  const employee = await getSessionEmployee()
  if (!employee) {
    redirect("/team/login")
  }

  const supabase = getCrewAdmin()

  // Deliberately no `price` in any of these selects. The crew sees their own
  // hours and pay on /team/me and never the customer's number.
  const JOB_COLS =
    "id, client_name, address, service_type, notes, status, field_status, appointment_date, appointment_time, completed_at, claimed_at"

  const [{ data: mine }, { data: board }, { data: me }, { data: segments }] = await Promise.all([
    supabase
      .from("squeegee_jobs")
      .select(JOB_COLS)
      .eq("assigned_employee_id", employee.id)
      .order("appointment_date", { ascending: true, nullsFirst: false })
      .limit(100),
    // The open board: scheduled work nobody has claimed. This is how a job
    // reaches the crew — no assignment step for Anthony to forget.
    //
    // Today forward only. There are scheduled jobs on the books months old that
    // were finished in the field and never closed out in the CRM; showing those
    // first buries the work that actually needs doing today. Stale rows are a
    // data-hygiene problem for Anthony, not a job for the crew.
    supabase
      .from("squeegee_jobs")
      .select(JOB_COLS)
      .eq("status", "scheduled")
      .is("assigned_employee_id", null)
      .gte("appointment_date", todayKey())
      .order("appointment_date", { ascending: true, nullsFirst: false })
      .limit(50),
    supabase
      .from("squeegee_employees")
      .select("onboarding_checklist, agreement_signed_at, onboarded_at")
      .eq("id", employee.id)
      .single(),
    supabase
      .from("squeegee_job_time")
      .select("kind, started_at, ended_at")
      .eq("employee_id", employee.id)
      .gte("started_at", weekStartIso()),
  ])

  const checklistState = (me?.onboarding_checklist as Record<string, boolean>) ?? {}
  const checklist: ChecklistItem[] = ONBOARDING_TASKS.map((t) => {
    let done = !!checklistState[t.key]
    if (t.auto) {
      if (t.key === "account") done = !!me?.onboarded_at
      else if (t.key === "agreement") done = !!me?.agreement_signed_at
    }
    return { key: t.key, label: t.label, detail: t.detail ?? null, auto: !!t.auto, done }
  })

  return (
    <TeamView
      employee={{ id: employee.id, name: employee.name }}
      mine={(mine ?? []) as CrewJob[]}
      board={(board ?? []) as CrewJob[]}
      checklist={checklist}
      today={todayKey()}
      weekMs={totalMs((segments ?? []) as { kind: "drive" | "work"; started_at: string; ended_at: string | null }[])}
    />
  )
}

/** Monday 00:00 ET, as an ISO instant — the week the crew thinks in. */
function weekStartIso(): string {
  const now = new Date()
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const dow = (et.getDay() + 6) % 7 // Monday = 0
  et.setDate(et.getDate() - dow)
  et.setHours(0, 0, 0, 0)
  return et.toISOString()
}
