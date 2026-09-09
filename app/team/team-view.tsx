"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  MapPin,
  CheckCircle2,
  CalendarDays,
  BookOpen,
  Circle,
  ChevronRight,
  Hand,
  User,
} from "lucide-react"
import { formatDuration } from "@/lib/squeegee/crew"

export interface CrewJob {
  id: string
  client_name: string
  address: string
  service_type: string
  notes: string | null
  status: string
  field_status: string | null
  appointment_date: string | null
  appointment_time: string | null
  completed_at: string | null
  claimed_at: string | null
}

export interface ChecklistItem {
  key: string
  label: string
  detail: string | null
  auto: boolean
  done: boolean
}

function prettyDate(d: string | null): string {
  if (!d) return "Unscheduled"
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

/**
 * Arrival as a WINDOW, not a single time. Jobs are 60-minute Cal.com slots, and a
 * range is the honest promise — every delivery app in the category landed on the
 * same choice for the same reason.
 */
export function arrivalWindow(t: string | null): string | null {
  if (!t) return null
  const [h, m] = t.split(":").map(Number)
  const fmt = (hh: number, mm: number) => {
    const ampm = hh >= 12 ? "PM" : "AM"
    const hr = hh % 12 || 12
    return `${hr}:${String(mm).padStart(2, "0")} ${ampm}`
  }
  return `${fmt(h, m)} - ${fmt((h + 1) % 24, m)}`
}

const CHIP: Record<string, { label: string; className: string }> = {
  on_my_way: { label: "On the way", className: "bg-[#2D8C6F]/15 text-[#4FC49E]" },
  in_progress: { label: "Working", className: "bg-[#2D8C6F]/15 text-[#4FC49E]" },
}

export function TeamView({
  employee,
  mine,
  board,
  checklist: initialChecklist,
  today,
  weekMs,
}: {
  employee: { id: string; name: string }
  mine: CrewJob[]
  board: CrewJob[]
  checklist: ChecklistItem[]
  today: string
  weekMs: number
}) {
  const [checklist, setChecklist] = useState(initialChecklist)
  const first = employee.name.trim().split(/\s+/)[0]

  const { todayJobs, upcoming, done } = useMemo(() => {
    const todayJobs: CrewJob[] = []
    const upcoming: CrewJob[] = []
    const done: CrewJob[] = []
    for (const j of mine) {
      if (j.status === "complete") done.push(j)
      else if (j.appointment_date === today) todayJobs.push(j)
      else upcoming.push(j)
    }
    return { todayJobs, upcoming, done }
  }, [mine, today])

  async function toggleTask(key: string, isDone: boolean) {
    setChecklist((prev) => prev.map((t) => (t.key === key ? { ...t, done: isDone } : t)))
    const res = await fetch("/api/team/checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, done: isDone }),
    })
    if (!res.ok) {
      setChecklist((prev) => prev.map((t) => (t.key === key ? { ...t, done: !isDone } : t)))
    }
  }

  const setupRemaining = checklist.filter((t) => !t.done).length
  const nothingAtAll = mine.length === 0 && board.length === 0

  return (
    <div className="mx-auto max-w-lg px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#2D8C6F] font-semibold">
            Dr. Squeegee Crew
          </p>
          <h1 className="text-2xl font-bold">Hey, {first}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/team/standards"
            className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5"
            aria-label="Standards"
          >
            <BookOpen className="h-5 w-5" />
          </Link>
          <Link
            href="/team/me"
            className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5"
            aria-label="My hours"
          >
            <User className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {setupRemaining > 0 && <SetupChecklist checklist={checklist} onToggle={toggleTask} />}

      {weekMs > 0 && (
        <Link
          href="/team/me"
          className="mb-6 flex items-center justify-between rounded-xl border border-[#242424] bg-[#111111] px-4 py-3 hover:border-[#2D8C6F]/40"
        >
          <span className="text-sm text-gray-400">This week</span>
          <span className="flex items-center gap-1 font-semibold">
            {formatDuration(weekMs)}
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </span>
        </Link>
      )}

      {nothingAtAll && (
        <div className="text-center py-20">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 text-gray-700" />
          <p className="font-semibold">No open jobs right now</p>
          <p className="text-sm text-gray-500 mt-1.5 max-w-[16rem] mx-auto">
            When Anthony schedules a job it shows up here for you to claim.
          </p>
        </div>
      )}

      {todayJobs.length > 0 && (
        <Section label={`Today · ${todayJobs.length}`}>
          {todayJobs.map((j) => (
            <JobCard key={j.id} job={j} highlight />
          ))}
        </Section>
      )}

      {board.length > 0 && (
        <Section label={`Open board · ${board.length}`}>
          <p className="-mt-1 mb-1 text-xs text-gray-500">
            Not assigned to anyone yet. Claim what you can run.
          </p>
          {board.map((j) => (
            <BoardCard key={j.id} job={j} />
          ))}
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section label={`Coming up · ${upcoming.length}`}>
          {upcoming.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </Section>
      )}

      {done.length > 0 && (
        <Section label={`Done · ${done.length}`}>
          {done.slice(0, 10).map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{label}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function CardShell({
  job,
  highlight,
  children,
}: {
  job: CrewJob
  highlight?: boolean
  children?: React.ReactNode
}) {
  const isDone = job.status === "complete"
  const chip = job.field_status ? CHIP[job.field_status] : null
  const window = arrivalWindow(job.appointment_time)

  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight ? "border-[#2D8C6F]/40 bg-[#2D8C6F]/[0.06]" : "border-[#242424] bg-[#111111]"
      } ${isDone ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-lg leading-tight">{job.client_name}</p>
          <p className="text-sm text-[#2D8C6F] font-medium">{job.service_type}</p>
        </div>
        <div className="text-right text-xs text-gray-400 shrink-0">
          <div>{prettyDate(job.appointment_date)}</div>
          {window && <div className="mt-0.5">{window}</div>}
        </div>
      </div>

      <p className="mt-3 flex items-start gap-2 text-sm text-gray-300">
        <MapPin className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
        <span>{job.address}</span>
      </p>

      {chip && (
        <span
          className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${chip.className}`}
        >
          {chip.label}
        </span>
      )}
      {isDone && (
        <span className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#2D8C6F] font-medium">
          <CheckCircle2 className="h-4 w-4" /> Completed
        </span>
      )}

      {children}
    </div>
  )
}

function JobCard({ job, highlight }: { job: CrewJob; highlight?: boolean }) {
  return (
    <Link href={`/team/jobs/${job.id}`} className="block active:opacity-80">
      <CardShell job={job} highlight={highlight}>
        <div className="mt-3 flex items-center justify-end text-sm font-medium text-[#2D8C6F]">
          Open job <ChevronRight className="h-4 w-4" />
        </div>
      </CardShell>
    </Link>
  )
}

function BoardCard({ job }: { job: CrewJob }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function claim() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/team/jobs/${job.id}/claim`, { method: "POST" })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      // Losing a race is normal, not an error state to panic about — say who got
      // it in plain words and refresh the board underneath them.
      setError(data.error ?? "Could not claim it.")
      router.refresh()
      return
    }
    router.push(`/team/jobs/${job.id}`)
    router.refresh()
  }

  return (
    <CardShell job={job}>
      {job.notes && (
        <p className="mt-2 text-sm text-gray-400 bg-white/[0.03] rounded-lg px-3 py-2">
          {job.notes}
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm text-[#E5776B]" role="alert">
          {error}
        </p>
      )}
      <button
        onClick={claim}
        disabled={busy}
        className="mt-3 w-full rounded-xl bg-[#2D8C6F] py-3.5 text-base font-semibold text-white hover:bg-[#1F6B54] disabled:opacity-60 flex items-center justify-center gap-2"
      >
        <Hand className="h-4 w-4" />
        {busy ? "Claiming…" : "I've got this one"}
      </button>
    </CardShell>
  )
}

function SetupChecklist({
  checklist,
  onToggle,
}: {
  checklist: ChecklistItem[]
  onToggle: (key: string, done: boolean) => void
}) {
  const done = checklist.filter((t) => t.done).length
  return (
    <div className="mb-6 rounded-2xl border border-[#2D8C6F]/40 bg-[#2D8C6F]/[0.06] p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Finish getting set up</h2>
        <span className="text-xs text-gray-400">
          {done}/{checklist.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {checklist.map((t) => {
          const clickable = !t.auto
          return (
            <button
              key={t.key}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onToggle(t.key, !t.done)}
              className={`w-full flex items-start gap-3 rounded-lg px-2 py-2 text-left ${
                clickable ? "hover:bg-white/5" : "cursor-default"
              }`}
            >
              {t.done ? (
                <CheckCircle2 className="h-5 w-5 text-[#2D8C6F] shrink-0 mt-0.5" />
              ) : (
                <Circle className="h-5 w-5 text-gray-600 shrink-0 mt-0.5" />
              )}
              <span className="min-w-0">
                <span
                  className={`text-sm font-medium ${
                    t.done ? "text-gray-500 line-through" : "text-white"
                  }`}
                >
                  {t.label}
                </span>
                {t.detail && !t.done && (
                  <span className="block text-xs text-gray-400 mt-0.5">{t.detail}</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
