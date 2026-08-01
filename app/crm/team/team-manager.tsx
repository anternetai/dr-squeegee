"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { UserPlus, Copy, Check, Users, Clock } from "lucide-react"
import { ROLES, PAY_TYPES, payLabel, roleLabel } from "@/lib/squeegee/employees"
import { SendTextButton } from "@/components/squeegee/send-text-button"

export interface CrewRow {
  id: string
  created_at: string
  name: string
  phone: string | null
  email: string | null
  role: string
  status: string
  pay_type: string
  pay_rate: number | null
  invite_token: string | null
  onboarded_at: string | null
  last_login_at: string | null
  openJobs: number
}

const STATUS_BADGE: Record<string, string> = {
  invited: "bg-[var(--crm-attention-bg)] text-[var(--crm-attention)] dark:bg-[var(--crm-attention-bg)] dark:text-[var(--crm-attention)]",
  onboarding: "bg-[var(--crm-attention-bg)] text-[var(--crm-attention)] dark:bg-[var(--crm-attention-bg)] dark:text-[var(--crm-attention)]",
  active: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

function joinLink(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.drsqueegeeclt.com"
  return `${origin}/team/join/${token}`
}

function inviteSms(name: string, token: string): string {
  const first = (name || "there").trim().split(/\s+/)[0]
  return `Hey ${first}, welcome to the Dr. Squeegee crew! Set up your crew account here (takes 2 min): ${joinLink(token)}`
}

export function TeamManager({ initial }: { initial: CrewRow[] }) {
  const [rows, setRows] = useState<CrewRow[]>(initial)
  const [showInvite, setShowInvite] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1800)
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  const active = rows.filter((r) => r.status === "active")
  const pending = rows.filter((r) => r.status === "invited" || r.status === "onboarding")
  const inactive = rows.filter((r) => r.status === "inactive")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-[var(--crm-accent)]" /> Team
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {active.length} active · {pending.length} pending
          </p>
        </div>
        <Button onClick={() => setShowInvite(true)} className="bg-[var(--crm-accent)] hover:bg-[#1F6B54]">
          <UserPlus className="h-4 w-4 mr-1.5" /> Invite crew
        </Button>
      </div>

      {rows.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No crew yet. Invite your first person to get started.</p>
        </div>
      )}

      {pending.length > 0 && (
        <Section title="Pending setup">
          {pending.map((r) => (
            <CrewCard key={r.id} r={r} copied={copied} onCopy={copy} />
          ))}
        </Section>
      )}
      {active.length > 0 && (
        <Section title="Active crew">
          {active.map((r) => (
            <CrewCard key={r.id} r={r} copied={copied} onCopy={copy} />
          ))}
        </Section>
      )}
      {inactive.length > 0 && (
        <Section title="Inactive">
          {inactive.map((r) => (
            <CrewCard key={r.id} r={r} copied={copied} onCopy={copy} />
          ))}
        </Section>
      )}

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onCreated={(row) => setRows((prev) => [row, ...prev])}
        />
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function CrewCard({
  r,
  copied,
  onCopy,
}: {
  r: CrewRow
  copied: string | null
  onCopy: (text: string, key: string) => void
}) {
  const pending = r.status === "invited" || r.status === "onboarding"
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/crm/team/${r.id}`} className="min-w-0 flex-1 group">
          <div className="flex items-center gap-2">
            <span className="font-semibold group-hover:text-[var(--crm-accent)] transition-colors truncate">
              {r.name}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[r.status] ?? ""}`}>
              {r.status === "invited" ? "Invited" : r.status === "onboarding" ? "Onboarding" : r.status === "active" ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {roleLabel(r.role)} · {payLabel(r.pay_type, r.pay_rate)}
            {r.status === "active" && (
              <> · {r.openJobs} open {r.openJobs === 1 ? "job" : "jobs"}</>
            )}
          </div>
        </Link>
      </div>
      {pending && r.invite_token && (
        <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCopy(inviteSms(r.name, r.invite_token!), `sms-${r.id}`)}
          >
            {copied === `sms-${r.id}` ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            Copy invite text
          </Button>
          {r.phone && (
            <SendTextButton
              phone={r.phone}
              body={inviteSms(r.name, r.invite_token!)}
              kind="crew_invite"
              label="Send invite"
              sentLabel="Invite sent"
            />
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onCopy(joinLink(r.invite_token!), `link-${r.id}`)}
          >
            {copied === `link-${r.id}` ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Clock className="h-3.5 w-3.5 mr-1.5" />}
            Copy link only
          </Button>
        </div>
      )}
    </div>
  )
}

function InviteModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (row: CrewRow) => void
}) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", role: "tech", pay_type: "per_job", pay_rate: "" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ name: string; token: string; phone: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function submit() {
    if (!form.name.trim()) {
      setError("Name is required.")
      return
    }
    setBusy(true)
    setError(null)
    const res = await fetch("/api/crm/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? "Could not create.")
      return
    }
    setCreated({ name: form.name, token: data.invite_token, phone: form.phone })
    onCreated({
      id: data.id,
      created_at: new Date().toISOString(),
      name: form.name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      role: form.role,
      status: "invited",
      pay_type: form.pay_type,
      pay_rate: form.pay_rate ? Number(form.pay_rate) : null,
      invite_token: data.invite_token,
      onboarded_at: null,
      last_login_at: null,
      openJobs: 0,
    })
  }

  async function copySms() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(inviteSms(created.name, created.token))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* no-op */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {!created ? (
          <>
            <h2 className="text-lg font-bold">Invite crew member</h2>
            <div className="space-y-3">
              <Field label="Name *">
                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jordan Diaz" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="704-555-0123" inputMode="tel" />
                </Field>
                <Field label="Email">
                  <input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="optional" inputMode="email" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Role">
                  <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Pay type">
                  <select className={inputCls} value={form.pay_type} onChange={(e) => setForm({ ...form, pay_type: e.target.value })}>
                    {PAY_TYPES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Pay rate">
                <input className={inputCls} value={form.pay_rate} onChange={(e) => setForm({ ...form, pay_rate: e.target.value.replace(/[^0-9.]/g, "") })} placeholder="e.g. 25" inputMode="decimal" />
              </Field>
            </div>
            {error && <p className="text-sm text-[var(--crm-dead)]">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button className="flex-1 bg-[var(--crm-accent)] hover:bg-[#1F6B54]" onClick={submit} disabled={busy}>
                {busy ? "Creating…" : "Create & invite"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center space-y-1">
              <div className="mx-auto h-11 w-11 rounded-full bg-[var(--crm-accent-weak)] flex items-center justify-center">
                <Check className="h-6 w-6 text-[var(--crm-accent)]" />
              </div>
              <h2 className="text-lg font-bold">{created.name} added</h2>
              <p className="text-sm text-muted-foreground">
                {created.phone ? "Text them their setup link — one tap." : "Copy this text to send them their setup link."}
              </p>
            </div>
            <div className="rounded-lg bg-muted p-3 text-sm">{inviteSms(created.name, created.token)}</div>
            {created.phone ? (
              <SendTextButton
                phone={created.phone}
                body={inviteSms(created.name, created.token)}
                kind="crew_invite"
                label="Send invite text"
                sentLabel="Invite sent ✓"
                variant="default"
                size="default"
                className="w-full bg-[var(--crm-accent)] hover:bg-[#1F6B54]"
              />
            ) : (
              <Button className="w-full bg-[var(--crm-accent)] hover:bg-[#1F6B54]" onClick={copySms}>
                {copied ? <><Check className="h-4 w-4 mr-1.5" /> Copied</> : <><Copy className="h-4 w-4 mr-1.5" /> Copy invite text</>}
              </Button>
            )}
            {created.phone && (
              <button onClick={copySms} className="w-full text-xs text-muted-foreground hover:text-foreground">
                {copied ? "Copied" : "or copy the text"}
              </button>
            )}
            <Button variant="ghost" className="w-full" onClick={onClose}>Done</Button>
          </>
        )}
      </div>
    </div>
  )
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[var(--crm-accent)] focus:ring-1 focus:ring-[var(--crm-accent)]"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
