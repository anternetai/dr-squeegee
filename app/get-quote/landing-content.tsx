"use client"

import { useState, useRef, useEffect } from "react"
import {
  Shield,
  Star,
  MapPin,
  CheckCircle,
  Phone,
  ChevronRight,
  Sparkles,
  Droplets,
  CalendarClock,
  Home,
} from "lucide-react"
import { BRAND, FONTS } from "@/lib/squeegee/brand"
import { FAQ_DATA, FAQSchema } from "./faq-schema"
import { QuickQuote } from "./quick-quote"

/* ──────────────────────────────────────────────────────────
   Dark theme tokens (window-first redesign)
   ink  #0C120F · panel #121B16 · panel2 #16221B · line #26352B
   green #3A6B4C · greenB #5AA374 · gold #C8973E · mute #A8C4B0
   ────────────────────────────────────────────────────────── */

const TRANSFORMATIONS = [
  {
    name: "Window Cleaning",
    tag: "Our specialty",
    description: "Interior & exterior glass, screens and sills — hand-scrubbed and squeegeed streak-free. Keep it that way on a recurring plan.",
    before: "/images/squeegee/window-before.jpg",
    after: "/images/squeegee/window-after.jpg",
  },
  {
    name: "House Washing",
    tag: "Add-on",
    description: "A gentle soft-wash lifts years of algae, mildew and grime off your siding — no high pressure, no damage.",
    before: "/images/squeegee/house-before.jpg",
    after: "/images/squeegee/house-after.jpg",
  },
  {
    name: "Driveways & Concrete",
    tag: "Add-on",
    description: "High-pressure cleaning blasts out dirt, oil, tire marks and dark stains — concrete looks poured-yesterday new.",
    before: "/images/squeegee/driveway-before.jpg",
    after: "/images/squeegee/driveway-after.jpg",
  },
] as const

const PLANS = [
  {
    tag: "Monthly",
    title: "Homes",
    blurb: "Spotless windows every single month. Our most popular plan for homeowners who want it handled.",
    features: ["Interior + exterior glass", "Screens & sills wiped", "Same crew every visit"],
    featured: false,
  },
  {
    tag: "Quarterly",
    title: "Seasonal",
    blurb: "Four cleans a year, timed to Charlotte's pollen, storms & holidays. Best value for most homes.",
    features: ["Everything in Monthly", "Priority scheduling", "Pressure-wash add-on discount"],
    featured: true,
  },
  {
    tag: "Weekly · Bi-Weekly",
    title: "Business",
    blurb: "Storefronts & offices that need to look sharp for every customer. Flexible cadence, one invoice.",
    features: ["Storefront glass & doors", "Before-hours service", "Monthly billing"],
    featured: false,
  },
] as const

const TOASTS = [
  { name: "James P.", area: "Myers Park", action: "booked a Quarterly plan" },
  { name: "Sarah M.", area: "Ballantyne", action: "got a free quote" },
  { name: "The Daily Grind Café", area: "South End", action: "started weekly service" },
  { name: "Mike R.", area: "Matthews", action: "booked a Monthly plan" },
  { name: "Lisa K.", area: "Huntersville", action: "got a free quote" },
]

const REVIEWS = [
  { name: "Sarah M.", neighborhood: "Ballantyne", text: "Streak-free and spotless — our windows haven't looked this good since the house was built. The monthly plan is worth every penny." },
  { name: "James T.", neighborhood: "South End", text: "We put our storefront on a weekly clean. The glass is always immaculate and customers notice. Couldn't be easier." },
  { name: "Lisa K.", neighborhood: "Huntersville", text: "Super responsive, fair pricing, incredible results. Same crew every time and they treat the house with respect." },
  { name: "Mike R.", neighborhood: "Matthews", text: "Booked a quote and they were out within the week. Windows AND the driveway look brand new. Neighbors keep asking." },
  { name: "Angela D.", neighborhood: "Mint Hill", text: "Pollen season used to ruin our glass. Now it's on autopilot and I never think about it. Highly recommend." },
  { name: "Chris W.", neighborhood: "University Area", text: "Professional, great communication, fair price. The whole property looks 10 years newer. Will use again." },
]

