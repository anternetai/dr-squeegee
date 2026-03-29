"use client"

import { useState, useRef, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import {
  Shield,
  Star,
  MapPin,
  CheckCircle,
  Phone,
  ChevronRight,
} from "lucide-react"
import {
  SERVICES,
  REVIEWS,
  SERVICE_OPTIONS,
  PROPERTY_TYPES,
  TIMELINES,
} from "@/lib/squeegee/landing-data"
import { COLORS, BRAND, FONTS } from "@/lib/squeegee/brand"
import { FAQ_DATA, FAQSchema } from "./faq-schema"

const VIDEOS = [
  {
    src: "/videos/squeegee/driveway-cleaning.mp4",
    poster: "/videos/squeegee/driveway-cleaning-poster.jpg",
    title: "Driveway Cleaning",
    subtitle: "Midwood, Charlotte",
  },
  {
    src: "/videos/squeegee/house-washing.mp4",
    poster: "/videos/squeegee/house-washing-poster.jpg",
    title: "House Washing",
    subtitle: "Charlotte, NC",
  },
]

function AutoPlayVideo({ src, poster, className }: { src: string; poster: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const v = video
    // Try to play immediately once enough data is buffered
    function tryPlay() {
      v.play().catch(() => {
        // Autoplay blocked — show controls so user can tap to play
        v.controls = true
      })
    }

    // Pause when scrolled off screen, resume when visible
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          tryPlay()
        } else {
          video.pause()
        }
      },
      { threshold: 0.2 }
    )
    observer.observe(video)

    return () => observer.disconnect()
  }, [])

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay
      playsInline
      muted
      loop
      preload="auto"
      poster={poster}
      src={src}
    />
  )
}

function HeroVideo() {
  return (
    <section className="max-w-sm mx-auto px-4 py-10">
      <div className="rounded-xl overflow-hidden border border-[#3A6B4C]/10 bg-white shadow-sm">
        <AutoPlayVideo
          src="/videos/squeegee/house-washing.mp4"
          poster="/videos/squeegee/house-washing-poster.jpg"
          className="w-full aspect-[9/16] object-cover"
        />
      </div>
    </section>
  )
}

