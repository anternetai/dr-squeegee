"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Scale } from "lucide-react"
import type { CrewProfit, CrewVerdict } from "@/lib/squeegee/crew"

export type WorthWindow = "30" | "90" | "all"

export const WORTH_WINDOWS: { key: WorthWindow; label: string }[] = [
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
  { key: "all", label: "All time" },
]

export interface CrewWorthProps {
  employeeId: string
  firstName: string
  window: WorthWindow
  profit: CrewProfit
  verdict: CrewVerdict
  soloPerHour: number | null
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * "Is this crew member making or costing me money?" — the question Anthony asked
 * for by name. Every number is computed on the server from his own rows; nothing
 * here is modelled, projected or filled in when the data is thin. When there are
 * no hours it says so instead of printing an infinity dressed as a rate.
 */
export function CrewWorth({
  employeeId,
  firstName,
  window,
  profit,
  verdict,
  soloPerHour,
}: CrewWorthProps) {
  const router = useRouter()
  const [solo, setSolo] = useState(soloPerHour != null ? String(soloPerHour) : "")
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveSolo() {
    const original = soloPerHour != null ? String(soloPerHour) : ""
    if (solo.trim() === original) return
    setBusy(true)
    setError(null)
    const res = await fetch("/api/crm/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solo_revenue_per_hour: solo.trim() === "" ? null : solo.trim() }),
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

  const verdictTone = {
    accent: "border-[var(--crm-accent-line)] bg-[var(--crm-accent-weak)] text-[var(--crm-accent)]",
    attention: "border-[var(--crm-attention-bg)] bg-[var(--crm-attention-bg)] text-[var(--crm-attention)]",
    idle: "border-[var(--crm-line)] bg-[var(--crm-surface-high)] text-[var(--crm-text-dim)]",
  }[verdict.tone]

  return (
    <div className="rounded-xl border border-[var(--crm-line)] bg-[var(--crm-surface)] p-4 space-y-3 max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <Scale className="h-4 w-4 text-[var(--crm-text-faint)]" /> Worth it?
        </h2>
        <div className="flex gap-1.5">
          {WORTH_WINDOWS.map((w) => (
            <Link
              key={w.key}
              href={`/crm/team/${employeeId}?window=${w.key}`}
              scroll={false}
              aria-current={w.key === window ? "true" : undefined}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                w.key === window
                  ? "border-[var(--crm-accent-line)] bg-[var(--crm-accent-weak)] text-[var(--crm-accent)]"
                  : "border-[var(--crm-line)] text-[var(--crm-text-faint)] hover:border-[var(--crm-accent-line)]"
              }`}
            >
              {w.label}
            </Link>
          ))}
        </div>
      </div>

      {profit.jobs === 0 ? (
        <p className="text-sm text-[var(--crm-text-dim)]">
          No completed jobs for {firstName} in this window yet. Nothing to weigh.
        </p>
      ) : (
        <>
          <div className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${verdictTone}`}>
            {verdict.text}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            <Stat label="Jobs" value={String(profit.jobs)} />
            <Stat label="Revenue" value={money(profit.revenue)} />
            <Stat label="Crew pay" value={money(profit.crewPay)} />
            <Stat label="Their hours" value={profit.hours > 0 ? `${profit.hours.toFixed(2)}h` : "none logged"} />
            <Stat
              label="Revenue / hr"
              value={profit.revenuePerHour != null ? money(profit.revenuePerHour) : "—"}
            />
            <Stat
              label="Net / hr after pay"
              value={profit.netPerHour != null ? money(profit.netPerHour) : "—"}
            />
          </dl>

          <p className="text-xs text-[var(--crm-text-faint)]">
            {profit.crewPayJobs} of {profit.jobs} {profit.jobs === 1 ? "job has" : "jobs have"} crew pay set
            {profit.crewShare != null && <> · they take {Math.round(profit.crewShare * 100)}% of revenue</>}
            {profit.hours === 0 && <> · no work segments on their clock, so the per-hour numbers are blank</>}
          </p>
        </>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t border-[var(--crm-line)] pt-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-[var(--crm-text-faint)]">
            You working alone, $ / hr
          </span>
          <input
            value={solo}
            disabled={busy}
            inputMode="decimal"
            placeholder="131.25"
            onChange={(e) => setSolo(e.target.value.replace(/[^0-9.]/g, ""))}
            onBlur={saveSolo}
            className="crm-numeral w-36 rounded-lg border border-[var(--crm-line)] bg-[var(--crm-ground)] px-3 py-2 text-sm outline-none focus:border-[var(--crm-accent)] focus:ring-1 focus:ring-[var(--crm-accent)]"
          />
        </label>
        {saved && (
          <span className="pb-2.5 text-xs text-[var(--crm-accent)] inline-flex items-center gap-1">
            <Check className="h-3 w-3" /> saved
          </span>
        )}
        {error && <span className="pb-2.5 text-xs text-[var(--crm-dead)]">{error}</span>}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--crm-text-faint)]">
        {label}
      </dt>
      <dd className="crm-numeral mt-0.5 text-lg leading-none text-[var(--crm-text)]">{value}</dd>
    </div>
  )
}