/* ── 50s oval logo crest (matches the embroidered jacket patch) ── */
function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 116" className={className} role="img" aria-label="Dr. Squeegee">
      {/* merrowed cream rim */}
      <ellipse cx="110" cy="58" rx="108" ry="54" fill="#EAE0C8" />
      {/* cream field + thin green inner ring */}
      <ellipse cx="110" cy="58" rx="98" ry="46" fill="#F5F0E1" stroke="#2F5A3F" strokeWidth="3" />
      <text x="110" y="69" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontWeight="900"
        fontSize="33" fill="#2F5A3F" letterSpacing="0.5">DR. SQUEEGEE</text>
    </svg>
  )
}

/* ── Before / After drag slider (reusable) ── */
function BeforeAfter({ before, after, label }: { before: string; after: string; label: string }) {
  const [pos, setPos] = useState(50)
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  function setFromClientX(clientX: number) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPos(Math.max(0, Math.min(100, pct)))
  }

  useEffect(() => {
    function move(e: MouseEvent | TouchEvent) {
      if (!dragging.current) return
      const x = "touches" in e ? e.touches[0].clientX : e.clientX
      setFromClientX(x)
    }
    function up() { dragging.current = false }
    window.addEventListener("mousemove", move)
    window.addEventListener("touchmove", move)
    window.addEventListener("mouseup", up)
    window.addEventListener("touchend", up)
    return () => {
      window.removeEventListener("mousemove", move)
      window.removeEventListener("touchmove", move)
      window.removeEventListener("mouseup", up)
      window.removeEventListener("touchend", up)
    }
  }, [])

  return (
    <div
      ref={ref}
      className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-[#26352B] select-none cursor-ew-resize"
      onMouseDown={(e) => { dragging.current = true; setFromClientX(e.clientX) }}
      onTouchStart={(e) => { dragging.current = true; setFromClientX(e.touches[0].clientX) }}
    >
      <img src={after} alt={`${label} after cleaning`} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      <span className="absolute bottom-3 right-3 text-[11px] font-bold uppercase tracking-widest bg-[#5AA374] text-[#0C120F] px-2.5 py-1 rounded-full">After</span>
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={before} alt={`${label} before cleaning`} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        <span className="absolute bottom-3 left-3 text-[11px] font-bold uppercase tracking-widest bg-[#0C120F]/80 text-white px-2.5 py-1 rounded-full">Before</span>
      </div>
      <div className="absolute top-0 bottom-0 w-0.5 bg-white/90 pointer-events-none" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white shadow-lg flex items-center justify-center text-[#0C120F]">
          <ChevronRight className="h-3.5 w-3.5 -mr-1 rotate-180" />
          <ChevronRight className="h-3.5 w-3.5 -ml-1" />
        </div>
      </div>
    </div>
  )
}

/* ── Rotating social-proof toast ── */
function SocialProofToast() {
  const [i, setI] = useState(0)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const first = setTimeout(() => setShow(true), 3500)
    const loop = setInterval(() => {
      setShow(false)
      setTimeout(() => {
        setI((p) => (p + 1) % TOASTS.length)
        setShow(true)
      }, 600)
    }, 6500)
    return () => { clearTimeout(first); clearInterval(loop) }
  }, [])

  const t = TOASTS[i]
  return (
    <div className={`fixed bottom-5 left-5 z-50 transition-all duration-500 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"}`}>
      <div className="flex items-center gap-3 rounded-xl border border-[#26352B] bg-[#16221B]/95 backdrop-blur px-4 py-3 shadow-2xl max-w-xs">
        <div className="h-9 w-9 shrink-0 rounded-full bg-[#5AA374]/15 flex items-center justify-center text-[#5AA374]">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="text-sm leading-tight">
          <div className="font-semibold text-white">{t.name} {t.action}</div>
          <div className="text-[#A8C4B0] text-xs">{t.area} · just now</div>
        </div>
      </div>
    </div>
  )
}

