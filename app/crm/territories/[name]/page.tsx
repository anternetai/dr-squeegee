"use client"

import { useState, useEffect, useCallback, useRef, use } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  MapPin,
  DoorOpen,
  Target,
  TrendingUp,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Users,
  BarChart2,
  AlertTriangle,
  Info,
  CheckCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { TerritoryMap } from "@/components/portal/the-move/territory-map"
import { DoorLogOverlay } from "@/components/portal/the-move/door-log-overlay"
import type { TerritoryDoor, DoorVisit } from "@/lib/the-move/types"
import { cn } from "@/lib/utils"

const PROXIMITY_METERS = 20

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * 111000
  const dLng = (lng2 - lng1) * 111000 * Math.cos((lat1 * Math.PI) / 180)
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

function pct(val: number) {
  return `${Math.round(val * 100)}%`
}

function contactRateColor(rate: number) {
  if (rate >= 0.25) return "text-green-600 dark:text-green-400"
  if (rate >= 0.15) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

function closeRateColor(rate: number) {
  if (rate >= 0.2) return "text-green-600 dark:text-green-400"
  if (rate >= 0.1) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

interface DetailedKpis {
  total_doors: number
  doors_answered: number
  doors_pitched: number
  doors_closed: number
  doors_not_interested: number
  contact_rate: number
  pitch_rate: number
  close_rate: number
  total_revenue: number
  avg_revenue_per_door: number
  avg_ticket_size: number
  last_knocked: string | null
}

interface Recommendation {
  type: "warning" | "info" | "success"
  title: string
  message: string
}

interface TerritoryDetail {
  id: string
  name: string
  address: string | null
  center_lat: number | null
  center_lng: number | null
  zoom_level: number
}

export default function CrmTerritoryDetailPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const territoryName = decodeURIComponent(name)

  const [loading, setLoading] = useState(true)
  const [territory, setTerritory] = useState<TerritoryDetail | null>(null)
  const [doors, setDoors] = useState<TerritoryDoor[]>([])
  const [kpis, setKpis] = useState<DetailedKpis | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [benchmarksOpen, setBenchmarksOpen] = useState(false)

  // Logging state
  const [logMode, setLogMode] = useState<"idle" | "new" | "revisit">("idle")
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedDoor, setSelectedDoor] = useState<TerritoryDoor | null>(null)

  // Door detail popup
  const [detailDoor, setDetailDoor] = useState<TerritoryDoor | null>(null)

  // Proximity prompt
  const [nearbyDoor, setNearbyDoor] = useState<TerritoryDoor | null>(null)
  const [nearbyCoords, setNearbyCoords] = useState<{ lat: number; lng: number } | null>(null)

  // Map instance ref for bounds saving
  const mapInstanceRef = useRef<any>(null)
  const saveBoundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchTerritory = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/territories/${encodeURIComponent(territoryName)}`)
      if (!res.ok) return
      const data = await res.json()
      setTerritory(data.territory ?? null)
      setDoors((data.doors ?? []) as TerritoryDoor[])
      setKpis(data.kpis ?? null)
      setRecommendations(data.recommendations ?? [])
    } catch (err) {
      console.error("[territory-detail] fetch error:", err)
    } finally {
      setLoading(false)
    }
  }, [territoryName])

  useEffect(() => {
    fetchTerritory()
  }, [fetchTerritory])

  // Save map bounds (debounced 2s)
  const saveBounds = useCallback(
    (map: any) => {
      if (saveBoundsTimerRef.current) clearTimeout(saveBoundsTimerRef.current)
      saveBoundsTimerRef.current = setTimeout(async () => {
        try {
          const center = map.getCenter()
          const zoom = map.getZoom()
          await fetch(`/api/crm/territories/${encodeURIComponent(territoryName)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              center_lat: center.lat,
              center_lng: center.lng,
              zoom_level: zoom,
            }),
          })
        } catch (err) {
          console.error("[territory-detail] save bounds error:", err)
        }
      }, 2000)
    },
    [territoryName],
  )

  // Wire up map moveend once we have the instance
  const handleMapReady = useCallback(
    (map: any) => {
      mapInstanceRef.current = map
      map.on("moveend", () => saveBounds(map))
    },
    [saveBounds],
  )

  // Map click handler — check proximity
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (logMode !== "idle") return

      for (const door of doors) {
        const dist = distanceMeters(lat, lng, door.lat, door.lng)
        if (dist <= PROXIMITY_METERS) {
          setNearbyDoor(door)
          setNearbyCoords({ lat, lng })
          return
        }
      }

      setPendingCoords({ lat, lng })
      setLogMode("new")
    },
    [doors, logMode],
  )

  // Door pin click — show detail
  const handleDoorClick = useCallback(
    (door: TerritoryDoor) => {
      if (logMode !== "idle") return
      setDetailDoor(door)
    },
    [logMode],
  )

  // Complete new door log
  async function handleNewDoorComplete(visit: DoorVisit) {
    if (!pendingCoords) return

    const createRes = await fetch(
      `/api/crm/territories/${encodeURIComponent(territoryName)}/doors`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: pendingCoords.lat,
          lng: pendingCoords.lng,
        }),
      },
    )
    if (!createRes.ok) return

    const data = await createRes.json()
    const door = data.door

    await fetch(
      `/api/crm/territories/${encodeURIComponent(territoryName)}/doors/${door.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visit }),
      },
    )

    setPendingCoords(null)
    setLogMode("idle")
    fetchTerritory()
  }

  // Complete revisit
  async function handleRevisitComplete(visit: DoorVisit) {
    if (!selectedDoor) return

    await fetch(
      `/api/crm/territories/${encodeURIComponent(territoryName)}/doors/${selectedDoor.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visit }),
      },
    )

    setSelectedDoor(null)
    setLogMode("idle")
    setDetailDoor(null)
    fetchTerritory()
  }

  // Accept proximity prompt — revisit
  function handleAcceptNearby() {
    if (!nearbyDoor) return
    setSelectedDoor(nearbyDoor)
    setLogMode("revisit")
    setNearbyDoor(null)
    setNearbyCoords(null)
  }

  // Decline proximity prompt — new door at same coords
  function handleDeclineNearby() {
    if (!nearbyCoords) return
    setPendingCoords(nearbyCoords)
    setLogMode("new")
    setNearbyDoor(null)
    setNearbyCoords(null)
  }

  // Delete door
  async function handleDeleteDoor(id: string) {
    await fetch(
      `/api/crm/territories/${encodeURIComponent(territoryName)}/doors/${id}`,
      { method: "DELETE" },
    )
    setDetailDoor(null)
    fetchTerritory()
  }

  // Map center: use saved territory center or first door
  const mapCenter =
    territory?.center_lat && territory?.center_lng
      ? { lat: territory.center_lat, lng: territory.center_lng }
      : doors.length > 0
        ? { lat: doors[0].lat, lng: doors[0].lng }
        : null

  // Recommendation icon
  function RecIcon({ type }: { type: Recommendation["type"] }) {
    if (type === "warning") return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
    if (type === "success") return <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
    return <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
  }

  function recBorderClass(type: Recommendation["type"]) {
    if (type === "warning") return "border-red-400/40 bg-red-50 dark:bg-red-950/20"
    if (type === "success") return "border-green-400/40 bg-green-50 dark:bg-green-950/20"
    return "border-blue-400/40 bg-blue-50 dark:bg-blue-950/20"
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3A6B4C] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href="/crm/territories"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-lg font-bold text-foreground leading-tight">
            {territoryName}
          </h1>
          {territory?.address && (
            <p className="truncate text-xs text-muted-foreground">{territory.address}</p>
          )}
          {/* Mini stats row */}
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {kpis?.total_doors ?? 0} doors
            </span>
            <span className="flex items-center gap-1">
              <DoorOpen className="h-3 w-3" />
              {kpis?.doors_answered ?? 0} answered
            </span>
            <span className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              {kpis ? pct(kpis.close_rate) : "0%"} close
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards — horizontal scroll on mobile */}
      {kpis && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4">
          {[
            {
              label: "Doors",
              value: String(kpis.total_doors),
              icon: <MapPin className="h-3 w-3" />,
              colorClass: "text-foreground",
            },
            {
              label: "Contact",
              value: pct(kpis.contact_rate),
              icon: <Users className="h-3 w-3" />,
              colorClass: contactRateColor(kpis.contact_rate),
            },
            {
              label: "Pitch",
              value: pct(kpis.pitch_rate),
              icon: <BarChart2 className="h-3 w-3" />,
              colorClass: "text-foreground",
            },
            {
              label: "Close",
              value: pct(kpis.close_rate),
              icon: <Target className="h-3 w-3" />,
              colorClass: closeRateColor(kpis.close_rate),
            },
            {
              label: "Revenue",
              value: `$${kpis.total_revenue.toLocaleString()}`,
              icon: <DollarSign className="h-3 w-3" />,
              colorClass: "text-green-600 dark:text-green-400",
            },
            {
              label: "Rev/Door",
              value: `$${kpis.avg_revenue_per_door.toFixed(2)}`,
              icon: <TrendingUp className="h-3 w-3" />,
              colorClass: "text-foreground",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="flex-none rounded-xl border border-border bg-card px-3 py-2 text-center min-w-[72px]"
            >
              <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mb-1">
                {card.icon}
                <span>{card.label}</span>
              </div>
              <p className={cn("text-base font-bold leading-none", card.colorClass)}>
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Map Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground px-1">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: "#9ca3af" }} />Not Home</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: "#60a5fa" }} />Talked</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: "#f59e0b" }} />Pitched</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: "#22c55e" }} />Closed</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: "#ef4444" }} />Not Interested</span>
        <span className="text-muted-foreground/60">|</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: "#ffffff", background: "transparent" }} />1st knock</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: "#38bdf8", background: "transparent" }} />2nd knock</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: "#a855f7", background: "transparent" }} />3+ knocks</span>
      </div>

      {/* Map */}
      <div className="relative">
        <TerritoryMap
          doors={doors}
          onMapClick={handleMapClick}
          onDoorClick={handleDoorClick}
          center={mapCenter}
          zoom={territory?.zoom_level}
          onMapReady={handleMapReady}
        />

        {/* Proximity prompt */}
        {nearbyDoor && (
          <div className="absolute bottom-3 left-3 right-3 z-[1000] rounded-xl border border-[#3A6B4C]/50 bg-card/95 p-4 backdrop-blur shadow-lg">
            <p className="text-center text-sm font-semibold text-foreground">Re-visit this door?</p>
            <p className="mt-1 text-center text-xs text-muted-foreground capitalize">
              {nearbyDoor.status.replace("_", " ")} &middot;{" "}
              {nearbyDoor.total_visits} visit{nearbyDoor.total_visits !== 1 ? "s" : ""}
            </p>
            <div className="mt-3 flex justify-center gap-3">
              <Button
                onClick={handleAcceptNearby}
                className="h-11 w-28 bg-[#3A6B4C] hover:bg-[#2F5A3E] text-white font-bold"
              >
                <RotateCcw className="mr-1 h-4 w-4" />
                Re-visit
              </Button>
              <Button
                onClick={handleDeclineNearby}
                variant="outline"
                className="h-11 w-28 font-semibold"
              >
                New Door
              </Button>
            </div>
            <button
              type="button"
              onClick={() => { setNearbyDoor(null); setNearbyCoords(null) }}
              className="mt-2 w-full text-center text-xs text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        )}

        {/* New door log overlay */}
        {logMode === "new" && pendingCoords && (
          <DoorLogOverlay
            onComplete={handleNewDoorComplete}
            onCancel={() => { setLogMode("idle"); setPendingCoords(null) }}
          />
        )}

        {/* Revisit log overlay */}
        {logMode === "revisit" && selectedDoor && (
          <DoorLogOverlay
            onComplete={handleRevisitComplete}
            onCancel={() => { setLogMode("idle"); setSelectedDoor(null) }}
            isRevisit
            doorInfo={`${selectedDoor.total_visits} prior visit${selectedDoor.total_visits !== 1 ? "s" : ""}`}
          />
        )}

        {/* Door detail popup */}
        {detailDoor && logMode === "idle" && (
          <div className="absolute bottom-3 left-3 right-3 z-[1000] rounded-xl border border-border bg-card/95 p-4 backdrop-blur shadow-lg">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-foreground capitalize">
                  {detailDoor.status.replace("_", " ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {detailDoor.total_visits} visit{detailDoor.total_visits !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteDoor(detailDoor.id)}
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                  aria-label="Delete door"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDetailDoor(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Visit history */}
            <div className="max-h-32 space-y-2 overflow-y-auto mb-3">
              {[...detailDoor.visits].reverse().map((v, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 text-muted-foreground">{v.date}{v.time ? ` ${v.time}` : ""}</span>
                  <span
                    className={
                      v.closed
                        ? "text-green-600 dark:text-green-400"
                        : v.not_interested
                          ? "text-red-600 dark:text-red-400"
                          : v.pitched
                            ? "text-amber-600 dark:text-amber-400"
                            : v.answered
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-muted-foreground"
                    }
                  >
                    {v.closed
                      ? "Closed"
                      : v.not_interested
                        ? "Not interested"
                        : v.pitched
                          ? "Pitched"
                          : v.answered
                            ? "Talked"
                            : "No answer"}
                    {v.revenue ? ` — $${v.revenue}` : ""}
                  </span>
                  {v.notes && (
                    <span className="text-muted-foreground/70 truncate">{v.notes}</span>
                  )}
                </div>
              ))}
            </div>

            <Button
              onClick={() => {
                setSelectedDoor(detailDoor)
                setLogMode("revisit")
              }}
              className="w-full h-11 bg-[#3A6B4C] hover:bg-[#2F5A3E] text-white font-bold"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Knock Again
            </Button>
          </div>
        )}
      </div>

      {/* Tap hint when no doors */}
      {doors.length === 0 && logMode === "idle" && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
          <TrendingUp className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Tap the map to log your first door</p>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Insights</h2>
          {recommendations.map((rec, i) => (
            <div
              key={i}
              className={cn("rounded-xl border p-3", recBorderClass(rec.type))}
            >
              <div className="flex items-start gap-2">
                <RecIcon type={rec.type} />
                <div>
                  <p className="text-sm font-semibold text-foreground">{rec.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{rec.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Industry Benchmarks — collapsible */}
      <div className="rounded-xl border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setBenchmarksOpen(!benchmarksOpen)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
        >
          <span className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-[#3A6B4C]" />
            Industry Benchmarks
          </span>
          {benchmarksOpen
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {benchmarksOpen && (
          <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-2">
            {[
              { label: "Contact Rate", value: "20–35%", note: "Aim for 25%+" },
              { label: "Pitch Rate", value: "60–80%", note: "of contacts" },
              { label: "Close Rate", value: "15–30%", note: "of pitches — 20%+ is solid" },
              { label: "Revenue/Door", value: "$5–15", note: "average" },
              { label: "Doors/Hour", value: "15–25", note: "20 is a good target" },
              { label: "Best Times", value: "4–7 pm weekdays", note: "Saturdays 10 am – 4 pm" },
            ].map((b) => (
              <div key={b.label} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{b.label}</span>
                <span className="text-right">
                  <span className="font-semibold text-foreground">{b.value}</span>
                  {b.note && <span className="text-muted-foreground"> — {b.note}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

