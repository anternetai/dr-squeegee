import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { EmployeeEditor, type EmployeeDetail, type AssignedJob } from "./employee-editor"
import { CrewHealth } from "@/components/squeegee/crew-health"
import { CrewWorth, type WorthWindow } from "@/components/squeegee/crew-worth"
import {
  crewProfit,
  crewVerdict,
  jobBasePay,
  formatDuration,
  lockActive,
  relativeLabel,
  totalMs,
} from "@/lib/squeegee/crew"
import { loadSettings, DEFAULT_SETTINGS } from "@/lib/squeegee/settings"

export const dynamic = "force-dynamic"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function windowStart(window: WorthWindow): string | null {
  if (window === "all") return null
  const days = window === "30" ? 30 : 90
  return new Date(Date.now() - days * 864e5).toISOString()
}

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ window?: string }>
}) {
  const { id } = await params
  const { window: windowParam } = await searchParams
  const worthWindow: WorthWindow =
    windowParam === "30" || windowParam === "90" ? windowParam : "all"
  const supabase = getAdmin()

  const [{ data: employee }, { data: jobs }] = await Promise.all([
    supabase
      .from("squeegee_employees")
      .select(
        "id, created_at, name, legal_name, phone, email, role, status, pay_type, pay_rate, availability, address, emergency_contact_name, emergency_contact_phone, invite_token, agreement_signed_at, onboarded_at, last_login_at, notes, onboarding_checklist, can_contact_customers, pin_hash, pin_locked_until"
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

  // "Worth it?" — completed jobs in the window, and THEIR clock on those jobs.
  // This is the owner's surface, so it reads price; nothing here may ever be
  // selected under /team.
  const since = windowStart(worthWindow)
  let completedQuery = supabase
    .from("squeegee_jobs")
    .select("id, price, crew_pay, crew_tip")
    .eq("assigned_employee_id", id)
    .eq("status", "complete")
    .not("completed_at", "is", null)
  if (since) completedQuery = completedQuery.gte("completed_at", since)
  const { data: completedJobs } = await completedQuery

  const completed = (completedJobs ?? []) as {
    id: string
    price: number | null
    crew_pay: number | null
    crew_tip: number | null
  }[]

  // Their clock on exactly those jobs — not the week-to-date clock above, which
  // includes jobs outside the window. Work segments are "their hours"; drive +
  // work together are what an hourly crew member is paid for (same as /team/me).
  const { data: worthSegs } =
    completed.length > 0
      ? await supabase
          .from("squeegee_job_time")
          .select("job_id, kind, started_at, ended_at")
          .eq("employee_id", id)
          .in("job_id", completed.map((j) => j.id))
      : { data: [] as null | [] }
  const worthSegRows = (worthSegs ?? []) as {
    job_id: string
    kind: "drive" | "work"
    started_at: string
    ended_at: string | null
  }[]

  const settings = await loadSettings(supabase).catch(() => DEFAULT_SETTINGS)
  // (employee may still be null here; the not-found guard is below. A null row
  // just yields no base pay, which is what the panel shows for an unknown rate.)
  const payRow = employee as { pay_type?: string; pay_rate?: number | null } | null
  const payEmp = { pay_type: payRow?.pay_type ?? "", pay_rate: payRow?.pay_rate ?? null }
  const profit = crewProfit(
    completed.map((j) => ({
      price: j.price,
      // Base pay per job: typed override, else hours x rate for hourly crew.
      crew_pay: jobBasePay(payEmp, totalMs(worthSegRows.filter((s) => s.job_id === j.id)), j.crew_pay),
    })),
    totalMs(worthSegRows, "work")
  )
  const tips = Math.round(completed.reduce((sum, j) => sum + Number(j.crew_tip ?? 0), 0) * 100) / 100

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
      <EmployeeEditor employee={employeeSafe as EmployeeDetail} jobs={(jobs ?? []) as AssignedJob[]} hasPin={!!pin_hash} />
      <CrewWorth
        employeeId={id}
        firstName={(emp.name || "they").trim().split(/\s+/)[0]}
        window={worthWindow}
        profit={profit}
        verdict={crewVerdict(
          (emp.name || "they").trim().split(/\s+/)[0],
          profit.netPerHour,
          settings.soloRevenuePerHour
        )}
        soloPerHour={settings.soloRevenuePerHour}
        tips={tips}
      />
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
