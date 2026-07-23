import { createClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { getSessionEmployee } from "@/lib/squeegee/employee-auth"
import { ONBOARDING_TASKS } from "@/lib/squeegee/company"
import { TeamView, type CrewJob, type ChecklistItem } from "./team-view"

export const dynamic = "force-dynamic"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function TeamHome() {
  const employee = await getSessionEmployee()
  if (!employee) {
    redirect("/team/login")
  }

  const supabase = getAdmin()
  const [{ data: jobs }, { data: me }] = await Promise.all([
    supabase
      .from("squeegee_jobs")
      .select("id, client_name, client_phone, address, service_type, notes, status, price, appointment_date, appointment_time, completed_at")
      .eq("assigned_employee_id", employee.id)
      .order("appointment_date", { ascending: true, nullsFirst: false })
      .limit(100),
    supabase
      .from("squeegee_employees")
      .select("onboarding_checklist, agreement_signed_at, onboarded_at")
      .eq("id", employee.id)
      .single(),
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
      jobs={(jobs ?? []) as CrewJob[]}
      checklist={checklist}
    />
  )
}
