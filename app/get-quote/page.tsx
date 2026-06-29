import { Suspense } from "react"
import { LandingContent } from "./landing-content"

/**
 * Server-rendered fallback content visible to crawlers (Bing, Google)
 * while the client component hydrates. Hidden once LandingContent loads.
 */
function CrawlerFallback() {
  return (
    <div className="bg-[#0A0A0A] min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1
          style={{ fontFamily: "var(--font-brand-display), serif" }}
          className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-white"
        >
          Charlotte&apos;s Trusted <span className="text-[#2D8C6F]">Window Cleaning</span> Pros
        </h1>
        <p className="text-lg text-[#9CA3AF] mb-6">Streak-free windows, every single time.</p>
        <p className="text-[#9CA3AF]/70 mb-8">
          Professional interior &amp; exterior window cleaning in Charlotte, NC — on a simple monthly, quarterly, or weekly plan.
          Plus house washing, driveways, patios, pool decks and pressure washing as add-ons. Licensed, insured, 5-star rated.
          Serving Charlotte, Huntersville, Matthews, Mint Hill, Ballantyne, South End, and the greater Mecklenburg County area.
        </p>
        <ul className="text-left max-w-md mx-auto space-y-2 text-[#9CA3AF]/80 mb-8">
          <li>Window Cleaning — Streak-free interior and exterior glass, screens &amp; sills</li>
          <li>Storefront Glass — Weekly or bi-weekly commercial routes</li>
          <li>House Washing — Soft wash of exterior siding, eaves, and trim</li>
          <li>Driveways &amp; Patios — Pressure washing of concrete, pavers, and pool decks</li>
          <li>Recurring Plans — Monthly, quarterly, or weekly. Cancel anytime.</li>
        </ul>
        <a
          href="tel:+19802428048"
          className="inline-flex items-center gap-2 text-[#0A0A0A] font-semibold py-3.5 px-8 rounded-lg text-lg bg-[#2D8C6F]"
        >
          Call (980) 242-8048
        </a>
      </div>
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
