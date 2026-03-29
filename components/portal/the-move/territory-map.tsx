"use client"

import { useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Locate } from "lucide-react"
import type { TerritoryDoor } from "@/lib/the-move/types"

const LeafletMap = dynamic(() => import("./territory-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[65vh] items-center justify-center rounded-xl border border-stone-800 bg-stone-900">
      <div className="size-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
    </div>
  ),
})

interface TerritoryMapProps {
  doors: TerritoryDoor[]
  onMapClick: (lat: number, lng: number) => void
  onDoorClick: (door: TerritoryDoor) => void
  center?: { lat: number; lng: number } | null
  zoom?: number
  onMapReady?: (map: any) => void
}

export function TerritoryMap({ doors, onMapClick, onDoorClick, center, zoom, onMapReady }: TerritoryMapProps) {
  const [mapInstance, setMapInstance] = useState<any>(null)

  const handleMapReady = useCallback((map: any) => {
    setMapInstance(map)
    onMapReady?.(map)
  }, [onMapReady])

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (mapInstance) {
          mapInstance.setView([pos.coords.latitude, pos.coords.longitude], 17)
        }
      },
      () => {},
      { enableHighAccuracy: true }
    )
  }, [mapInstance])

  return (
    <div className="relative">
      <LeafletMap
        doors={doors}
        onMapClick={onMapClick}
        onDoorClick={onDoorClick}
        onMapReady={handleMapReady}
        center={center}
        zoom={zoom}
      />

      <Button
        variant="outline"
        size="icon"
        onClick={handleLocateMe}
        className="absolute top-3 right-3 z-[1000] bg-stone-900 border-stone-700 hover:bg-stone-800"
      >
        <Locate className="size-4 text-amber-400" />
      </Button>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        {[
          { color: "#9ca3af", label: "1 visit" },
          { color: "#60a5fa", label: "2 visits" },
          { color: "#f59e0b", label: "3 visits" },
          { color: "#22c55e", label: "4+ visits" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full" style={{ background: color }} />
            <span className="text-[10px] text-stone-500">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full border-2 border-green-500 bg-stone-600" />
          <span className="text-[10px] text-stone-500">closed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full border-2 border-red-500 bg-stone-600" />
          <span className="text-[10px] text-stone-500">not int.</span>
        </div>
      </div>
    </div>
  )
}
