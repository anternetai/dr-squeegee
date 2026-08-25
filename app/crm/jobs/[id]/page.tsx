import { createClient } from "@supabase/supabase-js"
import { notFound } from "next/navigation"
import { SqueegeeJob } from "@/lib/squeegee/types"
import { JobDetailClient } from "@/components/squeegee/job-detail-client"
import { JobInvoices } from "@/components/squeegee/job-invoices"
import { JobActivity } from "@/components/squeegee/job-activity"
import { JobAssign } from "@/components/squeegee/job-assign"
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
    .select("id, name")
    .eq("status", "active")
    .order("name")

  const assignedEmployeeId = (job as { assigned_employee_id?: string | null }).assigned_employee_id ?? null

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
      {/* Crew assignment is for work that still has to happen. */}
      {!isDone && <JobAssign jobId={job.id} employees={crew ?? []} current={assignedEmployeeId} />}
      <JobInvoices job={job} quoteToken={latestQuote?.token ?? null} />
      <JobActivity jobId={job.id} />
    </div>
  )
}
