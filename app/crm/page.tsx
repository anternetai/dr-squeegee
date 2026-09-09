import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import { Plus, Briefcase, FileText } from "lucide-react"
import { STATUS_LABELS, STATUS_ORDER, type JobStatus } from "@/lib/squeegee/types"
import { StatTile, CountTabs } from "@/components/squeegee/crm/stat-tile"
import { statusClass, money } from "@/lib/crm/status"
import { formatDistanceToNow } from "@/lib/squeegee/utils"
import { AgingQuotes, type AgingItem } from "@/components/squeegee/aging-quotes"
import { NeedsScheduling, type NeedsSchedulingItem } from "@/components/squeegee/needs-scheduling"
import { UnclaimedJobs, type UnclaimedJobItem } from "@/components/squeegee/unclaimed-jobs"
import { TodayList, type TodayJob, type TodayCrew } from "@/components/squeegee/dashboard/today-list"
import { CloseoutTray } from "@/components/squeegee/dashboard/closeout-tray"
import { DueList, type DueRow } from "@/components/squeegee/dashboard/due-list"
import {
  loadSnapshot,
  indexSnapshot,
  jobStates,
  computeClientMetrics,
  computeRevenue,
  rangeForPreset,
  isLiveQuote,
  OPEN_QUOTE_STATUSES,
  STALE_QUOTE_DAYS,
  type PipelineState,
} from "@/lib/squeegee/metrics"
import { loadSettings, DEFAULT_SETTINGS } from "@/lib/squeegee/settings"
import { computeAllOffers } from "@/lib/squeegee/offers"
import { todayET, daysBetweenET } from "@/lib/squeegee/dates"

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

/* ---------------------------------------------------------------------------
   The one screen Anthony opens in the truck.

   Every list here is DERIVED from the strongest signal the data carries (a paid
   invoice beats a completion beats an appointment beats a quote's own status),
   through lib/squeegee/metrics. That is what stops "Waiting on a yes" from
   listing jobs that were done and paid weeks ago: a quote only counts as
   waiting while its job is genuinely still at the quote stage.

   Order: what makes money today (close-out tray) sits above what is still
   future money (quotes), and the day's jobs sit at the top because that is
   what he is driving to.
--------------------------------------------------------------------------- */

const OPEN_FOR_QUOTE: PipelineState[] = ["waiting_on_yes", "needs_quote"]

function prettyTime(t: string | null): string | null {
  if (!t) return null
  const [h, m] = t.split(":").map(Number)
  if (Number.isNaN(h)) return null
  const ampm = h >= 12 ? "PM" : "AM"
  return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${ampm}`
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`
}

