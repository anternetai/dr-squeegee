import { createClient } from "@/lib/supabase/server"
import { SqueegeeJob, STATUS_LABELS, STATUS_ORDER, JobStatus } from "@/lib/squeegee/types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, Briefcase } from "lucide-react"
import { JobsFilterBar } from "@/components/squeegee/jobs-filter-bar"

const STATUS_COLORS: Record<JobStatus, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  quoted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  scheduled: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  complete: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
}

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function JobsPage({ searchParams }: PageProps) {
  const { status } = await searchParams

  let allJobs: SqueegeeJob[] = []
  let fetchError: string | null = null

  try {
    const supabase = await createClient()

    let query = supabase
      .from("squeegee_jobs")
      .select("*")
      .order("created_at", { ascending: false })

    if (status && STATUS_ORDER.includes(status as JobStatus)) {
      query = query.eq("status", status)
    }

    const { data: jobs, error } = await query
    if (error) {
      fetchError = error.message
    } else {
      allJobs = (jobs || []) as SqueegeeJob[]
    }
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Unknown error"
  }

  return (
    <div className="space-y-5">
      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
          Error loading jobs: {fetchError}
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            {allJobs.length} job{allJobs.length !== 1 ? "s" : ""}
            {status ? ` · ${STATUS_LABELS[status as JobStatus]}` : ""}
          </p>
        </div>
        <Button asChild className="bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white">
          <Link href="/crm/jobs/new">
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Link>
        </Button>
      </div>

      {/* Filter bar */}
      <JobsFilterBar activeStatus={status} />

      {/* Jobs list */}
      {allJobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No jobs found{status ? ` with status "${STATUS_LABELS[status as JobStatus]}"` : ""}.</p>
            <Button asChild className="mt-4 bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white">
              <Link href="/crm/jobs/new">
                <Plus className="h-4 w-4 mr-2" />
                New Job
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Table — desktop */}
          <div className="hidden md:block">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Address</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Service</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allJobs.map((job) => (
                      <tr
                        key={job.id}
                        className="hover:bg-muted/40 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <Link href={`/crm/jobs/${job.id}`} className="block">
                            <span className="font-medium">{job.client_name}</span>
                          </Link>
                          {job.client_phone && (
                            <a
                              href={`sms:${job.client_phone.replace(/[^\d+]/g, "")}`}
                              className="block text-xs text-[#3A6B4C] hover:underline"
                            >
                              {job.client_phone}
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">
                          <Link href={`/crm/jobs/${job.id}`} className="block">
                            {job.address}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/crm/jobs/${job.id}`} className="block">
                            {job.service_type === "Pending Quote" ? <span className="text-muted-foreground italic">Pending Quote</span> : job.service_type}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/crm/jobs/${job.id}`} className="block">
                            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[job.status]}`}>
                              {STATUS_LABELS[job.status]}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          <Link href={`/crm/jobs/${job.id}`} className="block">
                            {job.appointment_date
                              ? new Date(job.appointment_date + "T00:00:00").toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : new Date(job.created_at).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          <Link href={`/crm/jobs/${job.id}`} className="block">
                            {job.price != null ? `$${Number(job.price).toFixed(2)}` : "—"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Cards — mobile */}
          <div className="md:hidden space-y-3">
            {allJobs.map((job) => (
              <Link key={job.id} href={`/crm/jobs/${job.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{job.client_name}</p>
                        <p className="text-xs text-muted-foreground">{job.service_type === "Pending Quote" ? "Pending Quote" : job.service_type}</p>
                      </div>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[job.status]}`}>
                        {STATUS_LABELS[job.status]}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{job.address}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        {new Date(job.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {job.price != null && (
                        <span className="font-semibold text-sm">${Number(job.price).toFixed(2)}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
