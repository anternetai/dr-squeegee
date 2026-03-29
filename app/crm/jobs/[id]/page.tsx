import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { SqueegeeJob } from "@/lib/squeegee/types"
import { JobDetailClient } from "@/components/squeegee/job-detail-client"
import { JobInvoices } from "@/components/squeegee/job-invoices"
import { JobActivity } from "@/components/squeegee/job-activity"
import { QuoteBuilder } from "@/components/squeegee/quote-builder"
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
      <QuoteBuilder job={job} />
      <JobInvoices job={job} />
      <JobActivity jobId={job.id} />
    </div>
  )
}
