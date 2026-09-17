import { createClient } from "@supabase/supabase-js"
import { notFound } from "next/navigation"
import { SqueegeeJob } from "@/lib/squeegee/types"
import { JobDetailClient } from "@/components/squeegee/job-detail-client"
import { JobInvoices } from "@/components/squeegee/job-invoices"
import { JobActivity } from "@/components/squeegee/job-activity"
import { JobAssign } from "@/components/squeegee/job-assign"
import { JobCrewWork, type CrewAlert, type CrewPhoto } from "@/components/squeegee/job-crew-work"
import { formatDuration, jobBasePay, signPhotos, totalMs } from "@/lib/squeegee/crew"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

interface PageProps {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

// Service-role: the CRM is gated by the signed crm_auth cookie in middleware,
// not by a Supabase session, so these queries have no authenticated identity.
// Reading them through the anon key is what forced RLS open to anon.
function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = getAdmin()

  const { data, error } = await supabase
    .from("squeegee_jobs")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !data) notFound()

  const job = data as SqueegeeJob

  // Latest quote token — the branded /q page is the ONLY customer-facing
  // payment URL (embedded pay card w/ Apple Pay lives there).
  const { data: latestQuote } = await supabase
    .from("squeegee_quotes")
    .select("token")
    .eq("job_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: crew } = await supabase
    .from("squeegee_employees")
    .select("id, name, pay_type, pay_rate")
    .eq("status", "active")
    .order("name")

  const assignedEmployeeId = job.assigned_employee_id ?? null

  // A finished job is a different screen than a live one. Once the work is done
  // and paid there is nothing left to quote, confirm, crew or delete — the only
  // thing left to do is ask for the review. Everything else is noise on the way
  // to it, so the page hides it rather than making Anthony scroll past it.
  const { data: paidInvoice } = await supabase
    .from("squeegee_invoices")
    .select("id, receipt_token")
    .eq("job_id", id)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const isPaid = Boolean(paidInvoice)
  const isDone = job.status === "complete" || isPaid

  // What the crew did on this job: the clock (driven by their status taps) and
  // the before/afters, each awaiting Anthony's call on customer visibility.
  const [{ data: photoRows }, { data: segments }, { data: alertRows }] = await Promise.all([
    supabase
      .from("squeegee_job_photos")
      .select("id, kind, storage_path, customer_visible, created_at")
      .eq("job_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("squeegee_job_time").select("kind, started_at, ended_at, employee_id").eq("job_id", id),
    // The crew's status taps text Anthony, not the customer. These rows are the
    // record of what he answered — service-role, like everything else here.
    supabase
      .from("squeegee_crew_alerts")
      .select("id, kind, status, eta_minutes, created_at, acted_at")
      .eq("job_id", id)
      .order("created_at", { ascending: true }),
  ])

  const rows = (photoRows ?? []) as {
    id: string
    kind: string
    storage_path: string
    customer_visible: boolean
  }[]
  const signed = await signPhotos(supabase, rows.map((r) => r.storage_path))
  const crewPhotos: CrewPhoto[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind as "before" | "after",
    url: signed[r.storage_path] ?? null,
    customer_visible: r.customer_visible,
  }))

  const segs = (segments ?? []) as {
    kind: "drive" | "work"
    started_at: string
    ended_at: string | null
    employee_id: string | null
  }[]
  const workMs = totalMs(segs, "work")
  const driveMs = totalMs(segs, "drive")
  const assigned = (crew ?? []).find((c) => c.id === assignedEmployeeId) ?? null
  const assignedName = assigned?.name ?? null

  // Base pay fills itself in for an hourly crew member: THEIR clock on this job
  // (drive + on-site, same as /team/me) times their rate. Anthony only types a
  // number to override it, or for per-job pay.
  const theirMs = assignedEmployeeId
    ? totalMs(segs.filter((s) => s.employee_id === assignedEmployeeId))
    : 0
  const autoBase =
    assigned && assigned.pay_type === "hourly" && assigned.pay_rate != null
      ? {
          amount: jobBasePay(assigned, theirMs, null) ?? 0,
          hours: Math.round((theirMs / 3_600_000) * 100) / 100,
          rate: Number(assigned.pay_rate),
        }
      : null

  // Server-only env — read here and pass down rather than exposing it publicly.
  const reviewUrl = process.env.GOOGLE_REVIEW_URL ?? null

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/crm/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Jobs
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{job.client_name}</h1>
            <p className="text-sm text-muted-foreground">
              {job.service_type && job.service_type !== "Pending Quote" ? `${job.service_type} · ` : ""}{job.address}
            </p>
          </div>
        </div>
      </div>

      <JobDetailClient
        job={job}
        isDone={isDone}
        isPaid={isPaid}
        reviewUrl={reviewUrl}
        receiptToken={paidInvoice?.receipt_token ?? null}
      />
      {/* Crew assignment is for work that still has to happen; crew PAY is usually
          entered after it happened. So the card stays on a finished job with the
          assignee locked and only the pay field live. */}
      {(!isDone || assignedEmployeeId) && (
        <JobAssign
          jobId={job.id}
          employees={crew ?? []}
          current={assignedEmployeeId}
          crewPay={job.crew_pay ?? null}
          crewTip={job.crew_tip ?? null}
          autoBase={autoBase}
          assignLocked={isDone}
        />
      )}
      <JobCrewWork
        crewName={assignedName}
        fieldStatus={job.field_status ?? null}
        claimedAt={job.claimed_at ?? null}
        completedAt={job.completed_at ?? null}
        driveLabel={driveMs > 0 ? formatDuration(driveMs) : null}
        workLabel={workMs > 0 ? formatDuration(workMs) : null}
        photos={crewPhotos}
        alerts={(alertRows ?? []) as CrewAlert[]}
      />
      <JobInvoices job={job} quoteToken={latestQuote?.token ?? null} />
      <JobActivity jobId={job.id} />
    </div>
  )
}
