"use client"

import { useState } from "react"
import { Camera, Check, Clock, Eye, EyeOff, MapPin, Play, Truck } from "lucide-react"

export interface CrewPhoto {
  id: string
  kind: "before" | "after"
  url: string | null
  customer_visible: boolean
}

export interface CrewWorkProps {
  crewName: string | null
  fieldStatus: string | null
  claimedAt: string | null
  completedAt: string | null
  driveLabel: string | null
  workLabel: string | null
  photos: CrewPhoto[]
}

function when(ts: string | null): string {
  if (!ts) return ""
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * What the crew actually did, on Anthony's side of the glass: when they claimed
 * it, how long they drove and worked, and the before/afters — each with the one
 * decision that matters, whether the customer sees it.
 */
export function JobCrewWork({
  crewName,
  fieldStatus,
  claimedAt,
  completedAt,
  driveLabel,
  workLabel,
  photos: initial,
}: CrewWorkProps) {
  const [photos, setPhotos] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)

  if (!crewName && photos.length === 0 && !claimedAt) return null

  async function toggle(id: string, visible: boolean) {
    setBusy(id)
    const res = await fetch(`/api/squeegee/photos/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visible }),
    })
    setBusy(null)
    if (res.ok) {
      setPhotos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, customer_visible: visible } : p))
      )
    }
  }

  const timeline = [
    claimedAt && { icon: Check, label: `${crewName ?? "Crew"} claimed it`, at: claimedAt },
    fieldStatus === "on_my_way" && { icon: Truck, label: "On the way", at: null },
    fieldStatus === "in_progress" && { icon: Play, label: "Working now", at: null },
    completedAt && { icon: MapPin, label: "Finished", at: completedAt },
  ].filter(Boolean) as { icon: typeof Check; label: string; at: string | null }[]

  return (
    <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-panel)] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-semibold">Crew work</h2>
        {(driveLabel || workLabel) && (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {workLabel ?? "0m"} on site
            {driveLabel ? ` · ${driveLabel} driving` : ""}
          </span>
        )}
      </div>

      {timeline.length > 0 && (
        <ul className="space-y-1.5 mb-4">
          {timeline.map((t, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <t.icon className="h-3.5 w-3.5 text-[var(--crm-accent,#2D8C6F)]" />
              <span>{t.label}</span>
              {t.at && <span className="text-xs text-muted-foreground">{when(t.at)}</span>}
            </li>
          ))}
        </ul>
      )}

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Camera className="h-4 w-4" /> No photos yet.
        </p>
      ) : (
        (["before", "after"] as const).map((kind) => {
          const set = photos.filter((p) => p.kind === kind)
          if (set.length === 0) return null
          return (
            <div key={kind} className="mb-3 last:mb-0">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                {kind}
              </h3>
              <div className="flex flex-wrap gap-2">
                {set.map((p) => (
                  <div key={p.id} className="w-28">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url ?? ""}
                      alt={`${kind} photo`}
                      className="h-28 w-28 rounded-lg object-cover border border-[var(--crm-border)]"
                    />
                    <button
                      onClick={() => toggle(p.id, !p.customer_visible)}
                      disabled={busy === p.id}
                      className={`mt-1 w-full rounded-md px-1.5 py-1 text-[11px] font-medium inline-flex items-center justify-center gap-1 disabled:opacity-60 ${
                        p.customer_visible
                          ? "bg-[#2D8C6F]/15 text-[#4FC49E]"
                          : "border border-[var(--crm-border)] text-muted-foreground"
                      }`}
                    >
                      {p.customer_visible ? (
                        <>
                          <Eye className="h-3 w-3" /> On receipt
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3 w-3" /> Internal
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}

      {photos.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Only photos marked &ldquo;On receipt&rdquo; are shown to the customer.
        </p>
      )}
    </div>
  )
}
