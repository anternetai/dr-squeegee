import type { Metadata } from "next"
import { Phone, MapPin, Shield, Star } from "lucide-react"

export const metadata: Metadata = {
  title: "About Dr. Squeegee | Charlotte Window Cleaning",
  description: "Dr. Squeegee is Charlotte's trusted window cleaning specialist. Licensed, insured, and committed to quality exterior cleaning for homes and businesses.",
  alternates: { canonical: "https://www.drsqueegeeclt.com/about" },
  openGraph: {
    title: "About Dr. Squeegee | Charlotte Window Cleaning",
    description: "Licensed, insured, and committed to quality exterior cleaning in Charlotte, NC.",
    url: "https://www.drsqueegeeclt.com/about",
  },
}

function Logo() {
  return <img src="/images/squeegee/logo-badge.png" alt="Dr. Squeegee" className="h-14 w-auto" />
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <header className="border-b border-[#242424] bg-[#0A0A0A]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-5 py-3">
          <a href="/get-quote"><Logo /></a>
          <a href="tel:+19802428048" className="flex items-center gap-1.5 text-sm font-medium text-[#9CA3AF] hover:text-white transition-colors">
            <Phone className="h-4 w-4" />
            (980) 242-8048
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-16">
        <h1
          style={{ fontFamily: "var(--font-brand-display), Impact, sans-serif" }}
          className="text-3xl md:text-4xl font-bold mb-6 text-white"
        >
          About Dr. Squeegee
        </h1>

        <div className="space-y-6 text-[#9CA3AF] text-lg leading-relaxed">
          <p>
            Dr. Squeegee is a professional window cleaning and exterior washing service based in
            Charlotte, North Carolina. We specialize in streak-free window cleaning for homes and
            businesses, plus house washing, driveways, patios, solar panels, and gutters.
          </p>
          <p>
            Every job gets the same level of care — proper equipment, the right technique for your
            surfaces, and a thorough walkthrough when we&apos;re done. We use soft wash methods for
            delicate surfaces like siding and stucco, and high-pressure cleaning for concrete
            driveways and walkways.
          </p>

          <h2
            style={{ fontFamily: "var(--font-brand-display), Impact, sans-serif" }}
            className="text-2xl font-bold text-white pt-4"
          >
            Why Choose Dr. Squeegee
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: Shield, title: "Licensed & Insured", text: "Full liability coverage for every job. Your property is protected." },
              { icon: Star,   title: "5-Star Rated",       text: "Consistently rated 5 stars by Charlotte homeowners." },
              { icon: MapPin, title: "Locally Owned",      text: "Based in Charlotte, serving the greater metro area." },
              { icon: Phone,  title: "Free Estimates",     text: "Call or request a quote online — no obligation." },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="bg-[#111111] border border-[#242424] rounded-xl p-5">
                <Icon className="h-5 w-5 mb-2 text-[#2D8C6F]" />
                <h3 className="font-semibold mb-1 text-white">{title}</h3>
                <p className="text-sm text-[#9CA3AF]">{text}</p>
              </div>
            ))}
          </div>

          <h2
            style={{ fontFamily: "var(--font-brand-display), Impact, sans-serif" }}
            className="text-2xl font-bold text-white pt-4"
          >
            Service Area
          </h2>
          <p>
            We serve Charlotte and the surrounding areas including Huntersville, Cornelius,
            Matthews, Mint Hill, Indian Trail, Pineville, Ballantyne, South End, NoDa, Plaza
            Midwood, Dilworth, Myers Park, and the greater Mecklenburg County area.
          </p>

          <div className="pt-6">
            <a
              href="/get-quote"
              className="inline-flex items-center gap-2 text-white font-semibold py-3.5 px-8 rounded-lg text-lg bg-[#2D8C6F] hover:bg-[#1F6B54] transition-colors"
            >
              Get Your Free Quote
            </a>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#242424] py-6 px-5">
        <div className="max-w-4xl mx-auto text-center text-[#9CA3AF]/50 text-sm space-y-1">
          <p>Charlotte, NC</p>
          <p><a href="tel:+19802428048" className="hover:text-[#2D8C6F]">(980) 242-8048</a></p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <a href="/privacy" className="hover:text-[#2D8C6F] underline">Privacy Policy</a>
            <span>&middot;</span>
            <a href="/terms" className="hover:text-[#2D8C6F] underline">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
