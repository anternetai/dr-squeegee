import { createClient } from "@/lib/supabase/server"
import { SqueegeeJob, STATUS_LABELS, STATUS_ORDER, JobStatus } from "@/lib/squeegee/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, Briefcase, CheckCircle2, Clock, DollarSign, ClipboardList } from "lucide-react"
import { formatDistanceToNow } from "@/lib/squeegee/utils"

const STATUS_COLORS: Record<JobStatus, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  quoted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  scheduled: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  complete: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
}

export default async function SqueegeePortalPage() {
  const supabase = await createClient()

  const { data: jobs } = await supabase
    .from("squeegee_jobs")
    .select("*")
    .order("created_at", { ascending: false })

  const allJobs = (jobs || []) as SqueegeeJob[]

  // Count by status
  const counts = STATUS_ORDER.reduce(
    (acc, status) => {
      acc[status] = allJobs.filter((j) => j.status === status).length
      return acc
    },
    {} as Record<JobStatus, number>
  )

  const totalRevenue = allJobs
    .filter((j) => j.status === "complete")
    .reduce((sum, j) => sum + (j.price || 0), 0)

  const recentJobs = allJobs.slice(0, 8)

  const statsCards = [
    {
      label: "New",
      count: counts.new,
      icon: ClipboardList,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "Quoted",
      count: counts.quoted,
      icon: DollarSign,
      color: "text-yellow-600 dark:text-yellow-400",
      bg: "bg-yellow-50 dark:bg-yellow-900/20",
    },
    {
      label: "Approved",
      count: counts.approved,
      icon: Clock,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      label: "Scheduled",
      count: counts.scheduled,
      icon: Briefcase,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
      label: "Complete",
      count: counts.complete,
      icon: CheckCircle2,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-900/20",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {allJobs.length} total job{allJobs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild className="bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white">
          <Link href="/crm/jobs/new">
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Link>
        </Button>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statsCards.map(({ label, count, icon: Icon, color, bg }) => (
          <Link key={label} href={`/crm/jobs?status=${label.toLowerCase()}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${bg}`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Revenue card */}
      <Card className="border-[#C8D8CE] dark:border-[#1E3E2B]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Revenue from completed jobs</p>
              <p className="text-3xl font-bold text-[#3A6B4C]">
                ${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 rounded-full bg-[#E8F0EA] dark:bg-[#152419]">
              <DollarSign className="h-6 w-6 text-[#3A6B4C]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/crm/jobs">View all</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recentJobs.length === 0 ? (
            <div className="px-6 py-8 text-center text-muted-foreground">
              <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No jobs yet. Create your first job to get started.</p>
              <Button asChild className="mt-4 bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white">
                <Link href="/crm/jobs/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Job
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/crm/jobs/${job.id}`}
                  className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{job.client_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {job.service_type} · {job.address}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    {job.price != null && (
                      <span className="text-sm font-medium">
                        ${Number(job.price).toFixed(2)}
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[job.status]}`}
                    >
                      {STATUS_LABELS[job.status]}
                    </span>
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {formatDistanceToNow(job.created_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
