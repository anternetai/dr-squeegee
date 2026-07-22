"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { MapPin, Phone, MessageSquare, CheckCircle2, LogOut, CalendarDays, Clock } from "lucide-react"

export interface CrewJob {
  id: string
  client_name: string
  client_phone: string | null
  address: string
  service_type: string
  notes: string | null
  status: string
  price: number | null
  appointment_date: string | null
  appointment_time: string | null
  completed_at: string | null
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function prettyDate(d: string | null): string {
  if (!d) return "Unscheduled"
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

function prettyTime(t: string | null): string | null {
  if (!t) return null
  const [h, m] = t.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const hr = h % 12 || 12
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`
}

export function TeamView({ employee, jobs: initial }: { employee: { id: string; name: string }; jobs: CrewJob[] }) {
  const router = useRouter()
  const [jobs, setJobs] = useState(initial)
  const first = employee.name.trim().split(/\s+/)[0]

  const { today, upcoming, done } = useMemo(() => {
    const tk = todayKey()
    const today: CrewJob[] = []
    const upcoming: CrewJob[] = []
    const done: CrewJob[] = []
    for (const j of jobs) {
      if (j.status === "complete") done.push(j)
      else if (j.appointment_date === tk) today.push(j)
      else upcoming.push(j)
    }
    return { today, upcoming, done }
  }, [jobs])

  async function logout() {
    await fetch("/api/team/auth/logout", { method: "POST" })
    router.push("/team/login")
    router.refresh()
  }

  function onDone(id: string) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: "complete", completed_at: new Date().toISOString() } : j)))
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-16">
      {/* Header */}
      <header className="flex items-center justify-between py-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#2D8C6F] font-semibold">Dr. Squeegee Crew</p>
          <h1 className="text-2xl font-bold">Hey, {first}</h1>
        </div>
        <button onClick={logout} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {jobs.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No jobs assigned yet.</p>
          <p className="text-sm mt-1">Anthony will assign your jobs here.</p>
        </div>
      )}

      {today.length > 0 && (
        <Section label={`Today · ${today.length}`}>
          {today.map((j) => <JobCard key={j.id} job={j} onDone={onDone} highlight />)}
        </Section>
      )}
      {upcoming.length > 0 && (
        <Section label={`Upcoming · ${upcoming.length}`}>
          {upcoming.map((j) => <JobCard key={j.id} job={j} onDone={onDone} />)}
        </Section>
      )}
      {done.length > 0 && (
        <Section label={`Done · ${done.length}`}>
          {done.map((j) => <JobCard key={j.id} job={j} onDone={onDone} />)}
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

function JobCard({ job, onDone, highlight }: { job: CrewJob; onDone: (id: string) => void; highlight?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [note, setNote] = useState("")
  const isDone = job.status === "complete"
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(job.address)}`
  const phone = job.client_phone?.replace(/[^0-9]/g, "")
  const time = prettyTime(job.appointment_time)

  async function markDone() {
    setBusy(true)
    const res = await fetch(`/api/team/jobs/${job.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note || null }),
    })
    setBusy(false)
    if (res.ok) {
      onDone(job.id)
      setConfirming(false)
    }
  }

  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-[#2D8C6F]/40 bg-[#2D8C6F]/[0.06]" : "border-[#242424] bg-[#111111]"} ${isDone ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-lg leading-tight">{job.client_name}</p>
          <p className="text-sm text-[#2D8C6F] font-medium">{job.service_type}</p>
        </div>
        <div className="text-right text-xs text-gray-400 shrink-0">
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{prettyDate(job.appointment_date)}</span>
          {time && <div className="inline-flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3" />{time}</div>}
        </div>
      </div>

      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-start gap-2 text-sm text-gray-300 hover:text-white">
        <MapPin className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
        <span className="underline decoration-gray-600 underline-offset-2">{job.address}</span>
      </a>

      {job.notes && <p className="mt-2 text-sm text-gray-400 bg-white/[0.03] rounded-lg px-3 py-2">{job.notes}</p>}

      {!isDone && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {phone ? (
            <>
              <a href={`tel:${phone}`} className="flex items-center justify-center gap-1.5 rounded-lg border border-[#242424] py-2 text-sm font-medium text-gray-200 hover:bg-white/5">
                <Phone className="h-4 w-4" /> Call
              </a>
              <a href={`sms:${phone}`} className="flex items-center justify-center gap-1.5 rounded-lg border border-[#242424] py-2 text-sm font-medium text-gray-200 hover:bg-white/5">
                <MessageSquare className="h-4 w-4" /> Text
              </a>
            </>
          ) : (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border border-[#242424] py-2 text-sm font-medium text-gray-200 hover:bg-white/5">
              <MapPin className="h-4 w-4" /> Directions
            </a>
          )}
        </div>
      )}

      {isDone ? (
        <div className="mt-3 flex items-center gap-1.5 text-sm text-[#2D8C6F] font-medium">
          <CheckCircle2 className="h-4 w-4" /> Completed
        </div>
      ) : confirming ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note for Anthony (optional)…"
            rows={2}
            className="w-full rounded-lg bg-[#0A0A0A] border border-[#242424] px-3 py-2 text-sm text-white outline-none focus:border-[#2D8C6F]"
          />
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)} className="flex-1 rounded-lg border border-[#242424] py-2.5 text-sm font-medium text-gray-300">
              Cancel
            </button>
            <button onClick={markDone} disabled={busy} className="flex-1 rounded-lg bg-[#2D8C6F] py-2.5 text-sm font-semibold text-white hover:bg-[#1F6B54] disabled:opacity-60">
              {busy ? "Saving…" : "Confirm done"}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} className="mt-3 w-full rounded-lg bg-[#2D8C6F] py-3 text-sm font-semibold text-white hover:bg-[#1F6B54] flex items-center justify-center gap-1.5">
          <CheckCircle2 className="h-4 w-4" /> Mark done
        </button>
      )}
    </div>
  )
}