export function LandingContent() {
  return (
    <div className="bg-[#0C120F] text-white" style={{ fontFamily: FONTS.body }}>
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-50 bg-[#0C120F]/85 backdrop-blur border-b border-[#26352B]">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-5 py-3">
          <Logo className="h-10 w-auto" />
          <nav className="hidden md:flex items-center gap-8 text-sm text-[#A8C4B0]">
            <a href="#plans" className="hover:text-white transition-colors">Plans</a>
            <a href="#work" className="hover:text-white transition-colors">Transformations</a>
            <a href="#why" className="hover:text-white transition-colors">Why Us</a>
            <a href="/blog" className="hover:text-white transition-colors">Tips &amp; Guides</a>
          </nav>
          <div className="flex items-center gap-4">
            <a href={`tel:${BRAND.phoneTel}`} className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-[#A8C4B0] hover:text-white transition-colors">
              <Phone className="h-4 w-4" />
              {BRAND.phone}
            </a>
            <a href="#get-quote" className="inline-flex items-center gap-1.5 rounded-lg bg-[#5AA374] hover:bg-[#3A6B4C] text-[#0C120F] font-semibold text-sm px-4 py-2 transition-colors shadow-lg shadow-[#5AA374]/20">
              Get a Free Quote
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero with top-of-page quote form ── */}
      <section className="relative">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/images/squeegee/hero-pool.jpg')" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0C120F]/45 via-[#0C120F]/80 to-[#0C120F]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0C120F]/85 to-[#0C120F]/30" />

        <div className="relative max-w-6xl mx-auto px-5 pt-14 pb-14 md:pt-20 md:pb-20">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="h-px w-8 bg-[#5AA374]" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C8973E]">Charlotte · Professional Window Cleaning</span>
              </div>
              <h1 style={{ fontFamily: FONTS.display }} className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.04] tracking-tight mb-5">
                Streak-free windows,<br /><span className="text-[#5AA374]">every single time.</span>
              </h1>
              <p className="text-lg text-[#A8C4B0] leading-relaxed mb-3 max-w-xl">
                Inside and out, hand-cleaned and squeegeed to a spotless shine by uniformed Charlotte pros. Most homes done in under two hours — guaranteed streak-free.
              </p>
              <p className="text-sm text-white/55 mb-7 max-w-xl">
                Homes &amp; storefronts. <span className="text-[#C8973E] font-medium">Add pressure washing</span> for the full exterior.
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#A8C4B0]">
                <span className="flex items-center gap-2"><Shield className="h-4 w-4 text-[#5AA374]" />Licensed &amp; Insured</span>
                <span className="flex items-center gap-1.5 text-[#C8973E]">★★★★★ <span className="text-[#A8C4B0]">5.0 Google rating</span></span>
                <span className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-[#5AA374]" />Cancel anytime</span>
              </div>
              <a href="#work" className="inline-flex items-center gap-1.5 mt-6 text-sm font-medium text-white/80 hover:text-white transition-colors">
                See real transformations <ChevronRight className="h-4 w-4" />
              </a>
            </div>
            <div className="lg:pl-2">
              <QuickQuote id="get-quote" />
            </div>
          </div>
        </div>

        {/* Authority stat bar */}
        <div className="relative border-t border-[#26352B] bg-[#0C120F]/70 backdrop-blur">
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-[#26352B]">
            {[
              ["150+", "Homes Served"],
              ["5.0★", "Google Rating"],
              ["100%", "Streak-Free Guarantee"],
              ["Same-Week", "Service Available"],
            ].map(([big, small]) => (
              <div key={small} className="px-5 py-6 text-center">
                <div style={{ fontFamily: FONTS.display }} className="text-2xl md:text-4xl font-black text-white">{big}</div>
                <div className="text-[11px] uppercase tracking-widest text-[#A8C4B0] mt-1">{small}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What We Do + Transformations (merged, proof-driven) ── */}
      <section id="work" className="border-y border-[#26352B] bg-[#0a0f0c]">
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-20">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="h-px w-8 bg-[#C8973E]/50" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C8973E]">What We Do · The Proof</span>
            <span className="h-px w-8 bg-[#C8973E]/50" />
          </div>
          <h2 style={{ fontFamily: FONTS.display }} className="text-3xl md:text-4xl font-black text-center mb-3">Real Charlotte transformations.</h2>
          <p className="text-center text-[#A8C4B0] max-w-xl mx-auto mb-12">Windows are our specialty — but we handle the whole exterior. Drag any slider to see the difference.</p>

          <div className="grid md:grid-cols-3 gap-6">
            {TRANSFORMATIONS.map((t) => (
              <div key={t.name} className="flex flex-col">
                <BeforeAfter before={t.before} after={t.after} label={t.name} />
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg text-white">{t.name}</h3>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${t.tag === "Our specialty" ? "bg-[#5AA374]/20 text-[#5AA374]" : "bg-[#C8973E]/15 text-[#C8973E]"}`}>{t.tag}</span>
                  </div>
                  <p className="text-sm text-[#A8C4B0] leading-relaxed">{t.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-sm text-white/45 mb-5">Also: storefront glass, patios, pool decks &amp; pavers — add any to your plan.</p>
            <a href="#get-quote" className="inline-flex items-center gap-2 rounded-lg bg-[#5AA374] hover:bg-[#3A6B4C] text-[#0C120F] font-semibold px-7 py-3.5 transition-colors">
              Get My Free Quote <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Reviews ── */}
      <section className="max-w-6xl mx-auto px-5 py-16 md:py-20">
        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="h-px w-8 bg-[#C8973E]/50" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C8973E]">Testimonials</span>
          <span className="h-px w-8 bg-[#C8973E]/50" />
        </div>
        <h2 style={{ fontFamily: FONTS.display }} className="text-3xl md:text-4xl font-black text-center mb-10">What Charlotte says</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {REVIEWS.map((r) => (
            <div key={r.name} className="bg-[#121B16] border border-[#26352B] rounded-xl p-5">
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-[#C8973E] text-[#C8973E]" />
                ))}
              </div>
              <p className="text-sm text-white/85 mb-3 leading-relaxed">&ldquo;{r.text}&rdquo;</p>
              <p className="text-xs text-[#A8C4B0]/70">{r.name} · {r.neighborhood}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Plans ── */}
      <section id="plans" className="border-y border-[#26352B] bg-[#0a0f0c]">
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-20">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="h-px w-8 bg-[#C8973E]/50" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C8973E]">Set It &amp; Forget It</span>
            <span className="h-px w-8 bg-[#C8973E]/50" />
          </div>
          <h2 style={{ fontFamily: FONTS.display }} className="text-3xl md:text-4xl font-black text-center mb-3">Pick your clean. We handle the rest.</h2>
          <p className="text-center text-[#A8C4B0] max-w-xl mx-auto mb-12">One recurring visit keeps your glass spotless year-round. No contracts — pause or cancel anytime.</p>

          <div className="grid md:grid-cols-3 gap-5">
            {PLANS.map((p) => (
              <div key={p.title} className={`rounded-2xl p-7 transition-colors ${p.featured ? "border-2 border-[#5AA374] bg-[#16221B] relative shadow-2xl shadow-[#5AA374]/10" : "border border-[#26352B] bg-[#121B16] hover:border-[#5AA374]/40"}`}>
                {p.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C8973E] text-[#0C120F] text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">Best Value</span>
                )}
                <div className={`text-sm font-semibold uppercase tracking-widest mb-2 ${p.featured ? "text-[#C8973E]" : "text-[#5AA374]"}`}>{p.tag}</div>
                <div style={{ fontFamily: FONTS.display }} className="text-4xl font-black mb-1">{p.title}</div>
                <p className="text-[#A8C4B0] text-sm mb-6">{p.blurb}</p>
                <ul className="space-y-2.5 text-sm text-white/85 mb-7">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2"><CheckCircle className="h-4 w-4 text-[#5AA374] shrink-0 mt-0.5" />{f}</li>
                  ))}
                </ul>
                <a href="#get-quote" className={`block text-center rounded-lg py-3 font-semibold transition-colors ${p.featured ? "bg-[#5AA374] hover:bg-[#3A6B4C] text-[#0C120F]" : "bg-[#16221B] border border-[#26352B] hover:border-[#5AA374]/50 text-white"}`}>Get My Price</a>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-white/45 mt-8">
            Need the whole exterior done? <span className="text-[#C8973E] font-medium">Add pressure washing</span> — driveways, siding, patios — to any plan.
          </p>
        </div>
      </section>

      {/* ── Why Us ── */}
      <section id="why" className="max-w-5xl mx-auto px-5 py-16 md:py-20">
        <h2 style={{ fontFamily: FONTS.display }} className="text-3xl md:text-4xl font-black text-center mb-10">Why Charlotte chooses Dr. Squeegee</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            [Sparkles, "Streak-Free Guarantee", "If it's not spotless, we come back. No questions."],
            [Home, "Same Crew, Every Time", "Uniformed pros who learn your property and respect it."],
            [Shield, "Licensed & Insured", "Fully covered, background-checked, and professional."],
            [CalendarClock, "Recurring & Flexible", "Monthly, quarterly, or weekly. Pause or cancel anytime."],
            [Droplets, "Soft on Your Home", "The right pressure and pure water — never damage."],
            [MapPin, "Charlotte Local", "Born and operated right here in the Queen City."],
          ].map(([Icon, title, body]) => {
            const I = Icon as typeof Sparkles
            return (
              <div key={title as string} className="bg-[#121B16] border border-[#26352B] rounded-xl p-5">
                <I className="h-7 w-7 text-[#5AA374] mb-3" />
                <h3 className="font-semibold text-white mb-1">{title as string}</h3>
                <p className="text-sm text-[#A8C4B0]">{body as string}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-5 py-16">
        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="h-px w-8 bg-[#C8973E]/50" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C8973E]">Common Questions</span>
          <span className="h-px w-8 bg-[#C8973E]/50" />
        </div>
        <h2 style={{ fontFamily: FONTS.display }} className="text-3xl md:text-4xl font-black text-center mb-10">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {FAQ_DATA.map((faq) => (
            <details key={faq.question} className="bg-[#121B16] border border-[#26352B] rounded-xl overflow-hidden group">
              <summary className="p-5 cursor-pointer font-semibold text-white hover:bg-[#16221B] transition-colors list-none flex items-center justify-between">
                {faq.question}
                <ChevronRight className="h-4 w-4 text-[#A8C4B0]/50 transition-transform group-open:rotate-90" />
              </summary>
              <div className="px-5 pb-5 text-sm text-[#A8C4B0] leading-relaxed">{faq.answer}</div>
            </details>
          ))}
        </div>
      </section>

      {/* ── Final CTA band ── */}
      <section className="border-y border-[#26352B] bg-[#0a0f0c]">
        <div className="max-w-3xl mx-auto px-5 py-16 text-center">
          <h2 style={{ fontFamily: FONTS.display }} className="text-3xl md:text-4xl font-black mb-3">Ready for spotless windows?</h2>
          <p className="text-[#A8C4B0] mb-7">Free quote in under 60 seconds — we&apos;ll text you back within 2 hours.</p>
          <a href="#get-quote" className="inline-flex items-center gap-2 rounded-lg bg-[#5AA374] hover:bg-[#3A6B4C] text-[#0C120F] font-semibold text-lg px-8 py-4 transition-colors shadow-xl shadow-[#5AA374]/25">
            Get My Free Quote <ChevronRight className="h-5 w-5" />
          </a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-5 bg-[#0C120F]">
        <div className="max-w-4xl mx-auto text-center text-[#A8C4B0]/60 text-sm space-y-2">
          <Logo className="h-12 w-auto mx-auto mb-2" />
          <p>{BRAND.address}</p>
          <p><a href={`tel:${BRAND.phoneTel}`} className="hover:text-[#5AA374] transition-colors">{BRAND.phone}</a></p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <a href="/privacy" className="hover:text-[#5AA374] transition-colors underline">Privacy Policy</a>
            <span>·</span>
            <a href="/terms" className="hover:text-[#5AA374] transition-colors underline">Terms of Service</a>
          </div>
          <p className="text-xs text-[#A8C4B0]/30 pt-1">&copy; {new Date().getFullYear()} Dr. Squeegee House Washing. All rights reserved.</p>
        </div>
      </footer>

      <SocialProofToast />
      <FAQSchema />
    </div>
  )
}
