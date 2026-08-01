"use client"

import { useEffect, useState, type ComponentType } from "react"
import type { TerritoryMapInnerProps } from "./territory-map-inner"
// Statically bundled here so the lazily-imported map module carries no CSS
// dependency of its own — see the note in ./territory-map-inner.
import "leaflet/dist/leaflet.css"

/* Leaflet touches `window` at import time, so the map can never be server
   rendered. next/dynamic({ssr:false}) is the usual answer, but in this tree it
   intermittently left the loading fallback mounted even after the chunk had
   fetched 200. Importing it by hand inside an effect is one line longer and
   deterministic: nothing is imported until we are provably on the client, and
   the component swaps in when the promise resolves. */
export function TerritoryMap(props: TerritoryMapInnerProps) {
  const [Inner, setInner] = useState<ComponentType<TerritoryMapInnerProps> | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    import("./territory-map-inner")
      .then((mod) => {
        if (alive) setInner(() => mod.default)
      })
      .catch((err) => {
        console.error("[territory-map] failed to load:", err)
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [])

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--crm-surface)]">
        <div className="text-sm text-[var(--crm-dead)]">Map failed to load — reload the page.</div>
      </div>
    )
  }

  if (!Inner) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--crm-surface)]">
        <div className="text-sm text-[var(--crm-text-faint)]">Loading map…</div>
      </div>
    )
  }

  return <Inner {...props} />
}
