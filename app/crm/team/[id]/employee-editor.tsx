"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Copy, Check, RefreshCw, Save, UserX, UserCheck, Briefcase } from "lucide-react"
import { ROLES, PAY_TYPES, DAYS, STATUSES } from "@/lib/squeegee/employees"
import { ONBOARDING_TASKS } from "@/lib/squeegee/company"
import { SendTextButton } from "@/components/squeegee/send-text-button"

export interface EmployeeDetail {
  id: string
  created_at: string
  name: string
  legal_name: string | null
  phone: string | null
  email: string | null
  role: string
  status: string
  pay_type: string
  pay_rate: number | null
  availability: Record<string, boolean> | null
  address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  invite_token: string | null
  agreement_signed_at: string | null
  onboarded_at: string | null
  last_login_at: string | null
  notes: string | null
  onboarding_checklist: Record<string, boolean> | null
}

export interface AssignedJob {
  id: string
  client_name: string
  address: string
  service_type: string
  status: string
  appointment_date: string | null
  appointment_time: string | null
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[var(--crm-accent)] focus:ring-1 focus:ring-[var(--crm-accent)]"

function joinLink(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.drsqueegeeclt.com"
  return `${origin}/team/join/${token}`
}

export function EmployeeEditor({ employee, jobs }: { employee: EmployeeDetail; jobs: AssignedJob[] }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: employee.name,
    phone: employee.phone ?? "",
    email: employee.email ?? "",
    role: employee.role,
    status: employee.status,
    pay_type: employee.pay_type,
    pay_rate: employee.pay_rate != null ? String(employee.pay_rate) : "",
    address: employee.address ?? "",
    emergency_contact_name: employee.emergency_contact_name ?? "",
    emergency_contact_phone: employee.emergency_contact_phone ?? "",
    notes: employee.notes ?? "",
    availability: employee.availability ?? {},
  })
  const [legalName, setLegalName] = useState(employee.legal_name ?? "")
  const [checklist, setChecklist] = useState<Record<string, boolean>>(employee.onboarding_checklist ?? {})
  const [token, setToken] = useState(employee.invite_token)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function taskDone(key: string, auto?: boolean): boolean {
    if (auto) {
      if (key === "account") return !!employee.onboarded_at
      if (key === "agreement") return !!employee.agreement_signed_at
    }
    return !!checklist[key]
  }

  async function toggleTask(key: string) {
    const nextChecklist = { ...checklist, [key]: !checklist[key] }
    setChecklist(nextChecklist)
    await fetch(`/api/crm/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboarding_checklist: nextChecklist }),
    })
  }

  function toggleDay(key: string) {
    setForm((f) => ({ ...f, availability: { ...f.availability, [key]: !f.availability[key as keyof typeof f.availability] } }))
  }

  async function save() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/crm/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        legal_name: legalName,
        phone: form.phone,
        email: form.email,
        role: form.role,
        status: form.status,
        pay_type: form.pay_type,
        pay_rate: form.pay_rate,
        address: form.address,
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_phone: form.emergency_contact_phone,
        notes: form.notes,
        availability: form.availability,
      }),
    })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? "Could not save.")
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
    router.refresh()
  }

  async function regenInvite() {
    setBusy(true)
    const res = await fetch(`/api/crm/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regen_invite" }),
    })
    const d = await res.json()
    setBusy(false)
    if (res.ok && d.invite_token) {
      setToken(d.invite_token)
      setForm((f) => ({ ...f, status: "invited" }))
    }
  }

  async function copyLink() {
    if (!token) return
    try {
      await navigator.clipboard.writeText(joinLink(token))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* no-op */
    }
  }

  const pending = form.status === "invited" || form.status === "onboarding"

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/crm/team" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Team
      </Link>

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{form.name || "Crew member"}</h1>
        <div className="text-xs text-muted-foreground text-right">
          {employee.onboarded_at ? "Set up" : "Not set up"}
          {employee.agreement_signed_at && <> · agreement signed</>}
          {employee.last_login_at && <><br />last login {new Date(employee.last_login_at).toLocaleDateString()}</>}
        </div>
      </div>

      {/* Invite link for un-onboarded crew */}
      {pending && token && (
        <div className="rounded-xl border border-[var(--crm-attention-bg)] bg-[var(--crm-attention-bg)] p-4 space-y-3">
          <p className="text-sm font-medium">Setup pending — send them their invite link:</p>
          <div className="rounded-lg bg-background border border-border px-3 py-2 text-xs break-all">{joinLink(token)}</div>
          <div className="flex flex-wrap gap-2">
            {form.phone && (
              <SendTextButton
                phone={form.phone}
                body={`Hey ${(form.name || "there").trim().split(/\s+/)[0]}, welcome to the Dr. Squeegee crew! Set up your crew account here (takes 2 min): ${joinLink(token)}`}
                kind="crew_invite"
                label="Send invite"
                sentLabel="Invite sent"
                variant="default"
                className="bg-[var(--crm-accent)] hover:bg-[#1F6B54]"
              />
            )}
            <Button size="sm" variant="outline" onClick={copyLink}>
              {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />} Copy link
            </Button>
            <Button size="sm" variant="ghost" onClick={regenInvite} disabled={busy}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> New link
            </Button>
          </div>
        </div>
      )}

      {/* Onboarding checklist */}
      <Card title="Onboarding checklist">
        <div className="space-y-1">
          {ONBOARDING_TASKS.map((t) => {
            const done = taskDone(t.key, t.auto)
            return (
              <button
                key={t.key}
                type="button"
                disabled={t.auto}
                onClick={() => !t.auto && toggleTask(t.key)}
                className={`w-full flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-left ${t.auto ? "cursor-default" : "hover:bg-muted"}`}
              >
                <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border flex items-center justify-center ${done ? "bg-[var(--crm-accent)] border-[var(--crm-accent)]" : "border-border"}`}>
                  {done && <Check className="h-3 w-3 text-white" />}
                </span>
                <span className="min-w-0">
                  <span className={`text-sm ${done ? "text-muted-foreground line-through" : "font-medium"}`}>{t.label}</span>
                  {t.detail && <span className="block text-xs text-muted-foreground">{t.detail}</span>}
                  {t.auto && <span className="text-[10px] text-muted-foreground"> (auto)</span>}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          SSN, W-4, I-9 and direct deposit are collected in <span className="font-medium">Gusto</span> — invite them there separately; check &quot;Complete your Gusto onboarding&quot; once they finish.
        </p>
      </Card>

      {/* Core fields */}
      <Card title="Details">
        <Field label="Name (display)">
          <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Legal full name (for payroll / Gusto)">
          <input className={inputCls} value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="As on their ID" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" />
          </Field>
          <Field label="Email">
            <input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} inputMode="email" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Role">
            <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Pay type">
            <select className={inputCls} value={form.pay_type} onChange={(e) => setForm({ ...form, pay_type: e.target.value })}>
              {PAY_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Pay rate">
          <input className={inputCls} value={form.pay_rate} onChange={(e) => setForm({ ...form, pay_rate: e.target.value.replace(/[^0-9.]/g, "") })} inputMode="decimal" />
        </Field>
      </Card>

      <Card title="Availability">
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => {
            const on = !!form.availability[d.key as keyof typeof form.availability]
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => toggleDay(d.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  on ? "bg-[var(--crm-accent)] text-white border-[var(--crm-accent)]" : "bg-background border-border text-muted-foreground hover:border-[var(--crm-accent)]"
                }`}
              >
                {d.label}
              </button>
            )
          })}
        </div>
      </Card>

      <Card title="Emergency contact">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <input className={inputCls} value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className={inputCls} value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} inputMode="tel" />
          </Field>
        </div>
        <Field label="Address">
          <input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <Field label="Notes (private)">
          <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </Card>

      {/* Assigned jobs */}
      <Card title={`Assigned jobs (${jobs.length})`}>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs assigned. Assign from a job's detail page.</p>
        ) : (
          <div className="space-y-1.5">
            {jobs.map((j) => (
              <Link key={j.id} href={`/crm/jobs/${j.id}`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-[var(--crm-accent)] transition-colors">
                <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 min-w-0 truncate">
                  <span className="font-medium">{j.client_name}</span>
                  <span className="text-muted-foreground"> · {j.service_type}</span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {j.appointment_date ? new Date(j.appointment_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "unscheduled"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {error && <p className="text-sm text-[var(--crm-dead)]">{error}</p>}

      <div className="flex items-center gap-2 sticky bottom-0 bg-background/90 backdrop-blur py-3 -mx-4 px-4 border-t border-border">
        <Button className="flex-1 bg-[var(--crm-accent)] hover:bg-[#1F6B54]" onClick={save} disabled={busy}>
          {saved ? <><Check className="h-4 w-4 mr-1.5" /> Saved</> : <><Save className="h-4 w-4 mr-1.5" /> Save changes</>}
        </Button>
        {form.status !== "inactive" ? (
          <Button variant="outline" onClick={() => setForm({ ...form, status: "inactive" })} className="text-[var(--crm-dead)] border-[var(--crm-dead-bg)] hover:bg-[var(--crm-dead-bg)]">
            <UserX className="h-4 w-4 mr-1.5" /> Deactivate
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setForm({ ...form, status: "active" })}>
            <UserCheck className="h-4 w-4 mr-1.5" /> Reactivate
          </Button>
        )}
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
