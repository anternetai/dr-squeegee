import { createClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { getSessionEmployee } from "@/lib/squeegee/employee-auth"
import { TeamView, type CrewJob } from "./team-view"

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
  const { data: jobs } = await supabase
    .from("squeegee_jobs")
    .select("id, client_name, client_phone, address, service_type, notes, status, price, appointment_date, appointment_time, completed_at")
    .eq("assigned_employee_id", employee.id)
    .order("appointment_date", { ascending: true, nullsFirst: false })
    .limit(100)

  return <TeamView employee={{ id: employee.id, name: employee.name }} jobs={(jobs ?? []) as CrewJob[]} />
}
