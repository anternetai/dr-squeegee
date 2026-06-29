"use client"

import { useEffect } from "react"

export function PageViewTracker() {
  useEffect(() => {
    fetch("/api/squeegee/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: window.location.pathname,
        referrer: document.referrer || null,
      }),
    }).catch(() => {})
  }, [])

  return null
}
