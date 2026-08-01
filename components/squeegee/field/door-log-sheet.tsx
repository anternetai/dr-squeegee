"use client"

import { useState } from "react"
import { X, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DoorVisit } from "@/lib/crm/field/types"

export interface DoorContact {
  name?: string
  phone?: string
  address?: string
}

interface Props {
  lat: number
  lng: number
  isRevisit?: boolean
  initialContact?: DoorContact
  onSave: (visit: DoorVisit, contact: DoorContact) => Promise<void>
  onCancel: () => void
}

/* The flow is deliberately reordered from the standalone app's.
   There, contact was step 4 of 4 — below a photo widget and an audio recorder,
   labelled "(optional)", off the bottom of a phone screen. Result: 325 doors,
   zero names, and $2,725 of closes with no customer to rebook.
   Here the contact question comes the moment someone answers, because that is
   when you are standing in front of them, and a close cannot be saved without
   it. Not-home stays a single tap — that is 235 of the 325 doors. */
type Step = "answered" | "who" | "outcome" | "details"

export function DoorLogSheet({
  lat, lng, isRevisit, initialContact, onSave, onCancel,
}: Props) {
  const [step, setStep] = useState<Step>("answered")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const now = new Date()
  const [date] = useState(now.toISOString().split("T")[0])
  const [time] = useState(now.toTimeString().slice(0, 5))

  const [answered, setAnswered] = useState<boolean | null>(null)
  const [pitched, setPitched] = useState(false)
  const [closed, setClosed] = useState(false)
  const [notInterested, setNotInterested] = useState(false)

  const [name, setName] = useState(initialContact?.name ?? "")
  const [phone, setPhone] = useState(initialContact?.phone ?? "")
  const [address, setAddress] = useState(initialContact?.address ?? "")
  const [notes, setNotes] = useState("")
  const [revenue, setRevenue] = useState("")

  const hasContact = Boolean(name.trim() || phone.trim())

  async function save(overrides?: Partial<{ answered: boolean; pitched: boolean; closed: boolean; notInterested: boolean }>) {
    const a = overrides?.answered ?? answered ?? false
    const p = overrides?.pitched ?? pitched
    const c = overrides?.closed ?? closed
    const ni = overrides?.notInterested ?? notInterested

    if (c && !hasContact) {
      setError("A name or phone is required to log a close.")
      setStep("who")
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave(
        {
          date, time,
          answered: a,
          pitched: p,
          closed: c,
          not_interested: ni,
          notes: notes.trim() || undefined,
          revenue: c && revenue ? parseFloat(revenue) : undefined,
        },
        { name: name.trim() || undefined, phone: phone.trim() || undefined, address: address.trim() || undefined }
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.")
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[500] rounded-t-2xl border-t border-[var(--crm-line)] bg-[var(--crm-surface)] shadow-2xl"
      style={{ maxHeight: "88vh", overflowY: "auto", paddingBottom: "env(safe-area-inset-bottom)" }}
      role="dialog"
      aria-label={isRevisit ? "Log revisit" : "Log new door"}
    >
      <div className="flex justify-center pb-1 pt-3">
        <div className="h-1 w-10 rounded-full bg-white/15" />
      </div>

      <div className="flex items-start justify-between px-5 pb-4">
        <div>
          <h2 className="text-base font-semibold">{isRevisit ? "Log revisit" : "Log door"}</h2>
          <p className="mt-0.5 text-xs text-[var(--crm-text-faint)]">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </p>
        </div>
        <button
          onClick={onCancel}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--crm-surface-high)] text-[var(--crm-text-dim)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="mx-5 mb-4 rounded-lg border border-[var(--crm-dead-bg)] bg-[var(--crm-dead-bg)] px-3 py-2 text-sm text-[var(--crm-dead)]">
          {error}
        </div>
      )}

      <div className="space-y-5 px-5 pb-7">
        {step === "answered" && (
          <div className="space-y-3">
            <p className="text-sm font-semibold">Did they answer?</p>
            <Big onClick={() => { setAnswered(true); setStep("who") }} tone="accent">
              Yes, someone answered
            </Big>
            <Big
              onClick={() => { setAnswered(false); save({ answered: false }) }}
              disabled={saving}
            >
              {saving ? "Saving…" : "Nobody home"}
            </Big>
          </div>
        )}

        {step === "who" && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold">Who are you talking to?</p>
              <p className="mt-1 text-xs text-[var(--crm-text-dim)]">
                Get this now — it is the only way this door can become a customer.
              </p>
            </div>

            <Field label="Name" value={name} onChange={setName} placeholder="First name is enough" autoFocus />
            <Field label="Phone" value={phone} onChange={setPhone} placeholder="(704) 555-1234" type="tel" inputMode="tel" />
            <Field label="Address" value={address} onChange={setAddress} placeholder="Street address" />

            <div className="flex gap-3 pt-1">
              <Ghost onClick={() => setStep("answered")}>Back</Ghost>
              <Big onClick={() => setStep("outcome")} tone="accent" className="flex-1">
                Next
              </Big>
            </div>
            {!hasContact && (
              <button
                onClick={() => setStep("outcome")}
                className="w-full text-center text-xs text-[var(--crm-text-faint)] underline underline-offset-2"
              >
                They wouldn&apos;t give it — continue without
              </button>
            )}
          </div>
        )}

        {step === "outcome" && (
          <div className="space-y-3">
            <p className="text-sm font-semibold">How did it go?</p>
            <Big
              onClick={() => { setPitched(true); setClosed(true); setNotInterested(false); setStep("details") }}
              tone="accent"
            >
              Closed the deal
            </Big>
            <Big onClick={() => { setPitched(true); setClosed(false); setNotInterested(false); setStep("details") }}>
              Pitched — following up
            </Big>
            <Big onClick={() => { setPitched(false); setClosed(false); setNotInterested(false); setStep("details") }}>
              Just talked
            </Big>
            <Big
              onClick={() => { setPitched(false); setClosed(false); setNotInterested(true); setStep("details") }}
              tone="dead"
            >
              Not interested
            </Big>
            <Ghost onClick={() => setStep("who")}>Back</Ghost>
          </div>
        )}

        {step === "details" && (
          <div className="space-y-4">
            {closed && (
              <>
                <Field
                  label="What it sold for"
                  value={revenue}
                  onChange={setRevenue}
                  placeholder="0.00"
                  type="number"
                  inputMode="decimal"
                  autoFocus
                />
                {!hasContact && (
                  <div className="rounded-lg border border-[var(--crm-attention-bg)] bg-[var(--crm-attention-bg)] px-3 py-2 text-xs text-[var(--crm-attention)]">
                    A close needs a name or phone. Tap Back and add one — otherwise this
                    sale never becomes a customer you can rebook.
                  </div>
                )}
              </>
            )}

            <div>
              <label className="mb-2 block text-xs uppercase tracking-wide text-[var(--crm-text-faint)]">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="What they wanted, when to come back…"
                className="w-full resize-none rounded-xl border border-[var(--crm-line)] bg-[var(--crm-surface-high)] px-3 py-3 text-sm text-[var(--crm-text)] placeholder-[var(--crm-text-faint)] focus:border-[var(--crm-accent)] focus:outline-none"
              />
            </div>

            {hasContact && (
              <p className="text-xs text-[var(--crm-accent)]">
                <Check className="mr-1 inline h-3 w-3" />
                {name.trim() || phone.trim()} will be created as a client
                {closed ? " with an approved job" : ""}.
              </p>
            )}

            <div className="flex gap-3">
              <Ghost onClick={() => setStep(closed || notInterested || pitched ? "outcome" : "who")}>
                Back
              </Ghost>
              <Big
                onClick={() => save()}
                tone="accent"
                className="flex-1"
                disabled={saving || (closed && !hasContact)}
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </span>
                ) : (
                  "Save door"
                )}
              </Big>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Big({
  children, onClick, tone = "neutral", className, disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  tone?: "neutral" | "accent" | "dead"
  className?: string
  disabled?: boolean
}) {
  const tones = {
    neutral: "border-[var(--crm-line)] bg-[var(--crm-surface-high)] text-[var(--crm-text)]",
    accent: "border-[var(--crm-accent)] bg-[var(--crm-accent-weak)] text-[var(--crm-accent)]",
    dead: "border-[var(--crm-dead-bg)] bg-[var(--crm-dead-bg)] text-[var(--crm-dead)]",
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-h-[56px] w-full rounded-xl border-2 px-4 py-4 text-sm font-semibold transition-transform active:scale-[0.98] disabled:opacity-40",
        tones[tone],
        className
      )}
    >
      {children}
    </button>
  )
}

function Ghost({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-[var(--crm-line)] px-5 py-3.5 text-sm text-[var(--crm-text-dim)]"
    >
      {children}
    </button>
  )
}

function Field({
  label, value, onChange, placeholder, type = "text", inputMode, autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  inputMode?: "tel" | "decimal" | "text"
  autoFocus?: boolean
}) {
  return (
    <div>
      <label className="mb-2 block text-xs uppercase tracking-wide text-[var(--crm-text-faint)]">
        {label}
      </label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--crm-line)] bg-[var(--crm-surface-high)] px-3 py-3.5 text-base text-[var(--crm-text)] placeholder-[var(--crm-text-faint)] focus:border-[var(--crm-accent)] focus:outline-none"
      />
    </div>
  )
}
