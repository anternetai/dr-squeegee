import { createClient } from "@supabase/supabase-js"
import { TeamManager, type CrewRow } from "./team-manager"

export const dynamic = "force-dynamic"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function TeamPage() {
  const supabase = getAdmin()

  const [{ data: employees }, { data: openJobs }] = await Promise.all([
    supabase
      .from("squeegee_employees")
      .select(
        "id, created_at, name, phone, email, role, status, pay_type, pay_rate, invite_token, onboarded_at, last_login_at"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("squeegee_jobs")
      .select("assigned_employee_id")
      .neq("status", "complete")
      .not("assigned_employee_id", "is", null),
  ])

  // Count open jobs per crew member.
  const jobCounts: Record<string, number> = {}
  for (const j of openJobs ?? []) {
    const eid = (j as { assigned_employee_id: string }).assigned_employee_id
    jobCounts[eid] = (jobCounts[eid] ?? 0) + 1
  }

  const rows: CrewRow[] = (employees ?? []).map((e) => ({
    ...(e as Omit<CrewRow, "openJobs">),
    openJobs: jobCounts[(e as { id: string }).id] ?? 0,
  }))

  return <TeamManager initial={rows} />
}
