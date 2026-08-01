"use client"

import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip, useMap } from "react-leaflet"
import { useEffect } from "react"
import "leaflet/dist/leaflet.css"
import { doorState, DOOR_STATE_COLOR, DOOR_STATE_LABEL, type TerritoryDoor } from "@/lib/crm/field/types"

export interface TerritoryMapInnerProps {
  center: [number, number]
  zoom: number
  doors: TerritoryDoor[]
  /** Omit to render a read-only overview map. */
  onDoorClick?: (door: TerritoryDoor) => void
  className?: string
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
  className,
}: TerritoryMapInnerProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={className}
      style={{ width: "100%", height: "100%", background: "#0a0a0a" }}
      zoomControl={false}
      scrollWheelZoom={false}
    >
      {/* Carto's dark basemap — OpenStreetMap data, rendered dark so the map
          belongs to the CRM instead of glaring white inside it. Free, no key,
          attribution preserved as the licence requires. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      <Recenter center={center} zoom={zoom} />

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
