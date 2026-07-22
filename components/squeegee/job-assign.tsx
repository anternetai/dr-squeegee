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
}: {
  jobId: string
  employees: CrewOption[]
  current: string | null
}) {
  const router = useRouter()
  const [value, setValue] = useState(current ?? "")
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

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
      setSaved(true)
      setTimeout(() => setSaved(false), 1600)
      router.refresh()
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <HardHat className="h-4 w-4 text-[#2D8C6F]" />
        <span className="text-sm font-semibold">Assigned crew</span>
        {saved && <span className="text-xs text-[#2D8C6F] inline-flex items-center gap-1"><Check className="h-3 w-3" /> saved</span>}
      </div>
      {employees.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active crew yet. Add someone under Team first.
        </p>
      ) : (
        <select
          value={value}
          disabled={busy}
          onChange={(e) => assign(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#2D8C6F] focus:ring-1 focus:ring-[#2D8C6F]"
        >
          <option value="">— Unassigned —</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}
