import { createClient } from "@supabase/supabase-js"
import { SqueegeeJob, STATUS_LABELS, STATUS_ORDER, JobStatus } from "@/lib/squeegee/types"
import Link from "next/link"
import { Plus, Briefcase } from "lucide-react"
import { CountTabs } from "@/components/squeegee/crm/stat-tile"
import { statusClass, money } from "@/lib/crm/status"

export const dynamic = "force-dynamic"

// Service-role: the CRM is gated by the signed crm_auth cookie in middleware,
// not by a Supabase session, so these queries have no authenticated identity.
function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function JobsPage({ searchParams }: PageProps) {
  const { status } = await searchParams
  const active = STATUS_ORDER.includes(status as JobStatus) ? (status as JobStatus) : null

  let allJobs: SqueegeeJob[] = []
  let fetchError: string | null = null

  try {
    // Fetch every job and filter in memory: it is ~50 rows, and it means the
    // status tabs can carry live counts instead of being blind links.
    const { data, error } = await getAdmin()
      .from("squeegee_jobs")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) fetchError = error.message
    else allJobs = (data || []) as SqueegeeJob[]
  } catch (e) {
    fetchError = e instanceof Error ? e.message : "Unknown error"
  }

  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = allJobs.filter((j) => j.status === s).length
    return acc
  }, {} as Record<JobStatus, number>)

  const jobs = active ? allJobs.filter((j) => j.status === active) : allJobs
  const shown = jobs.reduce((sum, j) => sum + (Number(j.price) || 0), 0)

  return (
    <div className="space-y-5">
      {fetchError && (
        <div className="rounded-xl border border-[var(--crm-dead-bg)] bg-[var(--crm-dead-bg)] px-4 py-3 text-sm text-[var(--crm-dead)]">
          Error loading jobs: {fetchError}
        </div>
      )}

      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Jobs</h2>
          <p className="mt-0.5 text-sm text-[var(--crm-text-dim)]">
            {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
            {active ? ` · ${STATUS_LABELS[active]}` : ""}
            {shown > 0 && <> · <span className="text-[var(--crm-accent)]">{money(shown)}</span></>}
          </p>
        </div>
        <Link
          href="/crm/quotes/new"
          className="flex shrink-0 items-center gap-2 rounded-lg bg-[var(--crm-accent)] px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--crm-accent-hover)]"
        >
          <Plus className="h-4 w-4" />
          New quote
        </Link>
      </div>

      <CountTabs
        items={[
          { label: "All", count: allJobs.length, href: "/crm/jobs", active: !active },
          ...STATUS_ORDER.map((s) => ({
            label: STATUS_LABELS[s],
            count: counts[s],
            href: `/crm/jobs?status=${s}`,
            active: active === s,
          })),
        ]}
      />

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--crm-line)] px-4 py-12 text-center">
          <Briefcase className="mx-auto h-6 w-6 text-[var(--crm-text-faint)]" />
          <p className="mt-2 text-sm text-[var(--crm-text-dim)]">
            No jobs{active ? ` marked ${STATUS_LABELS[active].toLowerCase()}` : ""} yet.
          </p>
          <Link
            href="/crm/quotes/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--crm-accent)] px-4 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> New quote
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-[var(--crm-line)] bg-[var(--crm-surface)] md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--crm-line)]">
                    {["Client", "Address", "Service", "Status", "Date"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--crm-text-faint)]"
                      >
                        {h}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-[var(--crm-text-faint)]">
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--crm-line)]">
                  {jobs.map((job) => (
                    <tr key={job.id} className="transition-colors hover:bg-[var(--crm-surface-high)]">
                      <td className="px-4 py-3">
                        <Link href={`/crm/jobs/${job.id}`} className="font-medium">
                          {job.client_name}
                        </Link>
                        {job.client_phone && (
                          <a
                            href={`sms:${job.client_phone.replace(/[^\d+]/g, "")}`}
                            className="block text-xs text-[var(--crm-accent)] hover:underline"
                          >
                            {job.client_phone}
                          </a>
                        )}
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-[var(--crm-text-dim)]">
                        <Link href={`/crm/jobs/${job.id}`} className="block truncate">
                          {job.address}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/crm/jobs/${job.id}`} className="block">
                          {job.service_type === "Pending Quote" ? (
                            <span className="text-[var(--crm-text-faint)]">Pending quote</span>
                          ) : (
                            job.service_type
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/crm/jobs/${job.id}`} className="block">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass(job.status)}`}
                          >
                            {STATUS_LABELS[job.status]}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--crm-text-faint)]">
                        <Link href={`/crm/jobs/${job.id}`} className="block">
                          {job.appointment_date
                            ? shortDate(job.appointment_date + "T00:00:00")
                            : shortDate(job.created_at)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/crm/jobs/${job.id}`} className="crm-numeral block">
                          {job.price != null ? money(Number(job.price)) : "—"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile list */}
          <div className="divide-y divide-[var(--crm-line)] overflow-hidden rounded-xl border border-[var(--crm-line)] bg-[var(--crm-surface)] md:hidden">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/crm/jobs/${job.id}`}
                className="block px-4 py-3 transition-colors active:bg-[var(--crm-surface-high)]"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{job.client_name}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass(job.status)}`}
                  >
                    {STATUS_LABELS[job.status]}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-[var(--crm-text-faint)]">
                  {job.service_type === "Pending Quote" ? "Pending quote" : job.service_type} · {job.address}
                </p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-xs text-[var(--crm-text-faint)]">
                    {job.appointment_date
                      ? shortDate(job.appointment_date + "T00:00:00")
                      : shortDate(job.created_at)}
                  </span>
                  {job.price != null && (
                    <span className="crm-numeral text-sm">{money(Number(job.price))}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
