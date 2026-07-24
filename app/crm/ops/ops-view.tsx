"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Gauge, HardHat, CalendarRange, MessageSquare, AlertTriangle, Send, Check,
  MapPin, Clock, Briefcase, CalendarClock,
} from "lucide-react"

export interface OpsCrew { id: string; name: string; status: string }
export interface OpsJob {
  id: string; client_name: string; client_phone: string | null; address: string
  service_type: string; status: string; appointment_date: string | null
  appointment_time: string | null; assigned_employee_id: string | null
  assigned_name: string | null; reminded: boolean
}
export interface OpsVisit {
  id: string; service_name: string; scheduled_date: string; client_name: string
  client_phone: string | null; plan_name: string; reminded: boolean
}
export interface OpsSms {
  id: string; created_at: string; direction: string; phone10: string
  kind: string; status: string; body: string; was_test: boolean
}

function prettyDate(d: string | null): string {
  if (!d) return "Unscheduled"
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}
function prettyTime(t: string | null): string | null {
  if (!t) return null
  const [h, m] = t.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${ampm}`
}
function firstName(n: string): string { return (n || "there").trim().split(/\s+/)[0] }

export function OpsView({
  crew, jobs, visits, sms, today,
}: {
  crew: OpsCrew[]; jobs: OpsJob[]; visits: OpsVisit[]; sms: OpsSms[]; today: string
}) {
  const router = useRouter()
  const [jobState, setJobState] = useState(jobs)
  const [busy, setBusy] = useState<string | null>(null)
  const [sent, setSent] = useState<Record<string, boolean>>({})

  const unassigned = jobState.filter((j) => j.status === "scheduled" && !j.assigned_employee_id)
  const unscheduled = jobState.filter((j) => j.status === "approved" && !j.appointment_date)
  const scheduled = jobState.filter((j) => j.appointment_date).sort((a, b) => (a.appointment_date! < b.appointment_date! ? -1 : 1))
  const jobsByCrew: Record<string, number> = {}
  for (const j of jobState) if (j.assigned_employee_id && j.status !== "complete") jobsByCrew[j.assigned_employee_id] = (jobsByCrew[j.assigned_employee_id] ?? 0) + 1

  async function assign(jobId: string, employeeId: string) {
    setBusy(jobId)
    const res = await fetch(`/api/squeegee/jobs/${jobId}/assign`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: employeeId || null }),
    })
    setBusy(null)
    if (res.ok) {
      setJobState((prev) => prev.map((j) => j.id === jobId ? { ...j, assigned_employee_id: employeeId || null, assigned_name: employeeId ? (crew.find((c) => c.id === employeeId)?.name ?? null) : null } : j))
    }
  }

  async function sendReminder(key: string, phone: string | null, name: string, service: string, when: string) {
    if (!phone) return
    setBusy(key)
    const body = `Dr. Squeegee: Hi ${firstName(name)}, reminder — we're scheduled for your ${service.toLowerCase()} ${when}. Reply YES to confirm or call (704) 286-9696 to reschedule.`
    const res = await fetch("/api/crm/sms/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, body, kind: "reminder", force: true }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (data.ok) setSent((s) => ({ ...s, [key]: true }))
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Gauge className="h-6 w-6 text-[#2D8C6F]" /> Command Center</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Everything on the board — crew, the week, care-plan visits, texts.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Active crew" value={crew.length} icon={<HardHat className="h-4 w-4" />} href="/crm/team" />
        <Kpi label="Needs crew" value={unassigned.length} icon={<AlertTriangle className="h-4 w-4" />} tone={unassigned.length ? "amber" : undefined} />
        <Kpi label="Needs scheduling" value={unscheduled.length} icon={<CalendarClock className="h-4 w-4" />} tone={unscheduled.length ? "amber" : undefined} />
        <Kpi label="Plan visits (21d)" value={visits.length} icon={<CalendarRange className="h-4 w-4" />} />
      </div>

      {/* Needs attention */}
      {(unassigned.length > 0 || unscheduled.length > 0) && (
        <Section title="Needs attention" icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
          {unscheduled.map((j) => (
            <Row key={j.id}>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{j.client_name} <span className="text-muted-foreground font-normal">· {j.service_type}</span></p>
                <p className="text-xs text-amber-600">Approved — no date set</p>
              </div>
              <Link href={`/crm/jobs/${j.id}`} className="text-sm text-[#2D8C6F] hover:underline shrink-0">Schedule →</Link>
            </Row>
          ))}
          {unassigned.map((j) => (
            <Row key={j.id}>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{j.client_name} <span className="text-muted-foreground font-normal">· {prettyDate(j.appointment_date)}</span></p>
                <p className="text-xs text-amber-600">Scheduled — no crew assigned</p>
              </div>
              <AssignSelect crew={crew} value="" busy={busy === j.id} onChange={(v) => assign(j.id, v)} />
            </Row>
          ))}
        </Section>
      )}

      {/* Upcoming jobs */}
      <Section title="Scheduled jobs" icon={<Briefcase className="h-4 w-4 text-[#2D8C6F]" />}>
        {scheduled.length === 0 && <Empty>No scheduled jobs.</Empty>}
        {scheduled.map((j) => {
          const when = j.appointment_date === today ? "today" : `on ${prettyDate(j.appointment_date)}`
          const key = `job-${j.id}`
          return (
            <Row key={j.id}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{j.client_name}</span>
                  <span className="text-xs text-muted-foreground">{prettyDate(j.appointment_date)}{prettyTime(j.appointment_time) ? ` · ${prettyTime(j.appointment_time)}` : ""}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><MapPin className="h-3 w-3" />{j.service_type} · {j.address}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <AssignSelect crew={crew} value={j.assigned_employee_id ?? ""} busy={busy === j.id} onChange={(v) => assign(j.id, v)} />
                <ReminderBtn
                  disabled={!j.client_phone || busy === key}
                  done={sent[key] || j.reminded}
                  onClick={() => sendReminder(key, j.client_phone, j.client_name, j.service_type, when)}
                />
              </div>
            </Row>
          )
        })}
      </Section>

      {/* Care-plan visits */}
      <Section title="Care-plan visits" icon={<CalendarRange className="h-4 w-4 text-[#2D8C6F]" />}>
        {visits.length === 0 && <Empty>No upcoming plan visits in the next 21 days.</Empty>}
        {visits.map((v) => {
          const key = `visit-${v.id}`
          return (
            <Row key={v.id}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{v.client_name}</span>
                  <span className="text-xs text-muted-foreground">{prettyDate(v.scheduled_date)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{v.service_name} · {v.plan_name}</p>
              </div>
              <ReminderBtn
                disabled={!v.client_phone || busy === key}
                done={sent[key] || v.reminded}
                onClick={() => sendReminder(key, v.client_phone, v.client_name, v.service_name, `on ${prettyDate(v.scheduled_date)}`)}
              />
            </Row>
          )
        })}
      </Section>

      {/* Crew load */}
      <Section title="Crew load" icon={<HardHat className="h-4 w-4 text-[#2D8C6F]" />}>
        {crew.length === 0 && <Empty>No active crew. <Link href="/crm/team" className="text-[#2D8C6F] hover:underline">Add someone →</Link></Empty>}
        {crew.map((c) => (
          <Row key={c.id}>
            <Link href={`/crm/team/${c.id}`} className="font-medium hover:text-[#2D8C6F]">{c.name}</Link>
            <span className="text-sm text-muted-foreground">{jobsByCrew[c.id] ?? 0} open {(jobsByCrew[c.id] ?? 0) === 1 ? "job" : "jobs"}</span>
          </Row>
        ))}
      </Section>

      {/* Recent texts */}
      <Section title="Recent texts" icon={<MessageSquare className="h-4 w-4 text-[#2D8C6F]" />}>
        {sms.length === 0 && <Empty>No texts yet.</Empty>}
        {sms.map((s) => (
          <div key={s.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="flex items-center gap-1.5">
                <span className={s.direction === "inbound" ? "text-blue-500" : "text-[#2D8C6F]"}>{s.direction === "inbound" ? "◀ in" : "▶ out"}</span>
                <span>•••-{s.phone10.slice(-4)}</span>
                {s.kind && <span className="px-1.5 py-0.5 rounded bg-muted">{s.kind}</span>}
                <StatusPill status={s.status} test={s.was_test} />
              </span>
              <span>{new Date(s.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{s.body}</p>
          </div>
        ))}
      </Section>
    </div>
  )
}

function Kpi({ label, value, icon, tone, href }: { label: string; value: number; icon: React.ReactNode; tone?: "amber"; href?: string }) {
  const inner = (
    <div className={`rounded-xl border p-3 ${tone === "amber" ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tone === "amber" ? "text-amber-600" : ""}`}>{value}</div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold flex items-center gap-1.5">{icon}{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-card px-3 py-2.5 flex items-center gap-3">{children}</div>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground px-1">{children}</p>
}

function AssignSelect({ crew, value, busy, onChange }: { crew: OpsCrew[]; value: string; busy: boolean; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      disabled={busy || crew.length === 0}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-[#2D8C6F] max-w-[130px]"
    >
      <option value="">Unassigned</option>
      {crew.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  )
}

function ReminderBtn({ disabled, done, onClick }: { disabled: boolean; done: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || done}
      title={done ? "Reminder sent" : "Send reminder text"}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium shrink-0 transition-colors ${
        done ? "border-[#2D8C6F]/40 text-[#2D8C6F]" : "border-border hover:border-[#2D8C6F] disabled:opacity-40"
      }`}
    >
      {done ? <><Check className="h-3.5 w-3.5" /> Reminded</> : <><Send className="h-3.5 w-3.5" /> Remind</>}
    </button>
  )
}

function StatusPill({ status, test }: { status: string; test: boolean }) {
  const label = test ? "test" : status
  const cls = status === "sent" ? "text-[#2D8C6F]" : status === "blocked" ? "text-amber-600" : status === "failed" ? "text-red-500" : "text-muted-foreground"
  return <span className={cls}>{label}</span>
}
