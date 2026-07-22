import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { EmployeeEditor, type EmployeeDetail, type AssignedJob } from "./employee-editor"

export const dynamic = "force-dynamic"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = getAdmin()

  const [{ data: employee }, { data: jobs }] = await Promise.all([
    supabase
      .from("squeegee_employees")
      .select(
        "id, created_at, name, phone, email, role, status, pay_type, pay_rate, availability, address, emergency_contact_name, emergency_contact_phone, invite_token, agreement_signed_at, onboarded_at, last_login_at, notes"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("squeegee_jobs")
      .select("id, client_name, address, service_type, status, appointment_date, appointment_time")
      .eq("assigned_employee_id", id)
      .order("appointment_date", { ascending: true, nullsFirst: false })
      .limit(50),
  ])

  if (!employee) {
    return (
      <div className="space-y-4">
        <Link href="/crm/team" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Team
        </Link>
        <p className="text-muted-foreground">Crew member not found.</p>
      </div>
    )
  }

  return (
    <EmployeeEditor
      employee={employee as EmployeeDetail}
      jobs={(jobs ?? []) as AssignedJob[]}
    />
  )
}
