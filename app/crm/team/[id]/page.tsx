import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { EmployeeEditor, type EmployeeDetail, type AssignedJob } from "./employee-editor"
import { CrewHealth } from "@/components/squeegee/crew-health"
import { formatDuration, lockActive, relativeLabel, totalMs } from "@/lib/squeegee/crew"

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
        "id, created_at, name, legal_name, phone, email, role, status, pay_type, pay_rate, availability, address, emergency_contact_name, emergency_contact_phone, invite_token, agreement_signed_at, onboarded_at, last_login_at, notes, onboarding_checklist, pin_hash, pin_locked_until"
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

  // Week-to-date clock, any timer still running, and push health. Each of these
  // fails silently otherwise.
  const monday = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }))
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)

  const [{ data: segments }, { data: openSegs }, { data: subs }] = await Promise.all([
    supabase
      .from("squeegee_job_time")
      .select("kind, started_at, ended_at")
      .eq("employee_id", id)
      .gte("started_at", monday.toISOString()),
    supabase
      .from("squeegee_job_time")
      .select("started_at, job_id")
      .eq("employee_id", id)
      .is("ended_at", null)
      .limit(1),
    supabase
      .from("squeegee_push_subscriptions")
      .select("last_success_at, failure_count")
      .eq("employee_id", id),
  ])

  const segs = (segments ?? []) as {
    kind: "drive" | "work"
    started_at: string
    ended_at: string | null
  }[]

  const open = (openSegs ?? [])[0] as { started_at: string; job_id: string } | undefined
  const openJob = open
    ? (jobs ?? []).find((j) => (j as AssignedJob).id === open.job_id)
    : undefined

  const subRows = (subs ?? []) as { last_success_at: string | null; failure_count: number }[]
  const lastSuccess = subRows
    .map((s) => s.last_success_at)
    .filter(Boolean)
    .sort()
    .pop() as string | undefined

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

  const emp = employee as EmployeeDetail & {
    pin_hash: string | null
    pin_locked_until: string | null
  }

  // EmployeeEditor is a client component, so whatever object it receives is
  // serialized into the page payload -- the *runtime* object, not the narrower
  // EmployeeDetail type it's cast to. Strip the PIN columns off before the prop
  // or the scrypt hash ships to the browser, where a 4-digit PIN is 10,000
  // candidates to test offline. CrewHealth below only ever gets the derived
  // booleans, which is the shape everything in the CRM should use.
  const { pin_hash, pin_locked_until, ...employeeSafe } = emp

  // Built before the JSX, using server-side helpers: these read the clock, and
  // reading it during render is what React's purity rule forbids.
  const openSegmentProp = open
    ? {
        jobLabel: (openJob as AssignedJob | undefined)?.client_name ?? "a job",
        sinceLabel: relativeLabel(open.started_at),
      }
    : null
  const pushProp = {
    devices: subRows.length,
    lastSuccessLabel: lastSuccess ? relativeLabel(lastSuccess) : null,
    failures: subRows.filter((s) => s.failure_count > 0).length,
  }
  const lockedProp = lockActive(pin_locked_until)

  return (
    <div className="space-y-5">
      <EmployeeEditor employee={employeeSafe as EmployeeDetail} jobs={(jobs ?? []) as AssignedJob[]} />
      <CrewHealth
        employeeId={id}
        weekWorkLabel={formatDuration(totalMs(segs, "work"))}
        weekDriveLabel={formatDuration(totalMs(segs, "drive"))}
        openSegment={openSegmentProp}
        push={pushProp}
        hasPin={!!pin_hash}
        locked={lockedProp}
      />
    </div>
  )
}
