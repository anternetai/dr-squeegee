"use client"

import { useEffect, useRef } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { TerritoryDoor } from "@/lib/the-move/types"

const CHARLOTTE = { lat: 35.2271, lng: -80.8431 }

// Pin fill color based on status — the primary visual distinction
function statusFillColor(status: string): string {
  if (status === "closed") return "#22c55e"           // green — sold
  if (status === "not_interested") return "#ef4444"    // red — dead lead
  if (status === "pitched") return "#f59e0b"           // amber — pitched but no close
  if (status === "talked") return "#60a5fa"            // blue — answered/talked
  return "#9ca3af"                                     // gray — not home
}

// Ring color for revisit count emphasis
function visitRingColor(count: number): string {
  if (count >= 3) return "#a855f7" // purple — knocked 3+ times
  if (count === 2) return "#38bdf8" // sky — knocked twice
  return "#ffffff"                  // white — first visit
}

function createDoorIcon(door: TerritoryDoor) {
  const fill = statusFillColor(door.status)
  const ring = visitRingColor(door.total_visits)
  const ringWidth = door.total_visits >= 2 ? 4 : 3
  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${fill};border:${ringWidth}px solid ${ring};box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e: { latlng: { lat: number; lng: number } }) {
      onClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function MapReady({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap()
  useEffect(() => {
    onReady(map)
  }, [map, onReady])
  return null
}

function MapCenterUpdater({ center, zoom }: { center: { lat: number; lng: number } | null; zoom?: number }) {
  const map = useMap()
  const hasSetCenter = useRef(false)
  useEffect(() => {
    if (center && !hasSetCenter.current) {
      map.setView([center.lat, center.lng], zoom ?? 16)
      hasSetCenter.current = true
    }
  }, [center, zoom, map])
  return null
}

interface Props {
  doors: TerritoryDoor[]
  onMapClick: (lat: number, lng: number) => void
  onDoorClick: (door: TerritoryDoor) => void
  onMapReady: (map: L.Map) => void
  center?: { lat: number; lng: number } | null
  zoom?: number
}

export default function TerritoryMapInner({
  doors,
  onMapClick,
  onDoorClick,
  onMapReady,
  center,
  zoom,
}: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-stone-800" style={{ height: "65vh" }}>
      <MapContainer
        center={[CHARLOTTE.lat, CHARLOTTE.lng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onClick={onMapClick} />
        <MapReady onReady={onMapReady} />
        {center && <MapCenterUpdater center={center} zoom={zoom} />}

        {doors.map((door) => (
          <Marker
            key={door.id}
            position={[door.lat, door.lng]}
            icon={createDoorIcon(door)}
            eventHandlers={{
              click: () => onDoorClick(door),
            }}
          />
        ))}
      </MapContainer>
    </div>
  )
}
