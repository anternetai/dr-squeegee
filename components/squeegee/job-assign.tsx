"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HardHat, Check } from "lucide-react"

interface CrewOption {
  id: string
  name: string
}

export function JobAssign({
  jobId,
  employees,
  current,
  crewPay,
}: {
  jobId: string
  employees: CrewOption[]
  current: string | null
  crewPay: number | null
}) {
  const router = useRouter()
  const [value, setValue] = useState(current ?? "")
  const [pay, setPay] = useState(crewPay != null ? String(crewPay) : "")
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function flashSaved() {
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  async function assign(next: string) {
    setValue(next)
    setBusy(true)
    setSaved(false)
    const res = await fetch(`/api/squeegee/jobs/${jobId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: next || null }),
    })
    setBusy(false)
    if (res.ok) {
      flashSaved()
      router.refresh()
    }
  }

  // Saves on blur, not on every keystroke: this is the number margin and the
  // crew-profitability panel are computed from, and a half-typed "1" is a wrong
  // answer that would sit in the database until someone noticed.
  async function savePay() {
    const original = crewPay != null ? String(crewPay) : ""
    if (pay.trim() === original) return
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/squeegee/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crew_pay: pay.trim() === "" ? null : pay.trim() }),
    })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? "Could not save crew pay.")
      return
    }
    flashSaved()
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <HardHat className="h-4 w-4 text-[var(--crm-accent)]" />
        <span className="text-sm font-semibold">Assigned crew</span>
        {saved && (
          <span className="text-xs text-[var(--crm-accent)] inline-flex items-center gap-1">
            <Check className="h-3 w-3" /> saved
          </span>
        )}
      </div>
      {employees.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active crew yet. Add someone under Team first.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Crew member</span>
            <select
              value={value}
              disabled={busy}
              onChange={(e) => assign(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[var(--crm-accent)] focus:ring-1 focus:ring-[var(--crm-accent)]"
            >
              <option value="">— Unassigned —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Crew pay $</span>
            <input
              value={pay}
              disabled={busy}
              inputMode="decimal"
              placeholder="0.00"
              onChange={(e) => setPay(e.target.value.replace(/[^0-9.]/g, ""))}
              onBlur={savePay}
              className="crm-numeral w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[var(--crm-accent)] focus:ring-1 focus:ring-[var(--crm-accent)]"
            />
          </label>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-[var(--crm-dead)]">{error}</p>}
      <p className="mt-2 text-xs text-muted-foreground">
        What this job costs you in crew pay. Feeds margin and the Worth-it panel on their page.
      </p>
    </div>
  )
}
