"use client"

import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip, useMap, useMapEvents } from "react-leaflet"
import { useEffect } from "react"
// NB: leaflet's stylesheet is imported by the wrapper (./territory-map), not
// here. Inside this lazily-imported module Turbopack emitted a ~1KB stub whose
// react-leaflet dependency chunks were never fetched, so the import promise
// hung forever and the map sat on its loading state.
import { doorState, DOOR_STATE_COLOR, DOOR_STATE_LABEL, type TerritoryDoor } from "@/lib/crm/field/types"

export interface TerritoryMapInnerProps {
  center: [number, number]
  zoom: number
  doors: TerritoryDoor[]
  /** Omit to render a read-only overview map. */
  onDoorClick?: (door: TerritoryDoor) => void
  /** Supply to make empty map taps log a new door. */
  onNewDoor?: (lat: number, lng: number) => void
  /** Tapping within this many metres of an existing pin re-opens that door
   *  instead of creating a duplicate next to it. */
  snapMetres?: number
  className?: string
}

const EARTH_RADIUS_M = 6371000

function metresBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function MapTapHandler({
  doors, onNewDoor, onDoorClick, snapMetres,
}: {
  doors: TerritoryDoor[]
  onNewDoor: (lat: number, lng: number) => void
  onDoorClick?: (door: TerritoryDoor) => void
  snapMetres: number
}) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng
      const nearby = doors.find((d) => metresBetween(lat, lng, d.lat, d.lng) <= snapMetres)
      if (nearby && onDoorClick) onDoorClick(nearby)
      else if (!nearby) onNewDoor(lat, lng)
    },
  })
  return null
}

/** Keeps the map honest when the parent swaps territory without remounting. */
function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom)
  }, [map, center[0], center[1], zoom]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function TerritoryMapInner({
  center,
  zoom,
  doors,
  onDoorClick,
  onNewDoor,
  snapMetres = 20,
  className,
}: TerritoryMapInnerProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={className}
      style={{ width: "100%", height: "100%", background: "#0a0a0a" }}
      zoomControl={false}
      scrollWheelZoom={Boolean(onNewDoor)}
    >
      {/* Carto's dark basemap — OpenStreetMap data, rendered dark so the map
          belongs to the CRM instead of glaring white inside it. Free, no key,
          attribution preserved as the licence requires. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      <Recenter center={center} zoom={zoom} />

      {onNewDoor && (
        <MapTapHandler
          doors={doors}
          onNewDoor={onNewDoor}
          onDoorClick={onDoorClick}
          snapMetres={snapMetres}
        />
      )}

      {doors.map((door) => {
        const state = doorState(door)
        const revisited = (door.visits?.length ?? 0) > 1
        const revenue = (door.visits ?? []).reduce((s, v) => s + (v.revenue ?? 0), 0)

        return (
          <CircleMarker
            key={door.id}
            center={[door.lat, door.lng]}
            radius={revenue > 0 ? 9 : 7}
            pathOptions={{
              fillColor: DOOR_STATE_COLOR[state],
              fillOpacity: state === "unworked" ? 0.55 : 0.9,
              // A white hairline marks a door that took more than one knock.
              color: revisited ? "#ffffff" : "transparent",
              weight: revisited ? 1.5 : 0,
            }}
            eventHandlers={
              onDoorClick
                ? {
                    click(e) {
                      e.originalEvent.stopPropagation()
                      onDoorClick(door)
                    },
                  }
                : undefined
            }
          >
            {/* Money is visible on the map — a closed door shows what it paid. */}
            <LeafletTooltip direction="top" offset={[0, -6]} opacity={1}>
              <span style={{ fontWeight: 600 }}>
                {revenue > 0 ? `$${revenue.toLocaleString()}` : DOOR_STATE_LABEL[state]}
              </span>
              {door.contact_name ? ` · ${door.contact_name}` : ""}
            </LeafletTooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
