import { Suspense } from "react"
import { LandingContent } from "./landing-content"

/**
 * Server-rendered fallback content visible to crawlers (Bing, Google)
 * while the client component hydrates. Hidden once LandingContent loads.
 */
function CrawlerFallback() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <h1
        style={{ fontFamily: "var(--font-brand-display), serif" }}
        className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-[#2B2B2B]"
      >
        Charlotte&apos;s Trusted <span className="text-[#3A6B4C]">Pressure Washing</span> Pros
      </h1>
      <p className="text-lg text-[#2B2B2B]/60 mb-6">House Calls for a Cleaner Home</p>
      <p className="text-[#2B2B2B]/50 mb-8">
        Professional house washing, driveway cleaning, window cleaning, surface cleaning, pool decks, and pavers in Charlotte, NC.
        Licensed, insured, 5-star rated. Serving Charlotte, Huntersville, Matthews, Mint Hill, Ballantyne, South End, and the greater Mecklenburg County area.
      </p>
      <ul className="text-left max-w-md mx-auto space-y-2 text-[#2B2B2B]/70 mb-8">
        <li>House Washing — Soft wash of exterior siding, eaves, and trim</li>
        <li>Window Cleaning — Streak-free interior and exterior window cleaning</li>
        <li>Surface Cleaning — High-pressure cleaning of walkways and patios</li>
        <li>Driveway — Full driveway pressure wash</li>
        <li>Pool Deck — Pressure wash and surface treatment</li>
        <li>Pavers — Paver pressure wash with joint sand preservation</li>
      </ul>
      <a
        href="tel:+19802428048"
        className="inline-flex items-center gap-2 text-[#F5F0E1] font-semibold py-3.5 px-8 rounded-lg text-lg bg-[#3A6B4C]"
      >
        Call (980) 242-8048
      </a>
    </div>
  )
}

export default function GetQuotePage() {
  return (
    <Suspense fallback={<CrawlerFallback />}>
      <LandingContent />
    </Suspense>
  )
}
