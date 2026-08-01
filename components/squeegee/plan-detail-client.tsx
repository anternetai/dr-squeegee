"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Check, Copy, ExternalLink, MessageSquare, CalendarDays, X } from "lucide-react"
import { SendTextButton } from "@/components/squeegee/send-text-button"
import {
  formatMoney,
  PLAN_STATUS_LABELS,
  VISIT_STATUS_LABELS,
  type PlanStatus,
  type PlanVisit,
  type SqueegeePlan,
} from "@/lib/squeegee/plans"

interface PlanMember {
  member_number: number
  slug: string | null
  email: string
  created_at: string
}

interface Props {
  plan: SqueegeePlan
  visits: PlanVisit[]
  member: PlanMember | null
}

const STATUS_BADGE: Record<PlanStatus, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-[var(--crm-idle-bg)] text-[var(--crm-idle)] dark:bg-[var(--crm-idle-bg)] dark:text-[var(--crm-idle)]",
  signed: "bg-[var(--crm-accent-weak)] text-[var(--crm-accent)] dark:bg-[var(--crm-accent-weak)] dark:text-[var(--crm-accent)]",
  active: "bg-[var(--crm-accent-weak)] text-[var(--crm-accent)] dark:bg-[var(--crm-accent-weak)] dark:text-[var(--crm-accent)]",
  cancelled: "bg-[var(--crm-dead-bg)] text-[var(--crm-dead)] dark:bg-[var(--crm-dead-bg)] dark:text-[var(--crm-dead)]",
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function smsHref(phone: string | null, body: string): string {
  if (!phone) return `sms:?&body=${encodeURIComponent(body)}`
  const normalized = phone.startsWith("+") ? phone : `+${phone}`
  return `sms:${normalized}?&body=${encodeURIComponent(body)}`
}

