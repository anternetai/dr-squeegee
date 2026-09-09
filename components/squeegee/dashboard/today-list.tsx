"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, MapPin, Send } from "lucide-react"
import { Section, List, Empty } from "./section"
import { money } from "@/lib/crm/status"

/* The day-of controls that used to live on /crm/ops (Command Center): assign
   a crew member, send the reminder text. They belong next to the job, on the
   one screen Anthony opens in the truck. */

export interface TodayCrew {
  id: string
  name: string
}

export interface TodayJob {
  id: string
  clientName: string
  clientPhone: string | null
  address: string
  serviceType: string
  /** "today" | "tomorrow" */
  day: "today" | "tomorrow"
  timeLabel: string | null
  amount: number | null
  assignedEmployeeId: string | null
  reminded: boolean
  /** Scheduled with a date, but the job row never got to "scheduled" (approved + date). */
  softScheduled: boolean
}

function firstName(n: string): string {
  return (n || "there").trim().split(/\s+/)[0]
}

export function TodayList({
  jobs,
  crew,
  unclaimedCount,
}: {
  jobs: TodayJob[]
  crew: TodayCrew[]
  unclaimedCount: number
}) {
  const [rows, setRows] = useState(jobs)
  const [busy, setBusy] = useState<string | null>(null)
  const [sent, setSent] = useState<Record<string, boolean>>({})

  const load: Record<string, number> = {}
  for (const j of rows) if (j.assignedEmployeeId) load[j.assignedEmployeeId] = (load[j.assignedEmployeeId] ?? 0) + 1
  const loadLine =
    crew.length > 0
      ? crew.map((c) => `${firstName(c.name)} ${load[c.id] ?? 0}`).join(" · ") +
        (unclaimedCount > 0 ? ` · ${unclaimedCount} unclaimed` : "")
      : null

  async function assign(jobId: string, employeeId: string) {
    setBusy(jobId)
    const res = await fetch(`/api/squeegee/jobs/${jobId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: employeeId || null }),
    })
    setBusy(null)
    if (res.ok) {
      setRows((prev) => prev.map((j) => (j.id === jobId ? { ...j, assignedEmployeeId: employeeId || null } : j)))
    }
  }

  async function remind(j: TodayJob) {
    if (!j.clientPhone) return
    const key = `remind-${j.id}`
    setBusy(key)
    const when = j.day === "today" ? "today" : "tomorrow"
    const at = j.timeLabel ? ` at ${j.timeLabel}` : ""
    const body = `Dr. Squeegee: Hi ${firstName(j.clientName)}, reminder - we're scheduled for your ${j.serviceType.toLowerCase()} ${when}${at}. Reply YES to confirm or call (704) 286-9696 to reschedule.`
    const res = await fetch("/api/crm/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: j.clientPhone, body, kind: "reminder", force: true }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (data.ok) setSent((s) => ({ ...s, [key]: true }))
  }

  const today = rows.filter((j) => j.day === "today")
  const tomorrow = rows.filter((j) => j.day === "tomorrow")

  return (
    <Section
      id="today"
      title="Today & tomorrow"
      aside={rows.length > 0 ? `${rows.length} ${rows.length === 1 ? "job" : "jobs"}` : undefined}
      href="/crm/calendar"
      hrefLabel="Calendar"
    >
      {rows.length === 0 ? (
        <Empty>Nothing on the calendar today or tomorrow.</Empty>
      ) : (
        <List>
          {[...today, ...tomorrow].map((j, i) => {
            const firstTomorrow = j.day === "tomorrow" && (i === 0 || rows[i - 1]?.day !== "tomorrow")
            const key = `remind-${j.id}`
            const reminded = sent[key] || j.reminded
            return (
              <div key={j.id}>
                {firstTomorrow && today.length > 0 && (
                  <div className="bg-[var(--crm-surface-high)] px-4 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--crm-text-faint)]">
                    Tomorrow
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <Link href={`/crm/jobs/${j.id}`} className="min-w-0 flex-1 basis-40">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{j.clientName}</span>
                      <span className="crm-numeral shrink-0 text-xs text-[var(--crm-text-dim)]">
                        {j.timeLabel ?? "no time"}
                      </span>
                      {j.softScheduled && (
                        <span className="shrink-0 rounded-full bg-[var(--crm-attention-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--crm-attention)]">
                          not booked
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-[var(--crm-text-faint)]">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {j.serviceType} · {j.address}
                    </p>
                  </Link>
                  {j.amount != null && (
                    <span className="crm-numeral shrink-0 text-sm">{money(j.amount)}</span>
                  )}
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      value={j.assignedEmployeeId ?? ""}
                      disabled={busy === j.id || crew.length === 0}
                      onChange={(e) => assign(j.id, e.target.value)}
                      aria-label="Assign crew"
                      className="max-w-[120px] rounded-lg border border-[var(--crm-line)] bg-[var(--crm-ground)] px-2 py-1.5 text-xs outline-none focus:border-[var(--crm-accent)]"
                    >
                      <option value="">Unassigned</option>
                      {crew.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => remind(j)}
                      disabled={!j.clientPhone || busy === key || reminded}
                      title={reminded ? "Reminder sent" : "Send reminder text"}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        reminded
                          ? "border-[var(--crm-accent-line)] text-[var(--crm-accent)]"
                          : "border-[var(--crm-line)] hover:border-[var(--crm-accent)] disabled:opacity-40"
                      }`}
                    >
                      {reminded ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Reminded
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" /> Remind
                        </>
                      )}
                    </button>
                    {/* Decision 2: one-tap Done & Paid on any job row. Today's
                        work settles the day it happens, not tomorrow when the
                        appointment has passed and it drops into the tray. */}
                    <Link
                      href={`/crm/jobs/${j.id}?closeout=1`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--crm-accent)] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--crm-accent-hover)]"
                    >
                      Done &amp; paid
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </List>
      )}
      {loadLine && (
        <p className="mt-2 px-1 text-xs text-[var(--crm-text-faint)]">
          Crew: {loadLine} ·{" "}
          <Link href="/crm/team" className="text-[var(--crm-accent)] hover:underline">
            Crew page
          </Link>
        </p>
      )}
    </Section>
  )
}
