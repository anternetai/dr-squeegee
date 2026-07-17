import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { SqueegeeJob, STATUS_LABELS, STATUS_ORDER, JobStatus } from "@/lib/squeegee/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Plus, Briefcase, CheckCircle2, Clock, DollarSign, ClipboardList,
  Eye, Users, TrendingUp, BarChart2,
} from "lucide-react"
import { formatDistanceToNow } from "@/lib/squeegee/utils"
import { AgingQuotes, type AgingItem } from "@/components/squeegee/aging-quotes"

const STATUS_COLORS: Record<JobStatus, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  quoted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  scheduled: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  complete: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
}

export default async function SqueegeePortalPage() {
  const supabase = await createClient()
  // squeegee_plans is service-role-only (zero RLS policies) — anon client returns nothing.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const d7  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: jobs },
    { count: views30 },
    { count: views7 },
    { count: leads30 },
    { count: leads7 },
    { count: totalLeads },
    { data: quotes },
    { data: pendingQuotes },
    { data: sentPlans },
  ] = await Promise.all([
    supabase.from("squeegee_jobs").select("*").order("created_at", { ascending: false }),
    supabase.from("squeegee_page_views").select("*", { count: "exact", head: true }).gte("created_at", d30),
    supabase.from("squeegee_page_views").select("*", { count: "exact", head: true }).gte("created_at", d7),
    supabase.from("squeegee_leads").select("*", { count: "exact", head: true }).gte("created_at", d30),
    supabase.from("squeegee_leads").select("*", { count: "exact", head: true }).gte("created_at", d7),
    supabase.from("squeegee_leads").select("*", { count: "exact", head: true }),
    supabase.from("squeegee_quotes").select("status").in("status", ["accepted", "declined"]),
    supabase
      .from("squeegee_quotes")
      .select("id, token, job_id, client_name, total_price, status, created_at")
      .in("status", ["pending", "help"])
      .order("created_at", { ascending: true }),
    admin
      .from("squeegee_plans")
      .select("id, token, client_name, plan_name, total_price, created_at")
      .eq("status", "sent")
      .order("created_at", { ascending: true }),
  ])

  const allJobs = (jobs || []) as SqueegeeJob[]

  const counts = STATUS_ORDER.reduce(
    (acc, status) => { acc[status] = allJobs.filter((j) => j.status === status).length; return acc },
    {} as Record<JobStatus, number>
  )

  const totalRevenue = allJobs
    .filter((j) => j.status === "complete")
    .reduce((sum, j) => sum + (j.price || 0), 0)

  const recentJobs = allJobs.slice(0, 8)

  const accepted = (quotes || []).filter((q) => q.status === "accepted").length
  const responded = (quotes || []).length
  const quoteAcceptRate = responded > 0 ? Math.round((accepted / responded) * 100) : null

  const allAging: AgingItem[] = [
    ...(pendingQuotes || []).map((q) => ({
      id: q.id as string,
      kind: "quote" as const,
      clientName: (q.client_name as string) || "Unknown",
      amount: Number(q.total_price) || 0,
      createdAt: q.created_at as string,
      publicPath: `/q/${q.token}`,
      // 5 legacy quotes have no job_id — fall back to the customer view instead of a 404
      crmPath: q.job_id ? `/crm/jobs/${q.job_id}` : `/q/${q.token}`,
      needsReply: q.status === "help",
      label: "Quote",
    })),
    ...(sentPlans || []).map((p) => ({
      id: p.id as string,
      kind: "plan" as const,
      clientName: (p.client_name as string) || "Unknown",
      amount: Number(p.total_price) || 0,
      createdAt: p.created_at as string,
      publicPath: `/a/${p.token}`,
      crmPath: `/crm/plans/${p.id}`,
      needsReply: false,
      label: (p.plan_name as string) || "Care plan",
    })),
  ]
  // 45-day winnable window, biggest money first; older pending = probably dead, just counted.
  const WINNABLE_MS = 45 * 24 * 60 * 60 * 1000
  const agingItems = allAging
    .filter((i) => Date.now() - new Date(i.createdAt).getTime() <= WINNABLE_MS)
    .sort((a, b) => b.amount - a.amount)
  const staleItems = allAging.filter((i) => Date.now() - new Date(i.createdAt).getTime() > WINNABLE_MS)
  const staleTotal = staleItems.reduce((sum, i) => sum + i.amount, 0)

  const conversionRate = (totalLeads || 0) > 0
    ? Math.round((allJobs.length / (totalLeads || 1)) * 100)
    : null

  const statsCards = [
    { label: "New",       count: counts.new,       icon: ClipboardList, color: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-900/20" },
    { label: "Quoted",    count: counts.quoted,    icon: DollarSign,    color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-900/20" },
    { label: "Approved",  count: counts.approved,  icon: Clock,         color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20" },
    { label: "Scheduled", count: counts.scheduled, icon: Briefcase,     color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
    { label: "Complete",  count: counts.complete,  icon: CheckCircle2,  color: "text-green-600 dark:text-green-400",   bg: "bg-green-50 dark:bg-green-900/20" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{allJobs.length} total job{allJobs.length !== 1 ? "s" : ""}</p>
        </div>
        <Button asChild className="bg-[#2D8C6F] hover:bg-[#1F6B54] text-white">
          <Link href="/crm/jobs/new"><Plus className="h-4 w-4 mr-2" />New Job</Link>
        </Button>
      </div>

      {/* Job status cards */}
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

      {/* Money waiting on a customer response */}
      <AgingQuotes items={agingItems} staleCount={staleItems.length} staleTotal={staleTotal} />

      {/* Analytics */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Site Analytics</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Page views */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-md bg-[#2D8C6F]/10">
                  <Eye className="h-4 w-4 text-[#2D8C6F]" />
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Page Views</p>
              </div>
              <p className="text-3xl font-bold">{(views30 ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-medium text-foreground">{(views7 ?? 0).toLocaleString()}</span> last 7 days · 30d total
              </p>
            </CardContent>
          </Card>

          {/* Leads */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-md bg-[#2D8C6F]/10">
                  <Users className="h-4 w-4 text-[#2D8C6F]" />
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Leads</p>
              </div>
              <p className="text-3xl font-bold">{(leads30 ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-medium text-foreground">{(leads7 ?? 0).toLocaleString()}</span> last 7 days · 30d total
              </p>
            </CardContent>
          </Card>

          {/* Quote acceptance */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-md bg-[#2D8C6F]/10">
                  <TrendingUp className="h-4 w-4 text-[#2D8C6F]" />
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quote Accept</p>
              </div>
              <p className="text-3xl font-bold">
                {quoteAcceptRate !== null ? `${quoteAcceptRate}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {responded > 0 ? `${accepted} of ${responded} responded` : "No responses yet"}
              </p>
            </CardContent>
          </Card>

          {/* Lead → Job conversion */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-md bg-[#2D8C6F]/10">
                  <BarChart2 className="h-4 w-4 text-[#2D8C6F]" />
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lead → Job</p>
              </div>
              <p className="text-3xl font-bold">
                {conversionRate !== null ? `${conversionRate}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {allJobs.length} jobs from {totalLeads ?? 0} leads
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Revenue */}
      <Card className="border-[#2D8C6F]/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Revenue from completed jobs</p>
              <p className="text-3xl font-bold text-[#2D8C6F]">
                ${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 rounded-full bg-[#E6F5F0] dark:bg-[#1F3D35]">
              <DollarSign className="h-6 w-6 text-[#2D8C6F]" />
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
              <Button asChild className="mt-4 bg-[#2D8C6F] hover:bg-[#1F6B54] text-white">
                <Link href="/crm/jobs/new"><Plus className="h-4 w-4 mr-2" />New Job</Link>
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
                      <span className="text-sm font-medium">${Number(job.price).toFixed(2)}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[job.status]}`}>
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
