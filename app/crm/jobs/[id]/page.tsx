import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
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

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

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

  // squeegee_employees is service-role only (RLS on, no policies) — the SSR
  // client above would read zero rows, so use a service-role client here.
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: crew } = await admin
    .from("squeegee_employees")
    .select("id, name")
    .eq("status", "active")
    .order("name")

  const assignedEmployeeId = (job as { assigned_employee_id?: string | null }).assigned_employee_id ?? null

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

      <JobDetailClient job={job} />
      <JobAssign jobId={job.id} employees={crew ?? []} current={assignedEmployeeId} />
      <JobInvoices job={job} quoteToken={latestQuote?.token ?? null} />
      <JobActivity jobId={job.id} />
    </div>
  )
}