function VideoShowcase() {
  return (
    <section className="border-y border-[#3A6B4C]/10">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="h-px w-8 bg-[#C8973E]/50" />
          <span className="text-xs font-semibold uppercase tracking-widest text-[#C8973E]">See Our Work</span>
          <div className="h-px w-8 bg-[#C8973E]/50" />
        </div>
        <h2 style={{ fontFamily: FONTS.display }} className="text-2xl md:text-3xl font-bold text-center mb-10 text-[#2B2B2B]">
          Real Results, Real Homes
        </h2>
        <div className="grid grid-cols-2 gap-4 md:gap-6 max-w-2xl mx-auto">
          {VIDEOS.map((v) => (
            <div key={v.src} className="rounded-xl overflow-hidden border border-[#3A6B4C]/10 bg-white">
              <AutoPlayVideo
                src={v.src}
                poster={v.poster}
                className="w-full aspect-[9/16] object-cover"
              />
              <div className="p-3 text-center">
                <h3 className="font-semibold text-sm text-[#2B2B2B]">{v.title}</h3>
                <p className="text-xs text-[#2B2B2B]/50">{v.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function LandingContent() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const [selectedService, setSelectedService] = useState("")
  const [propertyType, setPropertyType] = useState("")
  const [timeline, setTimeline] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [smsConsent, setSmsConsent] = useState(false)

  const totalSteps = 4
  const progress = ((step - 1) / (totalSteps - 1)) * 100

  async function handleSubmit() {
    if (!name.trim() || !phone.trim() || !address.trim()) return
    setLoading(true)

    try {
      await fetch("/api/squeegee/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          address: address.trim(),
          services: [selectedService],
          property_type: propertyType,
          timeline,
          sms_consent: smsConsent,
          sms_consent_timestamp: smsConsent ? new Date().toISOString() : undefined,
          utm_source: searchParams.get("utm_source") ?? undefined,
          utm_medium: searchParams.get("utm_medium") ?? undefined,
          utm_campaign: searchParams.get("utm_campaign") ?? undefined,
        }),
      })
      setSubmitted(true)
    } catch (err) {
      console.error("Submit error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-50 bg-[#FEFCF7]/90 backdrop-blur-sm border-b border-[#3A6B4C]/10">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <img src="/images/squeegee/wordmark.png" alt="Dr. Squeegee" className="h-8" />
          <div className="flex items-center gap-4">
            <a
              href="/blog"
              className="hidden sm:inline text-sm font-medium text-[#3A6B4C] hover:opacity-80 transition-opacity"
            >
              Tips &amp; Guides
            </a>
            <a
              href={`tel:${BRAND.phoneTel}`}
              className="flex items-center gap-1.5 text-sm font-medium text-[#3A6B4C] hover:opacity-80 transition-opacity"
            >
              <Phone className="h-4 w-4" />
              {BRAND.phone}
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#F5F0E1] via-[#FEFCF7] to-[#FEFCF7]" />
        <div className="relative max-w-4xl mx-auto px-4 py-20 md:py-28 text-center">
          {/* Gold accent line */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-12 bg-[#C8973E]" />
            <Star className="h-4 w-4 text-[#C8973E] fill-[#C8973E]" />
            <div className="h-px w-12 bg-[#C8973E]" />
          </div>
          <h1
            style={{ fontFamily: FONTS.display }}
            className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4 text-[#2B2B2B]"
          >
            Charlotte&apos;s Trusted{" "}
            <span className="text-[#3A6B4C]">Pressure Washing</span> Pros
          </h1>
          <p className="text-lg md:text-xl text-[#2B2B2B]/60 mb-2 max-w-2xl mx-auto">
            {BRAND.tagline}
          </p>
          <p className="text-sm text-[#2B2B2B]/40 mb-8">
            House washing, driveways, patios — done right, every time.
          </p>
          <a
            href="#get-quote"
            className="inline-flex items-center gap-2 text-[#F5F0E1] font-semibold py-3.5 px-8 rounded-lg text-lg transition-colors bg-[#3A6B4C] hover:bg-[#2F5A3F]"
          >
            Get Your Free Quote
            <ChevronRight className="h-5 w-5" />
          </a>
        </div>
      </section>

      {/* ── Trust Bar ── */}
      <section className="border-y border-[#3A6B4C]/10 bg-[#F5F0E1]/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-[#2B2B2B]/70">
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#3A6B4C]" />
            Licensed &amp; Insured
          </span>
          <span className="flex items-center gap-2">
            <Star className="h-4 w-4 text-[#C8973E] fill-[#C8973E]" />
            5-Star Rated
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#3A6B4C]" />
            Charlotte, NC
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-[#3A6B4C]" />
            Free Estimates
          </span>
        </div>
      </section>

      {/* ── Hero Video ── */}
      <HeroVideo />

      {/* ── Services Grid ── */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="h-px w-8 bg-[#C8973E]/50" />
          <span className="text-xs font-semibold uppercase tracking-widest text-[#C8973E]">What We Do</span>
          <div className="h-px w-8 bg-[#C8973E]/50" />
        </div>
        <h2 style={{ fontFamily: FONTS.display }} className="text-2xl md:text-3xl font-bold text-center mb-10 text-[#2B2B2B]">
          Our Services
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICES.map((svc) => {
            const Icon = svc.icon
            return (
              <div
                key={svc.name}
                className="bg-[#F5F0E1]/60 border border-[#3A6B4C]/10 rounded-xl p-5 hover:border-[#3A6B4C]/25 transition-colors"
              >
                <Icon className="h-8 w-8 mb-3 text-[#3A6B4C]" />
                <h3 className="font-semibold text-base mb-1 text-[#2B2B2B]">{svc.name}</h3>
                <p className="text-sm text-[#2B2B2B]/60">{svc.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Video Showcase ── */}
      <VideoShowcase />

      {/* ── Reviews ── */}
      <section className="bg-[#F5F0E1]/40 border-b border-[#3A6B4C]/10">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-px w-8 bg-[#C8973E]/50" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[#C8973E]">Testimonials</span>
            <div className="h-px w-8 bg-[#C8973E]/50" />
          </div>
          <h2 style={{ fontFamily: FONTS.display }} className="text-2xl md:text-3xl font-bold text-center mb-10 text-[#2B2B2B]">
            What Our Customers Say
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {REVIEWS.map((r) => (
              <div
                key={r.name}
                className="bg-white border border-[#3A6B4C]/10 rounded-xl p-5"
              >
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-[#C8973E] text-[#C8973E]"
                    />
                  ))}
                </div>
                <p className="text-sm text-[#2B2B2B]/80 mb-3 leading-relaxed">
                  &ldquo;{r.text}&rdquo;
                </p>
                <p className="text-xs text-[#2B2B2B]/40">
                  {r.name} &middot; {r.neighborhood}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="h-px w-8 bg-[#C8973E]/50" />
          <span className="text-xs font-semibold uppercase tracking-widest text-[#C8973E]">Common Questions</span>
          <div className="h-px w-8 bg-[#C8973E]/50" />
        </div>
        <h2 style={{ fontFamily: FONTS.display }} className="text-2xl md:text-3xl font-bold text-center mb-10 text-[#2B2B2B]">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {FAQ_DATA.map((faq) => (
            <details key={faq.question} className="bg-white border border-[#3A6B4C]/10 rounded-xl overflow-hidden group">
              <summary className="p-5 cursor-pointer font-semibold text-[#2B2B2B] hover:bg-[#F5F0E1]/40 transition-colors list-none flex items-center justify-between">
                {faq.question}
                <ChevronRight className="h-4 w-4 text-[#2B2B2B]/30 transition-transform group-open:rotate-90" />
              </summary>
              <div className="px-5 pb-5 text-sm text-[#2B2B2B]/70 leading-relaxed">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ── Multi-Step Quote Form ── */}
      <section id="get-quote" className="max-w-xl mx-auto px-4 py-16">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="h-px w-8 bg-[#C8973E]/50" />
          <span className="text-xs font-semibold uppercase tracking-widest text-[#C8973E]">Free Estimate</span>
          <div className="h-px w-8 bg-[#C8973E]/50" />
        </div>
        <h2 style={{ fontFamily: FONTS.display }} className="text-2xl md:text-3xl font-bold text-center mb-2 text-[#2B2B2B]">
          Get Your Free Quote
        </h2>
        <p className="text-[#2B2B2B]/50 text-center mb-8">
          Takes less than 60 seconds.
        </p>

        <div className="bg-white border border-[#3A6B4C]/10 rounded-xl p-6 md:p-8 shadow-sm">
          {/* Progress bar */}
          {!submitted && (
            <div className="mb-6">
              <div className="h-1.5 bg-[#F5F0E1] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300 bg-[#3A6B4C]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-[#2B2B2B]/40 mt-2 text-center">
                Step {step} of {totalSteps}
              </p>
            </div>
          )}

          {submitted ? (
            /* ── Confirmation ── */
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-[#3A6B4C]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-[#3A6B4C]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 style={{ fontFamily: FONTS.display }} className="text-xl font-semibold mb-2 text-[#2B2B2B]">You&apos;re All Set!</h3>
              <p className="text-[#2B2B2B]/60">
                We&apos;ll call you within 2 hours to discuss your project.
              </p>
            </div>
          ) : step === 1 ? (
            /* ── Step 1: Service ── */
            <div>
              <h3 style={{ fontFamily: FONTS.display }} className="text-lg font-semibold mb-1 text-center text-[#2B2B2B]">
                What do you need cleaned?
              </h3>
              <p className="text-sm text-[#2B2B2B]/40 mb-5 text-center">
                Select one to continue.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {SERVICE_OPTIONS.map((svc) => (
                  <button
                    key={svc}
                    onClick={() => {
                      setSelectedService(svc)
                      setStep(2)
                    }}
                    className="py-3 px-4 rounded-lg border border-[#3A6B4C]/15 bg-[#F5F0E1]/40 hover:border-[#3A6B4C]/40 hover:bg-[#F5F0E1] transition-colors text-sm font-medium text-left text-[#2B2B2B]"
                  >
                    {svc}
                  </button>
                ))}
              </div>
            </div>
          ) : step === 2 ? (
            /* ── Step 2: Property Type ── */
            <div>
              <h3 style={{ fontFamily: FONTS.display }} className="text-lg font-semibold mb-1 text-center text-[#2B2B2B]">
                What type of property?
              </h3>
              <p className="text-sm text-[#2B2B2B]/40 mb-5 text-center">
                Helps us give you an accurate quote.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {PROPERTY_TYPES.map((pt) => (
                  <button
                    key={pt}
                    onClick={() => {
                      setPropertyType(pt)
                      setStep(3)
                    }}
                    className="py-3 px-4 rounded-lg border border-[#3A6B4C]/15 bg-[#F5F0E1]/40 hover:border-[#3A6B4C]/40 hover:bg-[#F5F0E1] transition-colors text-sm font-medium text-left text-[#2B2B2B]"
                  >
                    {pt}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(1)}
                className="mt-4 text-[#2B2B2B]/40 hover:text-[#3A6B4C] text-sm transition-colors"
              >
                &larr; Back
              </button>
            </div>
          ) : step === 3 ? (
            /* ── Step 3: Timeline ── */
            <div>
              <h3 style={{ fontFamily: FONTS.display }} className="text-lg font-semibold mb-1 text-center text-[#2B2B2B]">
                When do you need this done?
              </h3>
              <p className="text-sm text-[#2B2B2B]/40 mb-5 text-center">
                No commitment — just helps us plan.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {TIMELINES.map((tl) => (
                  <button
                    key={tl}
                    onClick={() => {
                      setTimeline(tl)
                      setStep(4)
                    }}
                    className="py-3 px-4 rounded-lg border border-[#3A6B4C]/15 bg-[#F5F0E1]/40 hover:border-[#3A6B4C]/40 hover:bg-[#F5F0E1] transition-colors text-sm font-medium text-left text-[#2B2B2B]"
                  >
                    {tl}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                className="mt-4 text-[#2B2B2B]/40 hover:text-[#3A6B4C] text-sm transition-colors"
              >
                &larr; Back
              </button>
            </div>
          ) : (
            /* ── Step 4: Contact Info ── */
            <div>
              <h3 style={{ fontFamily: FONTS.display }} className="text-lg font-semibold mb-1 text-center text-[#2B2B2B]">
                Where should we send your quote?
              </h3>
              <p className="text-sm text-[#2B2B2B]/40 mb-5 text-center">
                We&apos;ll call you — no spam, ever.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-[#2B2B2B]">
                    Name <span className="text-[#B8453A]">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F5F0E1]/40 border border-[#3A6B4C]/15 rounded-lg focus:outline-none focus:border-[#3A6B4C] text-sm text-[#2B2B2B] placeholder:text-[#2B2B2B]/30"
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-[#2B2B2B]">
                    Phone <span className="text-[#B8453A]">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F5F0E1]/40 border border-[#3A6B4C]/15 rounded-lg focus:outline-none focus:border-[#3A6B4C] text-sm text-[#2B2B2B] placeholder:text-[#2B2B2B]/30"
                    placeholder="(704) 555-1234"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-[#2B2B2B]">
                    Email <span className="text-[#2B2B2B]/30">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F5F0E1]/40 border border-[#3A6B4C]/15 rounded-lg focus:outline-none focus:border-[#3A6B4C] text-sm text-[#2B2B2B] placeholder:text-[#2B2B2B]/30"
                    placeholder="john@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-[#2B2B2B]">
                    Address or Zip <span className="text-[#B8453A]">*</span>
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-4 py-3 bg-[#F5F0E1]/40 border border-[#3A6B4C]/15 rounded-lg focus:outline-none focus:border-[#3A6B4C] text-sm text-[#2B2B2B] placeholder:text-[#2B2B2B]/30"
                    placeholder="123 Main St, Charlotte NC or 28214"
                  />
                </div>
                {/* SMS Consent Checkbox — Required for A2P 10DLC compliance */}
                <div className="flex items-start gap-3 pt-1">
                  <input
                    type="checkbox"
                    id="sms-consent"
                    checked={smsConsent}
                    onChange={(e) => setSmsConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-[#3A6B4C]/30 text-[#3A6B4C] focus:ring-[#3A6B4C] accent-[#3A6B4C]"
                  />
                  <label htmlFor="sms-consent" className="text-xs text-[#2B2B2B]/60 leading-relaxed">
                    By checking this box, I agree to receive SMS text messages from Dr. Squeegee House Washing
                    at the phone number provided. Messages may include appointment reminders, quote follow-ups,
                    job status updates, and service communications. Message frequency varies. Msg &amp; data
                    rates may apply. Reply STOP to opt out. Reply HELP for help.
                    See our{" "}
                    <a href="/privacy" target="_blank" className="underline text-[#3A6B4C] hover:text-[#2F5A3F]">
                      Privacy Policy
                    </a>{" "}
                    and{" "}
                    <a href="/terms" target="_blank" className="underline text-[#3A6B4C] hover:text-[#2F5A3F]">
                      Terms of Service
                    </a>.
                  </label>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={
                    !name.trim() || !phone.trim() || !address.trim() || loading
                  }
                  className="w-full font-semibold py-3.5 rounded-lg transition-colors text-[#F5F0E1] bg-[#3A6B4C] hover:bg-[#2F5A3F] disabled:bg-[#2B2B2B]/20 disabled:text-[#2B2B2B]/40 disabled:cursor-not-allowed"
                >
                  {loading ? "Sending..." : "Get My Free Quote"}
                </button>
              </div>
              <button
                onClick={() => setStep(3)}
                className="mt-4 text-[#2B2B2B]/40 hover:text-[#3A6B4C] text-sm transition-colors"
              >
                &larr; Back
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#3A6B4C]/10 py-6 px-4 bg-[#F5F0E1]/30">
        <div className="max-w-4xl mx-auto text-center text-[#2B2B2B]/40 text-sm space-y-1">
          <img src="/images/squeegee/wordmark.png" alt="Dr. Squeegee" className="h-8 mx-auto mb-1" />
          <p>{BRAND.address}</p>
          <p>
            <a
              href={`tel:${BRAND.phoneTel}`}
              className="hover:text-[#3A6B4C] transition-colors"
            >
              {BRAND.phone}
            </a>
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <a href="/privacy" className="hover:text-[#3A6B4C] transition-colors underline">
              Privacy Policy
            </a>
            <span>&middot;</span>
            <a href="/terms" className="hover:text-[#3A6B4C] transition-colors underline">
              Terms of Service
            </a>
          </div>
          <p className="text-xs text-[#2B2B2B]/25 pt-1">
            &copy; {new Date().getFullYear()} Dr. Squeegee House Washing. All rights reserved.
          </p>
        </div>
      </footer>
      <FAQSchema />
    </>
  )
}