export function PlanDetailClient({ plan, visits, member }: Props) {
  const router = useRouter()
  const [copied, setCopied] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [dateValue, setDateValue] = useState("")
  const [genTermStart, setGenTermStart] = useState(new Date().toISOString().slice(0, 10))

  const [origin, setOrigin] = useState("https://www.drsqueegeeclt.com")
  useEffect(() => setOrigin(window.location.origin), [])
  const agreementUrl = `${origin}/a/${plan.token}`
  const portalUrl = `${origin}/portal/${plan.portal_token}`
  const services = Array.isArray(plan.services) ? plan.services : []
  const pendingReschedules = visits.filter((v) => v.status === "reschedule_requested")

  const agreementSms = `Hi ${plan.client_name.split(" ")[0]}! Here's your Dr. Squeegee ${plan.plan_name} agreement — review and sign here: ${agreementUrl}`
  const portalSms = `Welcome to the Dr. Squeegee family! Your member portal (visit schedule, rescheduling, everything): ${portalUrl} — bookmark it!`

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  async function patchPlan(body: Record<string, unknown>, key: string) {
    setBusy(key)
    try {
      const res = await fetch(`/api/squeegee/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) router.refresh()
      else alert((await res.json()).error || "Update failed")
    } finally {
      setBusy(null)
    }
  }

  async function patchVisit(visitId: string, body: Record<string, unknown>, key: string) {
    setBusy(key)
    try {
      const res = await fetch(`/api/squeegee/plans/${plan.id}/visits/${visitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setEditingDate(null)
        router.refresh()
      } else alert((await res.json()).error || "Update failed")
    } finally {
      setBusy(null)
    }
  }

  async function generateSchedule() {
    setBusy("generate")
    try {
      const res = await fetch(`/api/squeegee/plans/${plan.id}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", term_start: genTermStart }),
      })
      if (res.ok) router.refresh()
      else alert((await res.json()).error || "Generate failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <Link
        href="/crm/plans"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> All plans
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold">{plan.client_name}</h1>
            <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${STATUS_BADGE[plan.status]}`}>
              {PLAN_STATUS_LABELS[plan.status]}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{plan.address}</p>
          {plan.client_phone && (
            <a href={`tel:+${plan.client_phone.replace(/^\+/, "")}`} className="text-sm text-[var(--crm-accent)] mt-0.5 inline-block">
              {plan.client_phone}
            </a>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-black tabular-nums text-[var(--crm-accent)]">
            {formatMoney(Number(plan.total_price))}
          </p>
          <p className="text-xs text-muted-foreground">
            {plan.billing === "paid_in_full"
              ? `Paid in full · ${Number(plan.discount_percent)}% off ${formatMoney(Number(plan.annual_value))}`
              : `${formatMoney(Number(plan.monthly_price ?? 0))}/mo · ${formatMoney(Number(plan.annual_value))}/yr`}
          </p>
        </div>
      </div>

      {/* Pending reschedules alert */}
      {pendingReschedules.length > 0 && (
        <div className="rounded-xl border border-[var(--crm-attention-bg)] dark:border-[var(--crm-attention-bg)] bg-[var(--crm-attention-bg)] dark:bg-[var(--crm-attention-bg)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--crm-attention)] dark:text-[var(--crm-attention)]">
            {pendingReschedules.length} reschedule request{pendingReschedules.length !== 1 ? "s" : ""} waiting — review below
          </p>
        </div>
      )}

      {/* Share links */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Share</p>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 rounded-lg border border-border px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Agreement (sign here)</p>
              <p className="text-xs truncate">{agreementUrl}</p>
            </div>
            <Button variant="outline" size="icon" onClick={() => copy(agreementUrl, "agreement")} title="Copy">
              {copied === "agreement" ? <Check className="h-4 w-4 text-[var(--crm-accent)]" /> : <Copy className="h-4 w-4" />}
            </Button>
            <SendTextButton phone={plan.client_phone} body={agreementSms} kind="plan_agreement" size="icon" iconOnly sentLabel="Sent" />
            <Button variant="outline" size="icon" asChild title="Open">
              <a href={agreementUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 rounded-lg border border-border px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Member portal (their login link)</p>
              <p className="text-xs truncate">{portalUrl}</p>
            </div>
            <Button variant="outline" size="icon" onClick={() => copy(portalUrl, "portal")} title="Copy">
              {copied === "portal" ? <Check className="h-4 w-4 text-[var(--crm-accent)]" /> : <Copy className="h-4 w-4" />}
            </Button>
            <SendTextButton phone={plan.client_phone} body={portalSms} kind="plan_portal" size="icon" iconOnly sentLabel="Sent" />
            <Button variant="outline" size="icon" asChild title="Open">
              <a href={portalUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Status actions */}
      <div className="flex flex-wrap gap-2">
        {plan.status === "draft" && (
          <Button variant="outline" disabled={busy === "sent"} onClick={() => patchPlan({ status: "sent" }, "sent")}>
            Mark Sent
          </Button>
        )}
        {plan.status === "signed" && (
          <Button disabled={busy === "active"} onClick={() => patchPlan({ status: "active" }, "active")}>
            Mark Active (payment received)
          </Button>
        )}
        {plan.status !== "cancelled" && (
          <Button
            variant="outline"
            className="text-[var(--crm-dead)] hover:text-[var(--crm-dead)]"
            disabled={busy === "cancel"}
            onClick={() => {
              if (confirm("Cancel this plan?")) patchPlan({ status: "cancelled" }, "cancel")
            }}
          >
            Cancel Plan
          </Button>
        )}
      </div>

      {/* Care Club membership */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
          Care Club Membership
        </p>
        {member ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-bold text-[var(--crm-accent)] tabular-nums">
              Member #{String(member.member_number).padStart(4, "0")}
            </span>
            <span className="text-muted-foreground">{member.email}</span>
            {member.slug && (
              <span className="text-muted-foreground">
                drsqueegeeclt.com/portal/<span className="text-foreground">{member.slug}</span>
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              since {new Date(member.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No login yet — they&apos;ll create one right after signing, or from the
            &ldquo;finish setup&rdquo; banner in their portal.
          </p>
        )}
      </div>

      {/* Signature */}
      {plan.signed_at && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Signed {new Date(plan.signed_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </p>
          {plan.signature_type === "drawn" && plan.signature_data ? (
            <div className="rounded-lg bg-white p-3 inline-block">
              <img src={plan.signature_data} alt="Signature" className="h-16 w-auto" />
            </div>
          ) : (
            <p className="text-2xl italic">{plan.signature_data || plan.signed_name}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {plan.signed_name}
            {plan.signed_ip ? ` · IP ${plan.signed_ip}` : ""}
          </p>
        </div>
      )}

      {/* Services */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Services
        </p>
        <div className="space-y-2">
          {services.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span>
                {s.name} <span className="text-muted-foreground">× {s.visits_per_year}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatMoney(Number(s.price_per_visit) * Number(s.visits_per_year))}/yr
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Schedule */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Visit Schedule
          </p>
          {plan.term_start && (
            <p className="text-xs text-muted-foreground">
              {formatDate(plan.term_start)} – {formatDate(plan.term_end)}
            </p>
          )}
        </div>

        {visits.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              {plan.signed_at && !plan.onboarded_at
                ? "Customer hasn't picked their schedule yet — they choose their months in the portal's setup flow. Generate here only to override:"
                : "No visits yet. The customer picks their months in the portal after signing, or generate a schedule now:"}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={genTermStart}
                onChange={(e) => setGenTermStart(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-[var(--crm-accent)]"
              />
              <Button onClick={generateSchedule} disabled={busy === "generate"}>
                <CalendarDays className="h-4 w-4 mr-2" />
                {busy === "generate" ? "Generating..." : "Generate Schedule"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {visits.map((v) => (
              <div
                key={v.id}
                className={`rounded-lg border px-3 py-2.5 ${
                  v.status === "reschedule_requested"
                    ? "border-[var(--crm-attention-bg)] dark:border-[var(--crm-attention-bg)] bg-[var(--crm-attention-bg)] dark:bg-[var(--crm-attention-bg)]"
                    : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {v.service_name}
                      {v.seq > 1 && <span className="text-muted-foreground font-normal"> #{v.seq}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(v.scheduled_date)} · {VISIT_STATUS_LABELS[v.status]}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {v.status === "reschedule_requested" ? (
                      <>
                        <Button
                          size="sm"
                          disabled={busy === `ap-${v.id}`}
                          onClick={() => patchVisit(v.id, { approve_reschedule: true }, `ap-${v.id}`)}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          {formatDate(v.reschedule_requested_date)}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === `de-${v.id}`}
                          onClick={() => patchVisit(v.id, { decline_reschedule: true }, `de-${v.id}`)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : v.status === "scheduled" ? (
                      <>
                        {editingDate === v.id ? (
                          <>
                            <input
                              type="date"
                              value={dateValue}
                              onChange={(e) => setDateValue(e.target.value)}
                              className="h-8 px-2 rounded-md border border-border bg-background text-xs"
                            />
                            <Button
                              size="sm"
                              disabled={!dateValue || busy === `dt-${v.id}`}
                              onClick={() => patchVisit(v.id, { scheduled_date: dateValue }, `dt-${v.id}`)}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingDate(v.id)
                                setDateValue(v.scheduled_date ?? "")
                              }}
                            >
                              Edit date
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy === `co-${v.id}`}
                              onClick={() => patchVisit(v.id, { status: "completed" }, `co-${v.id}`)}
                            >
                              Done
                            </Button>
                          </>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
                {v.reschedule_note && v.status === "reschedule_requested" && (
                  <p className="text-xs text-[var(--crm-attention)] dark:text-[var(--crm-attention)] mt-1.5">
                    &ldquo;{v.reschedule_note}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
