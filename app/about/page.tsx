import type { Metadata } from "next"
import { Phone, MapPin, Shield, Star } from "lucide-react"

export const metadata: Metadata = {
  title: "About Dr. Squeegee | Charlotte Pressure Washing",
  description: "Dr. Squeegee is Charlotte's trusted pressure washing specialist. Licensed, insured, and committed to quality exterior cleaning for homes and businesses.",
  alternates: {
    canonical: "https://www.drsqueegeeclt.com/about",
  },
  openGraph: {
    title: "About Dr. Squeegee | Charlotte Pressure Washing",
    description: "Licensed, insured, and committed to quality exterior cleaning in Charlotte, NC.",
    url: "https://www.drsqueegeeclt.com/about",
  },
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#FEFCF7] text-[#2B2B2B]" style={{ fontFamily: "var(--font-brand-body), sans-serif" }}>
      {/* Header */}
      <header className="border-b border-[#3A6B4C]/10 bg-[#FEFCF7]/90">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
          <a href="/get-quote">
            <img src="/images/squeegee/wordmark.png" alt="Dr. Squeegee" className="h-8" />
          </a>
          <a href="tel:+19802428048" className="flex items-center gap-1.5 text-sm font-medium text-[#3A6B4C]">
            <Phone className="h-4 w-4" />
            (980) 242-8048
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1 style={{ fontFamily: "var(--font-brand-display), serif" }} className="text-3xl md:text-4xl font-bold mb-6 text-[#2B2B2B]">
          About Dr. Squeegee
        </h1>

        <div className="prose prose-lg max-w-none space-y-6 text-[#2B2B2B]/80">
          <p>
            Dr. Squeegee is a professional pressure washing service based in Charlotte, North Carolina.
            We specialize in house washing, driveway cleaning, patio and deck restoration, and full
            exterior cleaning for residential properties.
          </p>

          <p>
            Every job gets the same level of care — proper equipment, the right technique for your
            surfaces, and a thorough walkthrough when we&apos;re done. We use soft wash methods for
            delicate surfaces like siding and stucco, and high-pressure cleaning for concrete
            driveways and walkways.
          </p>

          <h2 style={{ fontFamily: "var(--font-brand-display), serif" }} className="text-2xl font-bold text-[#2B2B2B] pt-4">
            Why Choose Dr. Squeegee
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 not-prose">
            <div className="bg-[#F5F0E1]/60 border border-[#3A6B4C]/10 rounded-xl p-5">
              <Shield className="h-6 w-6 mb-2 text-[#3A6B4C]" />
              <h3 className="font-semibold mb-1">Licensed &amp; Insured</h3>
              <p className="text-sm text-[#2B2B2B]/60">Full liability coverage for every job. Your property is protected.</p>
            </div>
            <div className="bg-[#F5F0E1]/60 border border-[#3A6B4C]/10 rounded-xl p-5">
              <Star className="h-6 w-6 mb-2 text-[#C8973E]" />
              <h3 className="font-semibold mb-1">5-Star Rated</h3>
              <p className="text-sm text-[#2B2B2B]/60">Consistently rated 5 stars by Charlotte homeowners.</p>
            </div>
            <div className="bg-[#F5F0E1]/60 border border-[#3A6B4C]/10 rounded-xl p-5">
              <MapPin className="h-6 w-6 mb-2 text-[#3A6B4C]" />
              <h3 className="font-semibold mb-1">Locally Owned</h3>
              <p className="text-sm text-[#2B2B2B]/60">Based in Charlotte, serving the greater metro area.</p>
            </div>
            <div className="bg-[#F5F0E1]/60 border border-[#3A6B4C]/10 rounded-xl p-5">
              <Phone className="h-6 w-6 mb-2 text-[#3A6B4C]" />
              <h3 className="font-semibold mb-1">Free Estimates</h3>
              <p className="text-sm text-[#2B2B2B]/60">Call or request a quote online — no obligation.</p>
            </div>
          </div>

          <h2 style={{ fontFamily: "var(--font-brand-display), serif" }} className="text-2xl font-bold text-[#2B2B2B] pt-4">
            Service Area
          </h2>
          <p>
            We serve Charlotte and the surrounding areas including Huntersville, Cornelius,
            Matthews, Mint Hill, Indian Trail, Pineville, Ballantyne, South End, NoDa, Plaza
            Midwood, Dilworth, Myers Park, and the greater Mecklenburg County area.
          </p>

          <div className="not-prose pt-6">
            <a
              href="/get-quote"
              className="inline-flex items-center gap-2 text-[#F5F0E1] font-semibold py-3.5 px-8 rounded-lg text-lg bg-[#3A6B4C] hover:bg-[#2F5A3F] transition-colors"
            >
              Get Your Free Quote
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#3A6B4C]/10 py-6 px-4 bg-[#F5F0E1]/30">
        <div className="max-w-4xl mx-auto text-center text-[#2B2B2B]/40 text-sm space-y-1">
          <p>Charlotte, NC</p>
          <p><a href="tel:+19802428048" className="hover:text-[#3A6B4C]">(980) 242-8048</a></p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <a href="/privacy" className="hover:text-[#3A6B4C] underline">Privacy Policy</a>
            <span>&middot;</span>
            <a href="/terms" className="hover:text-[#3A6B4C] underline">Terms of Service</a>
          </div>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "AboutPage",
            "mainEntity": {
              "@type": "LocalBusiness",
              "@id": "https://www.drsqueegeeclt.com/#business",
              "name": "Dr. Squeegee",
              "url": "https://www.drsqueegeeclt.com/get-quote",
            },
          }),
        }}
      />
    </div>
  )
}
