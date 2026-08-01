import { createClient } from "@supabase/supabase-js"
import { SqueegeeJob, STATUS_LABELS, STATUS_ORDER, JobStatus } from "@/lib/squeegee/types"
import Link from "next/link"
import { Plus, Briefcase, FileText } from "lucide-react"
import { StatTile, CountTabs } from "@/components/squeegee/crm/stat-tile"
import { statusClass, money } from "@/lib/crm/status"
import { formatDistanceToNow } from "@/lib/squeegee/utils"
import { AgingQuotes, type AgingItem } from "@/components/squeegee/aging-quotes"
import { NeedsScheduling, type NeedsSchedulingItem } from "@/components/squeegee/needs-scheduling"

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

export default async function SqueegeePortalPage() {
  const supabase = getAdmin()

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
    supabase
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

  // Approved jobs with no appointment date yet — the "actually schedule
  // people" enforcement tray. Oldest first (longest-waiting job first).
  const needsSchedulingItems: NeedsSchedulingItem[] = allJobs
    .filter((j) => j.status === "approved" && !j.appointment_date)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((j) => ({
      id: j.id,
      clientName: j.client_name,
      serviceType: j.service_type,
      amount: j.price != null ? Number(j.price) : null,
      createdAt: j.created_at,
    }))

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

  const agingTotal = agingItems.reduce((sum, i) => sum + i.amount, 0)

  // The one sentence worth reading first: what is owed to you, and what is
  // sitting on you. Everything below is detail for these two numbers.
  const headline: string[] = []
  if (agingTotal > 0) {
    headline.push(
      `${money(agingTotal)} is waiting on a yes across ${agingItems.length} ${
        agingItems.length === 1 ? "quote" : "quotes"
      }`
    )
  }
  if (needsSchedulingItems.length > 0) {
    headline.push(
      `${needsSchedulingItems.length} approved ${
        needsSchedulingItems.length === 1 ? "job has" : "jobs have"
      } no date yet`
    )
  }

  return (
    <div className="space-y-6">
      {/* Primary action — big, thumb-reachable, first thing on the screen the
          home-screen shortcut opens. This is the one flow: client + quote + job. */}
      <Link
        href="/crm/quotes/new"
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[var(--crm-accent)] text-base font-semibold text-white transition-colors hover:bg-[var(--crm-accent-hover)]"
      >
        <Plus className="h-5 w-5" />
        New client
      </Link>

      {/* Header — the money sentence, not a wall of tiles. */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Dashboard</h2>
        <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
          {headline.length > 0 ? (
            <>
              <span className="text-[var(--crm-attention)]">{headline[0]}</span>
              {headline[1] && <> · {headline[1]}</>}
            </>
          ) : (
            <>Nothing waiting on a customer and nothing waiting on you. {allJobs.length} jobs total.</>
          )}
        </p>
      </div>

      {/* Pipeline: one control that both counts and filters. */}
      <CountTabs
        items={STATUS_ORDER.map((status) => ({
          label: STATUS_LABELS[status],
          count: counts[status],
          href: `/crm/jobs?status=${status}`,
        }))}
      />

      {/* Money waiting on a customer response */}
      <AgingQuotes items={agingItems} staleCount={staleItems.length} staleTotal={staleTotal} />

      {/* Approved jobs sitting with no appointment booked */}
      <NeedsScheduling items={needsSchedulingItems} />

      {/* Numbers. Revenue leads because it is the only one that is money. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Revenue"
          value={money(totalRevenue)}
          qualifier={`${counts.complete} completed`}
          tone="accent"
        />
        <StatTile
          label="Quote accept"
          value={quoteAcceptRate !== null ? `${quoteAcceptRate}%` : "—"}
          qualifier={responded > 0 ? `${accepted} of ${responded} answered` : "no answers yet"}
        />
        <StatTile
          label="Page views"
          value={(views30 ?? 0).toLocaleString()}
          qualifier={`${(views7 ?? 0).toLocaleString()} last 7d`}
        />
        <StatTile
          label="Web leads"
          value={(leads30 ?? 0).toLocaleString()}
          qualifier={`${(leads7 ?? 0).toLocaleString()} last 7d · ${totalLeads ?? 0} ever`}
        />
      </div>

      {/* Recent activity */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--crm-text-faint)]">
            Recent activity
          </h3>
          <Link href="/crm/jobs" className="text-xs text-[var(--crm-accent)] hover:underline">
            View all
          </Link>
        </div>

        {recentJobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--crm-line)] px-4 py-10 text-center">
            <Briefcase className="mx-auto h-6 w-6 text-[var(--crm-text-faint)]" />
            <p className="mt-2 text-sm text-[var(--crm-text-dim)]">
              No jobs yet. Create your first quote to get started.
            </p>
            <Link
              href="/crm/quotes/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--crm-accent)] px-4 py-2 text-sm font-medium text-white"
            >
              <FileText className="h-4 w-4" /> New quote
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[var(--crm-line)] overflow-hidden rounded-xl border border-[var(--crm-line)] bg-[var(--crm-surface)]">
            {recentJobs.map((job) => (
              <Link
                key={job.id}
                href={`/crm/jobs/${job.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--crm-surface-high)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{job.client_name}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass(job.status)}`}
                    >
                      {STATUS_LABELS[job.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--crm-text-faint)]">
                    {job.service_type} · {job.address}
                  </p>
                </div>

                {job.price != null && (
                  <span className="crm-numeral shrink-0 text-sm">{money(Number(job.price))}</span>
                )}
                <span className="hidden shrink-0 text-xs text-[var(--crm-text-faint)] sm:block">
                  {formatDistanceToNow(job.created_at)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
