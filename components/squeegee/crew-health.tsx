"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BellOff, BellRing, Clock, KeyRound, Square } from "lucide-react"

// Every time-derived value arrives pre-computed from the server. Deriving them
// here would mean calling Date.now() during render, which is impure — the values
// would drift on any incidental re-render, and React's purity lint rejects it.
export interface CrewHealthProps {
  employeeId: string
  weekWorkLabel: string
  weekDriveLabel: string
  openSegment: { jobLabel: string; sinceLabel: string } | null
  push: { devices: number; lastSuccessLabel: string | null; failures: number }
  hasPin: boolean
  locked: boolean
}

/**
 * The three things about a crew member that fail silently: a timer left running,
 * push that stopped being delivered, and a PIN that's locked out. All three are
 * invisible until someone gets hurt by them, so they get their own panel.
 */
export function CrewHealth({
  employeeId,
  weekWorkLabel,
  weekDriveLabel,
  openSegment,
  push,
  hasPin,
  locked,
}: CrewHealthProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function forceClockOut() {
    setBusy(true)
    await fetch(`/api/squeegee/employees/${employeeId}/clock-out`, { method: "POST" })
    setBusy(false)
    router.refresh()
  }

  async function unlock() {
    setBusy(true)
    await fetch(`/api/squeegee/employees/${employeeId}/unlock`, { method: "POST" })
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-panel)] p-4 space-y-3">
      <h2 className="font-semibold">This week</h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">On site</p>
          <p className="text-2xl font-bold">{weekWorkLabel}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Driving</p>
          <p className="text-2xl font-bold">{weekDriveLabel}</p>
        </div>
      </div>

      {openSegment && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--crm-attention-bg)] px-3 py-2.5">
          <span className="inline-flex items-center gap-2 text-sm text-[var(--crm-attention)]">
            <Clock className="h-4 w-4" />
            Clock running on {openSegment.jobLabel} since {openSegment.sinceLabel}
          </span>
          <button
            onClick={forceClockOut}
            disabled={busy}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-[var(--crm-border)] px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
          >
            <Square className="h-3 w-3" /> Clock out
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm">
        {push.devices === 0 ? (
          <>
            <BellOff className="h-4 w-4 text-[var(--crm-attention)]" />
            <span className="text-[var(--crm-attention)]">
              No devices registered — they get no job alerts.
            </span>
          </>
        ) : (
          <>
            <BellRing className="h-4 w-4 text-[var(--crm-accent)]" />
            <span className="text-muted-foreground">
              {push.devices} device{push.devices === 1 ? "" : "s"}
              {push.lastSuccessLabel
                ? ` · last alert delivered ${push.lastSuccessLabel}`
                : " · nothing delivered yet"}
              {push.failures > 0 ? ` · ${push.failures} failing` : ""}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <KeyRound className="h-4 w-4" />
          {!hasPin
            ? "No PIN set — they can't log in yet."
            : locked
              ? "Locked out from too many wrong PINs."
              : "PIN set."}
        </span>
        {locked && (
          <button
            onClick={unlock}
            disabled={busy}
            className="shrink-0 rounded-md border border-[var(--crm-border)] px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
          >
            Unlock now
          </button>
        )}
      </div>
    </div>
  )
}
