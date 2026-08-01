"use client"

import { useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Crosshair, Plus } from "lucide-react"
import { TerritoryMap } from "./territory-map"
import { DoorLogSheet, type DoorContact } from "./door-log-sheet"
import { StatTile } from "@/components/squeegee/crm/stat-tile"
import {
  computeKpis, doorState, type DoorVisit, type Territory, type TerritoryDoor,
} from "@/lib/crm/field/types"

interface Props {
  territory: Territory
  initialDoors: TerritoryDoor[]
}

type Pending =
  | { kind: "new"; lat: number; lng: number }
  | { kind: "revisit"; door: TerritoryDoor }
  | null

export function TerritoryWorkspace({ territory, initialDoors }: Props) {
  const router = useRouter()
  const [doors, setDoors] = useState<TerritoryDoor[]>(initialDoors)
  const [pending, setPending] = useState<Pending>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  const kpis = useMemo(() => computeKpis(doors), [doors])

  const mapped = doors.filter((d) => typeof d.lat === "number" && typeof d.lng === "number")
  const center: [number, number] = useMemo(() => {
    if (territory.center_lat != null && territory.center_lng != null) {
      return [territory.center_lat, territory.center_lng]
    }
    if (mapped.length) {
      return [
        mapped.reduce((s, d) => s + d.lat, 0) / mapped.length,
        mapped.reduce((s, d) => s + d.lng, 0) / mapped.length,
      ]
    }
    return [35.2271, -80.8431]
  }, [territory.center_lat, territory.center_lng, mapped])

  const handleSave = useCallback(
    async (visit: DoorVisit, contact: DoorContact) => {
      const target = pending
      if (!target) return

      const lat = target.kind === "new" ? target.lat : target.door.lat
      const lng = target.kind === "new" ? target.lng : target.door.lng

      const res = await fetch("/api/crm/field/doors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doorId: target.kind === "revisit" ? target.door.id : undefined,
          territoryId: territory.id,
          lat,
          lng,
          visit,
          contactName: contact.name ?? null,
          contactPhone: contact.phone ?? null,
          contactAddress: contact.address ?? null,
        }),
      })

      const data = await res.json()
      if (!res.ok && res.status !== 207) {
        throw new Error(data.error || "Could not save the door.")
      }

      // Optimistic local update so the pin recolours without a round trip.
      setDoors((prev) => {
        if (target.kind === "revisit") {
          return prev.map((d) =>
            d.id === target.door.id
              ? {
                  ...d,
                  visits: [...(d.visits ?? []), visit],
                  total_visits: (d.total_visits ?? 0) + 1,
                  status: data.status ?? d.status,
                  contact_name: contact.name ?? d.contact_name,
                  contact_phone: contact.phone ?? d.contact_phone,
                  crm_client_id: data.linked?.client_id ?? d.crm_client_id,
                }
              : d
          )
        }
        return [
          ...prev,
          {
            id: data.doorId,
            user_id: "",
            territory_id: territory.id,
            lat,
            lng,
            visits: [visit],
            status: data.status ?? "not_home",
            total_visits: 1,
            notes: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            contact_name: contact.name ?? null,
            contact_phone: contact.phone ?? null,
            contact_address: contact.address ?? null,
            crm_client_id: data.linked?.client_id ?? null,
            crm_job_id: data.linked?.job_id ?? null,
          } as TerritoryDoor,
        ]
      })

      setPending(null)

      if (data.warning) setBanner(data.warning)
      else if (data.linked?.job_id) setBanner("Saved — client and approved job created in the CRM.")
      else if (data.linked?.client_id) setBanner("Saved — client created in the CRM.")
      else setBanner("Door saved.")

      router.refresh()
    },
    [pending, territory.id, router]
  )

  function locate() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        setPending({ kind: "new", lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setLocating(false)
        setBanner("Could not get your location — tap the map instead.")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/crm/field"
            className="mb-1 inline-flex items-center gap-1.5 text-xs text-[var(--crm-text-faint)] hover:text-[var(--crm-text-dim)]"
          >
            <ArrowLeft className="h-3 w-3" /> Field
          </Link>
          <h2 className="truncate text-xl font-semibold tracking-tight">{territory.name}</h2>
          {territory.address && (
            <p className="mt-0.5 truncate text-sm text-[var(--crm-text-dim)]">{territory.address}</p>
          )}
        </div>
      </header>

      {banner && (
        <div className="flex items-start gap-3 rounded-xl border border-[var(--crm-accent-line)] bg-[var(--crm-accent-weak)] px-4 py-3 text-sm text-[var(--crm-accent)]">
          <span className="flex-1">{banner}</span>
          <button onClick={() => setBanner(null)} className="text-xs underline">dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Doors" value={kpis.total_doors} />
        <StatTile label="Contact" value={`${Math.round(kpis.contact_rate * 100)}%`} qualifier={`${kpis.doors_answered} answered`} />
        <StatTile label="Closed" value={kpis.doors_closed} tone={kpis.doors_closed ? "accent" : "neutral"} />
        <StatTile
          label="Revenue"
          value={`$${kpis.total_revenue.toLocaleString()}`}
          tone={kpis.total_revenue ? "accent" : "neutral"}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--crm-line)]">
        <div className="relative h-[420px] w-full md:h-[520px]">
          <TerritoryMap
            center={center}
            zoom={17}
            doors={mapped}
            onNewDoor={(lat, lng) => setPending({ kind: "new", lat, lng })}
            onDoorClick={(door) => setPending({ kind: "revisit", door })}
          />
          <button
            onClick={locate}
            disabled={locating}
            className="absolute right-3 top-3 z-[400] flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--crm-line)] bg-[var(--crm-surface)] text-[var(--crm-accent)] shadow-lg disabled:opacity-50"
            aria-label="Log the door I'm standing at"
          >
            <Crosshair className={locating ? "h-5 w-5 animate-pulse" : "h-5 w-5"} />
          </button>
        </div>
        <div className="flex items-center gap-2 border-t border-[var(--crm-line)] bg-[var(--crm-surface)] px-4 py-2.5 text-xs text-[var(--crm-text-faint)]">
          <Plus className="h-3.5 w-3.5" />
          Tap the map to log a door · tap a pin to revisit · crosshair uses your GPS
        </div>
      </div>

      {pending && (
        <>
          <div
            className="fixed inset-0 z-[499] bg-black/60"
            onClick={() => setPending(null)}
            aria-hidden
          />
          <DoorLogSheet
            lat={pending.kind === "new" ? pending.lat : pending.door.lat}
            lng={pending.kind === "new" ? pending.lng : pending.door.lng}
            isRevisit={pending.kind === "revisit"}
            initialContact={
              pending.kind === "revisit"
                ? {
                    name: pending.door.contact_name ?? undefined,
                    phone: pending.door.contact_phone ?? undefined,
                    address: pending.door.contact_address ?? undefined,
                  }
                : undefined
            }
            onSave={handleSave}
            onCancel={() => setPending(null)}
          />
        </>
      )}

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--crm-text-faint)]">
          Doors in this territory
        </h3>
        {doors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--crm-line)] px-4 py-10 text-center text-sm text-[var(--crm-text-dim)]">
            No doors yet — tap the map to log the first one.
          </div>
        ) : (
          <div className="divide-y divide-[var(--crm-line)] overflow-hidden rounded-xl border border-[var(--crm-line)] bg-[var(--crm-surface)]">
            {[...doors]
              .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
              .slice(0, 25)
              .map((d) => {
                const state = doorState(d)
                const rev = (d.visits ?? []).reduce((s, v) => s + (v.revenue ?? 0), 0)
                const last = (d.visits ?? [])[(d.visits ?? []).length - 1]
                return (
                  <button
                    key={d.id}
                    onClick={() => setPending({ kind: "revisit", door: d })}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--crm-surface-high)]"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        background: {
                          won: "#2d8c6f", answered: "#c8922f",
                          dead: "#b8453a", unworked: "#5f6672",
                        }[state],
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {d.contact_name || last?.notes?.trim() || `${last?.date ?? "Door"}`}
                      </span>
                      <span className="block truncate text-xs text-[var(--crm-text-faint)]">
                        {d.contact_phone || (d.total_visits > 1 ? `${d.total_visits} visits` : "tap to revisit")}
                      </span>
                    </span>
                    {rev > 0 && (
                      <span className="crm-numeral shrink-0 text-sm text-[var(--crm-accent)]">
                        ${rev.toLocaleString()}
                      </span>
                    )}
                  </button>
                )
              })}
          </div>
        )}
      </section>
    </div>
  )
}
