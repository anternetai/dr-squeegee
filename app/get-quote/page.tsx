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
          href="tel:+17042869696"
          className="inline-flex items-center gap-2 text-[#0A0A0A] font-semibold py-3.5 px-8 rounded-lg text-lg bg-[#2D8C6F]"
        >
          Call (704) 286-9696
        </a>
        {/* SMS opt-in form — server-rendered as real markup so carrier/A2P vetting
            crawlers (which fetch raw HTML, no JS) can verify the CTA: phone field +
            optional unchecked consent checkbox. The interactive quote wizard replaces
            this on hydration; the same step is live at /get-quote?step=contact.
            Campaign QE2c6890 was rejected 30909 when this existed only client-side. */}
        <div className="text-left max-w-md mx-auto mt-10 bg-[#111111] border border-[#242424] rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-1">Almost done — where do we send it?</h2>
          <p className="text-sm text-[#9CA3AF]/60 mb-4">We&apos;ll text your quote. No spam, ever.</p>
          <div className="space-y-3">
            <input type="text" name="first_name" placeholder="First name" className="w-full px-4 py-3 bg-[#1A1A1A] border border-[#242424] rounded-lg text-sm text-white placeholder:text-[#9CA3AF]/40" />
            <input type="tel" name="phone" placeholder="Phone number" className="w-full px-4 py-3 bg-[#1A1A1A] border border-[#242424] rounded-lg text-sm text-white placeholder:text-[#9CA3AF]/40" />
            <div className="flex items-start gap-3 pt-1">
              <input type="checkbox" id="sms-consent-ssr" name="sms_consent" className="mt-1 h-4 w-4 shrink-0 rounded border-[#242424] accent-[#2D8C6F]" />
              <label htmlFor="sms-consent-ssr" className="text-[11px] text-[#9CA3AF]/60 leading-relaxed">
                I agree to receive SMS text messages from Dr. Squeegee at the number provided (quote follow-ups,
                reminders, service updates). Msg frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out.
                See our <a href="/privacy" className="underline text-[#2D8C6F]">Privacy Policy</a> &amp;{" "}
                <a href="/terms" className="underline text-[#2D8C6F]">Terms</a>.
              </label>
            </div>
            <span className="block w-full text-center font-semibold py-3.5 rounded-lg text-white bg-[#2D8C6F]">Get My Free Quote</span>
          </div>
          <p className="text-[11px] text-[#9CA3AF]/60 mt-4">
            Reply HELP for help. Consent is not a condition of purchase. No mobile information will be shared
            with third parties or affiliates for marketing or promotional purposes.
          </p>
          <p className="text-[11px] mt-2 text-[#9CA3AF]/60">
            <a href="/sms" className="underline">SMS Program</a> ·{" "}
            <a href="/privacy" className="underline">Privacy Policy</a> ·{" "}
            <a href="/terms" className="underline">Terms of Service</a>
          </p>
        </div>
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
