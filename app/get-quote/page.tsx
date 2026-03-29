import { Suspense } from "react"
import { LandingContent } from "./landing-content"

export default function GetQuotePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <LandingContent />
    </Suspense>
  )
}
