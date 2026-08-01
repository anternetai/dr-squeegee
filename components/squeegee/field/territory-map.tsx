"use client"

import dynamic from "next/dynamic"
import type { TerritoryMapInnerProps } from "./territory-map-inner"

// Leaflet touches `window` at import time, so the map can never be server
// rendered. Everything above this boundary stays SSR-safe.
const TerritoryMapInner = dynamic(() => import("./territory-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[var(--crm-surface)]">
      <div className="text-sm text-[var(--crm-text-faint)]">Loading map…</div>
    </div>
  ),
})

export function TerritoryMap(props: TerritoryMapInnerProps) {
  return <TerritoryMapInner {...props} />
}
