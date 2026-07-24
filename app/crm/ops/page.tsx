import { createClient } from "@supabase/supabase-js"
import { OpsView, type OpsJob, type OpsVisit, type OpsCrew, type OpsSms } from "./ops-view"

export const dynamic = "force-dynamic"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function plusDaysISO(n: number): string {
  const d = new Date(Date.now() + n * 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default async function OpsPage() {
  const supabase = getAdmin()
  const today = todayISO()
  const in21 = plusDaysISO(21)

  const [{ data: crew }, { data: jobs }, { data: visits }, { data: sms }] = await Promise.all([
    supabase.from("squeegee_employees").select("id, name, status").eq("status", "active").order("name"),
    supabase
      .from("squeegee_jobs")
      .select("id, client_name, client_phone, address, service_type, status, appointment_date, appointment_time, assigned_employee_id, reminder_sent_at")
      .in("status", ["approved", "scheduled"])
      .order("appointment_date", { ascending: true, nullsFirst: true })
      .limit(80),
    supabase
      .from("squeegee_plan_visits")
      .select("id, service_name, scheduled_date, status, reminder_sent_at, squeegee_plans!inner(client_name, client_phone, plan_name)")
      .eq("status", "scheduled")
      .gte("scheduled_date", today)
      .lte("scheduled_date", in21)
      .order("scheduled_date", { ascending: true })
      .limit(60),
    supabase
      .from("sms_messages")
      .select("id, created_at, direction, phone10, kind, status, body, was_test")
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  const crewList = (crew ?? []) as OpsCrew[]
  const crewName = new Map(crewList.map((c) => [c.id, c.name]))

  const jobRows: OpsJob[] = (jobs ?? []).map((j) => ({
    id: j.id as string,
    client_name: j.client_name as string,
    client_phone: (j.client_phone as string | null) ?? null,
    address: j.address as string,
    service_type: j.service_type as string,
    status: j.status as string,
    appointment_date: (j.appointment_date as string | null) ?? null,
    appointment_time: (j.appointment_time as string | null) ?? null,
    assigned_employee_id: (j.assigned_employee_id as string | null) ?? null,
    assigned_name: j.assigned_employee_id ? (crewName.get(j.assigned_employee_id as string) ?? null) : null,
    reminded: !!j.reminder_sent_at,
  }))

  const visitRows: OpsVisit[] = (visits ?? []).map((v) => {
    const rel = (v as unknown as { squeegee_plans: { client_name: string; client_phone: string | null; plan_name: string } | { client_name: string; client_phone: string | null; plan_name: string }[] }).squeegee_plans
    const plan = Array.isArray(rel) ? rel[0] : rel
    return {
      id: v.id as string,
      service_name: v.service_name as string,
      scheduled_date: v.scheduled_date as string,
      client_name: plan?.client_name ?? "",
      client_phone: plan?.client_phone ?? null,
      plan_name: plan?.plan_name ?? "",
      reminded: !!v.reminder_sent_at,
    }
  })

  const smsRows: OpsSms[] = (sms ?? []).map((s) => ({
    id: s.id as string,
    created_at: s.created_at as string,
    direction: s.direction as string,
    phone10: s.phone10 as string,
    kind: (s.kind as string | null) ?? "",
    status: s.status as string,
    body: s.body as string,
    was_test: !!s.was_test,
  }))

  return <OpsView crew={crewList} jobs={jobRows} visits={visitRows} sms={smsRows} today={today} />
}