export default async function SqueegeePortalPage() {
  const supabase = getAdmin()
  const now = new Date()
  const today = todayET(now)
  const tomorrow = addDaysYmd(today, 1)
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    snap,
    settings,
    { data: crewRows },
    { count: views30 },
    { count: leads30 },
    { count: leads7 },
    { count: totalLeads },
    { data: sentPlans },
    { data: remindedRows },
  ] = await Promise.all([
    loadSnapshot(supabase),
    // A bad settings row must never take the home screen down.
    loadSettings(supabase).catch(() => DEFAULT_SETTINGS),
    supabase.from("squeegee_employees").select("id, name").eq("status", "active").order("name"),
    supabase.from("squeegee_page_views").select("*", { count: "exact", head: true }).gte("created_at", d30),
    supabase.from("squeegee_leads").select("*", { count: "exact", head: true }).gte("created_at", d30),
    supabase.from("squeegee_leads").select("*", { count: "exact", head: true }).gte("created_at", d7),
    supabase.from("squeegee_leads").select("*", { count: "exact", head: true }),
    supabase
      .from("squeegee_plans")
      .select("id, token, client_name, plan_name, total_price, created_at")
      .eq("status", "sent")
      .order("created_at", { ascending: true }),
    // /api/cron/reminders texts tomorrow's jobs at 5pm ET and stamps
    // reminder_sent_at. Without reading it back the Remind button comes up live
    // again on the next page load and the customer gets a second text.
    supabase
      .from("squeegee_jobs")
      .select("id")
      .not("reminder_sent_at", "is", null)
      .in("appointment_date", [today, tomorrow]),
  ])

  const idx = indexSnapshot(snap)
  const states = jobStates(snap, idx)
  const stateByJob = new Map(states.map((s) => [s.job.id, s]))
  const metrics = computeClientMetrics(snap, idx)
  const rev = computeRevenue(snap, rangeForPreset("this_month", now), { now, idx, clientMetrics: metrics })
  const crew: TodayCrew[] = ((crewRows ?? []) as { id: string; name: string }[]).map((c) => ({ id: c.id, name: c.name }))

  const live = states.filter((s) => s.state !== "excluded")
  const remindedJobIds = new Set(((remindedRows ?? []) as { id: string }[]).map((r) => r.id))

  // Pipeline tabs: counts by the job's own status (the /crm/jobs tabs filter on it).
  const counts = STATUS_ORDER.reduce(
    (acc, status) => {
      acc[status] = live.filter((s) => s.job.status === status).length
      return acc
    },
    {} as Record<JobStatus, number>
  )

  // ---- Today & tomorrow ---------------------------------------------------
  const todayJobs: TodayJob[] = live
    .filter((s) => s.state === "scheduled" && (s.job.appointment_date === today || s.job.appointment_date === tomorrow))
    .sort((a, b) => {
      const da = `${a.job.appointment_date}T${a.job.appointment_time ?? "23:59"}`
      const db = `${b.job.appointment_date}T${b.job.appointment_time ?? "23:59"}`
      return da < db ? -1 : 1
    })
    .map((s) => ({
      id: s.job.id,
      clientName: s.job.client_name,
      clientPhone: s.job.client_phone,
      address: s.job.address ?? "",
      serviceType: s.job.service_type ?? "Service",
      day: s.job.appointment_date === today ? "today" : "tomorrow",
      timeLabel: prettyTime(s.job.appointment_time),
      amount: s.closeOutAmount,
      assignedEmployeeId: s.job.assigned_employee_id,
      reminded: remindedJobIds.has(s.job.id),
      softScheduled: s.job.status !== "scheduled",
    }))

  // Claim-pool safety net: scheduled work nobody has claimed, inside 24 hours.
  const unclaimedItems: UnclaimedJobItem[] = live
    .filter((s) => s.job.status === "scheduled" && !s.job.assigned_employee_id && s.job.appointment_date)
    .map((s) => {
      const at = new Date(`${s.job.appointment_date}T${(s.job.appointment_time ?? "08:00").slice(0, 5)}:00`)
      const hoursOut = Math.round((at.getTime() - now.getTime()) / 3_600_000)
      return {
        id: s.job.id,
        clientName: s.job.client_name,
        serviceType: s.job.service_type ?? "Service",
        whenLabel: at.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }),
        hoursOut,
      }
    })
    .filter((j) => j.hoursOut <= 24 && j.hoursOut >= -24)
    .sort((a, b) => a.hoursOut - b.hoursOut)

  // ---- Waiting on a yes: only quotes whose job is genuinely still at the quote stage
  const openQuotes = snap.quotes.filter((q) => {
    if (!isLiveQuote(q) || !OPEN_QUOTE_STATUSES.has(q.status)) return false
    if (!q.job_id) return true
    const st = stateByJob.get(q.job_id)?.state
    return !!st && OPEN_FOR_QUOTE.includes(st)
  })
  // Quotes still "pending" on jobs that already moved on: a data-health row, not a lead.
  const stuckQuotes = snap.quotes.filter((q) => {
    if (!isLiveQuote(q) || !OPEN_QUOTE_STATUSES.has(q.status) || !q.job_id) return false
    const st = stateByJob.get(q.job_id)?.state
    return !!st && st !== "excluded" && !OPEN_FOR_QUOTE.includes(st)
  })

  const allAging: AgingItem[] = [
    ...openQuotes.map((q) => ({
      id: q.id,
      kind: "quote" as const,
      clientName: q.client_name || "Unknown",
      amount: q.total_price ?? 0,
      createdAt: q.created_at,
      publicPath: `/q/${q.token}`,
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
  const agingItems = allAging
    .filter((i) => daysBetweenET(i.createdAt, today) <= STALE_QUOTE_DAYS)
    .sort((a, b) => b.amount - a.amount)
  const staleItems = allAging.filter((i) => daysBetweenET(i.createdAt, today) > STALE_QUOTE_DAYS)
  const staleTotal = staleItems.reduce((sum, i) => sum + i.amount, 0)
  const agingTotal = agingItems.reduce((sum, i) => sum + i.amount, 0)

  // ---- Needs scheduling: won, no date. Oldest first.
  const needsSchedulingItems: NeedsSchedulingItem[] = live
    .filter((s) => s.state === "needs_scheduling")
    .sort((a, b) => (a.job.created_at < b.job.created_at ? -1 : 1))
    .map((s) => ({
      id: s.job.id,
      clientName: s.job.client_name,
      serviceType: s.job.service_type ?? "Service",
      amount: s.closeOutAmount,
      createdAt: s.job.created_at,
    }))

  // ---- Due for service: each client's top offer, ranked
  const offers = computeAllOffers(metrics, snap, settings.cadenceMonths, now)
  const dueRows: DueRow[] = []
  let dueCount = 0
  for (const [clientId, list] of offers) {
    if (list.some((o) => o.kind === "due" && (o.overdueDays ?? -1) >= 0)) dueCount += 1
    const top = list[0]
    if (!top) continue
    const m = metrics.get(clientId)
    if (!m) continue
    dueRows.push({ clientId, clientName: m.name, offer: top })
  }
  dueRows.sort((a, b) => b.offer.priority - a.offer.priority)
  const dueTop = dueRows.slice(0, 5)

  const recentJobs = live
    .map((s) => s.job)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 8)

  // ---- The money sentence: three clauses, each a link, zero clauses dropped.
  const clauses: { text: string; href: string; tone: "accent" | "attention" | "dim" }[] = []
  if (rev.collected > 0) clauses.push({ text: `${money(rev.collected)} collected this month`, href: "/crm/revenue", tone: "accent" })
  if (rev.awaitingCloseout.count > 0)
    clauses.push({
      text: `${money(rev.awaitingCloseout.amount)} sitting in ${rev.awaitingCloseout.count} ${rev.awaitingCloseout.count === 1 ? "job" : "jobs"} you haven't closed out`,
      href: "#closeout",
      tone: "attention",
    })
  if (agingTotal > 0)
    clauses.push({
      text: `${money(agingTotal)} waiting on a yes across ${agingItems.length} ${agingItems.length === 1 ? "quote" : "quotes"}`,
      href: "#waiting",
      tone: "dim",
    })

  const winPct = rev.winRate.winRate !== null ? `${Math.round(rev.winRate.winRate * 100)}%` : "—"

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
          {clauses.length === 0 ? (
            <>Nothing waiting on a customer and nothing waiting on you. {live.length} jobs total.</>
          ) : (
            clauses.map((c, i) => (
              <span key={c.href}>
                {i > 0 && " · "}
                <Link
                  href={c.href}
                  className={
                    c.tone === "accent"
                      ? "text-[var(--crm-accent)] hover:underline"
                      : c.tone === "attention"
                        ? "text-[var(--crm-attention)] hover:underline"
                        : "hover:underline"
                  }
                >
                  {c.text}
                </Link>
              </span>
            ))
          )}
        </p>
      </div>

      {/* Nobody is holding this job and it starts soon. Most urgent thing here. */}
      <UnclaimedJobs items={unclaimedItems} />

      {/* The day's work, with the day-of controls (assign, remind) next to each job. */}
      <TodayList jobs={todayJobs} crew={crew} unclaimedCount={unclaimedItems.length} />

      {/* Work already done that is not counted as money yet. */}
      <CloseoutTray items={rev.awaitingCloseout.items} total={rev.awaitingCloseout.amount} />

      {/* Money waiting on a customer response — derived, so paid work never shows here. */}
      <div id="waiting" className="scroll-mt-20">
        <AgingQuotes
          items={agingItems}
          staleCount={staleItems.length}
          staleTotal={staleTotal}
          stuckCount={stuckQuotes.length}
        />
      </div>

      {/* Won, no date. */}
      <div id="scheduling" className="scroll-mt-20">
        <NeedsScheduling items={needsSchedulingItems} />
      </div>

      {/* Who to call next. */}
      <DueList rows={dueTop} dueCount={dueCount} />

      {/* Pipeline: one control that both counts and filters. */}
      <CountTabs
        items={STATUS_ORDER.map((status) => ({
          label: STATUS_LABELS[status],
          count: counts[status],
          href: `/crm/jobs?status=${status}`,
        }))}
      />

      {/* Numbers. Collected leads because it is the only one that is money. */}
      <div id="numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/crm/revenue" className="block">
          <StatTile
            label="Collected this month"
            value={money(rev.collected)}
            qualifier={`${rev.paidCount} paid · ${money(rev.tips)} tips`}
            tone="accent"
          />
        </Link>
        <Link href="#closeout" className="block">
          <StatTile
            label="Awaiting close-out"
            value={money(rev.awaitingCloseout.amount)}
            qualifier={`${rev.awaitingCloseout.count} ${rev.awaitingCloseout.count === 1 ? "job" : "jobs"}`}
            tone={rev.awaitingCloseout.count > 0 ? "attention" : "neutral"}
          />
        </Link>
        <StatTile
          label="Quote win rate"
          value={winPct}
          qualifier={
            rev.winRate.n > 0
              ? `${rev.winRate.accepted} of ${rev.winRate.n} answered${
                  rev.winRate.bookedRate !== null ? ` · ${Math.round(rev.winRate.bookedRate * 100)}% booked` : ""
                }`
              : "no answers yet"
          }
        />
        <StatTile
          label="Web leads"
          value={(leads30 ?? 0).toLocaleString()}
          qualifier={`${(leads7 ?? 0).toLocaleString()} last 7d · ${totalLeads ?? 0} ever · ${(views30 ?? 0).toLocaleString()} views`}
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
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass(job.status as JobStatus)}`}
                    >
                      {STATUS_LABELS[job.status as JobStatus] ?? job.status}
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
