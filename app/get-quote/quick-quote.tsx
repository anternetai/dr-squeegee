"use client"

import { useState, useRef, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle, ChevronRight, Home, Building2, Loader2 } from "lucide-react"
import { FONTS } from "@/lib/squeegee/brand"
import { track } from "@vercel/analytics"

/* ──────────────────────────────────────────────────────────
   High-converting top-of-page quick quote.
   Easy taps first (property → service → frequency) then contact.
   Address uses free Photon autocomplete (no API key). To upgrade to
   Google Places (New): enable it in Cloud Console + billing, then
   swap fetchAddressSuggestions() to the Places endpoint.
   ────────────────────────────────────────────────────────── */

const PROPERTY = [
  { value: "House", label: "My Home", icon: Home },
  { value: "Business", label: "My Business", icon: Building2 },
]

const SERVICES = ["Window Cleaning", "House Washing", "Driveway / Concrete", "Solar Panel Cleaning", "Gutter Cleaning", "Multiple Services"]

const FREQUENCY = ["One-Time", "Monthly", "Quarterly", "Just Exploring"]

function AddressAutocomplete({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  className: string
}) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  function fetchAddressSuggestions(q: string) {
    if (q.trim().length < 3) {
      setSuggestions([])
      return
    }
    setLoading(true)
    // Server proxy: Google Places (New) when key is set, else free Photon.
    fetch(`/api/squeegee/address-suggest?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d: { suggestions?: string[] }) => {
        setSuggestions(d.suggestions ?? [])
        setOpen(true)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  function handleChange(v: string) {
    onChange(v)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => fetchAddressSuggestions(v), 250)
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length && setOpen(true)}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[#9CA3AF]/50" />}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full rounded-lg border border-[#242424] bg-[#1A1A1A] shadow-2xl overflow-hidden">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => {
                  onChange(s)
                  setOpen(false)
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-[#1A1A1A] transition-colors"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function QuickQuote({ id }: { id?: string }) {
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const [propertyType, setPropertyType] = useState("")
  const [service, setService] = useState("")
  const [frequency, setFrequency] = useState("")
  const [first, setFirst] = useState("")
  const [last, setLast] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [email, setEmail] = useState("")
  const [smsConsent, setSmsConsent] = useState(false)

  const totalSteps = 4
  const progress = (((submitted ? totalSteps : step - 1)) / (totalSteps - 1)) * 100

  async function handleSubmit() {
    if (!first.trim() || !last.trim() || !phone.trim()) return
    setLoading(true)
    try {
      await fetch("/api/squeegee/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${first.trim()} ${last.trim()}`,
          phone: phone.trim(),
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          services: [service],
          property_type: propertyType,
          timeline: frequency,
          sms_consent: smsConsent,
          sms_consent_timestamp: smsConsent ? new Date().toISOString() : undefined,
          utm_source: searchParams.get("utm_source") ?? undefined,
          utm_medium: searchParams.get("utm_medium") ?? undefined,
          utm_campaign: searchParams.get("utm_campaign") ?? undefined,
        }),
      })
      setSubmitted(true)
      track("quote_submitted", { service, property_type: propertyType, frequency })
    } catch (err) {
      console.error("Submit error:", err)
    } finally {
      setLoading(false)
    }
  }

  const pickBtn =
    "py-3.5 px-4 rounded-lg border border-[#242424] bg-[#1A1A1A] hover:border-[#2D8C6F] hover:bg-[#1A1A1A] transition-colors text-sm font-medium text-left text-white"
  const inputCls =
    "w-full px-4 py-3 bg-[#1A1A1A] border border-[#242424] rounded-lg focus:outline-none focus:border-[#2D8C6F] text-sm text-white placeholder:text-[#9CA3AF]/40"

  return (
    <div id={id} className="bg-[#111111]/95 backdrop-blur border border-[#242424] rounded-2xl p-6 md:p-7 shadow-2xl shadow-black/40 w-full">
      {!submitted && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontFamily: FONTS.display }} className="text-base font-bold text-white">Get your free quote</span>
            <span className="text-xs text-[#9CA3AF]/60">Step {step} of {totalSteps}</span>
          </div>
          <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300 bg-[#2D8C6F]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {submitted ? (
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-[#2D8C6F]/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-[#2D8C6F]" />
          </div>
          <h3 style={{ fontFamily: FONTS.display }} className="text-xl font-bold mb-2 text-white">You&apos;re all set!</h3>
          <p className="text-[#9CA3AF]">We&apos;ll text or call you within 2 hours with your quote.</p>
        </div>
      ) : step === 1 ? (
        <div>
          <h3 style={{ fontFamily: FONTS.display }} className="text-lg font-bold mb-1 text-white">Who&apos;s it for?</h3>
          <p className="text-sm text-[#9CA3AF]/60 mb-4">Tap one to start.</p>
          <div className="grid grid-cols-2 gap-3">
            {PROPERTY.map((p) => {
              const Icon = p.icon
              return (
                <button
                  key={p.value}
                  onClick={() => { setPropertyType(p.value); setStep(2) }}
                  className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl border border-[#242424] bg-[#1A1A1A] hover:border-[#2D8C6F] hover:bg-[#1A1A1A] transition-colors text-white"
                >
                  <Icon className="h-7 w-7 text-[#2D8C6F]" />
                  <span className="font-semibold text-sm">{p.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : step === 2 ? (
        <div>
          <h3 style={{ fontFamily: FONTS.display }} className="text-lg font-bold mb-1 text-white">What can we clean?</h3>
          <p className="text-sm text-[#9CA3AF]/60 mb-4">Pick the main one.</p>
          <div className="grid grid-cols-1 gap-2.5">
            {SERVICES.map((s) => (
              <button key={s} onClick={() => { setService(s); setStep(3) }} className={pickBtn}>{s}</button>
            ))}
          </div>
          <button onClick={() => setStep(1)} className="mt-4 text-[#9CA3AF]/50 hover:text-[#2D8C6F] text-sm transition-colors">&larr; Back</button>
        </div>
      ) : step === 3 ? (
        <div>
          <h3 style={{ fontFamily: FONTS.display }} className="text-lg font-bold mb-1 text-white">How often?</h3>
          <p className="text-sm text-[#9CA3AF]/60 mb-4">Recurring saves you the most — but no commitment.</p>
          <div className="grid grid-cols-2 gap-3">
            {FREQUENCY.map((f) => (
              <button key={f} onClick={() => { setFrequency(f); setStep(4) }} className={pickBtn}>{f}</button>
            ))}
          </div>
          <button onClick={() => setStep(2)} className="mt-4 text-[#9CA3AF]/50 hover:text-[#2D8C6F] text-sm transition-colors">&larr; Back</button>
        </div>
      ) : (
        <div>
          <h3 style={{ fontFamily: FONTS.display }} className="text-lg font-bold mb-1 text-white">Almost done — where do we send it?</h3>
          <p className="text-sm text-[#9CA3AF]/60 mb-4">We&apos;ll text your quote. No spam, ever.</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={first} onChange={(e) => setFirst(e.target.value)} className={inputCls} placeholder="First name" />
              <input type="text" value={last} onChange={(e) => setLast(e.target.value)} className={inputCls} placeholder="Last name" />
            </div>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="Phone number" />
            <AddressAutocomplete value={address} onChange={setAddress} placeholder="Property address" className={inputCls} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="Email (optional)" />
            <div className="flex items-start gap-3 pt-1">
              <input type="checkbox" id={`sms-${id ?? "q"}`} checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded border-[#242424] text-[#2D8C6F] focus:ring-[#2D8C6F] accent-[#2D8C6F]" />
              <label htmlFor={`sms-${id ?? "q"}`} className="text-[11px] text-[#9CA3AF]/60 leading-relaxed">
                I agree to receive SMS text messages from Dr. Squeegee at the number provided (quote follow-ups,
                reminders, service updates). Msg frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out.
                See our{" "}
                <a href="/privacy" target="_blank" className="underline text-[#2D8C6F] hover:text-[#4AA88C]">Privacy Policy</a>{" "}&amp;{" "}
                <a href="/terms" target="_blank" className="underline text-[#2D8C6F] hover:text-[#4AA88C]">Terms</a>.
              </label>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!first.trim() || !last.trim() || !phone.trim() || loading}
              className="w-full font-semibold py-3.5 rounded-lg transition-colors text-white bg-[#2D8C6F] hover:bg-[#1F6B54] disabled:bg-[#242424] disabled:text-[#9CA3AF]/40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? "Sending..." : "Get My Free Quote"}
              {!loading && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
          <button onClick={() => setStep(3)} className="mt-4 text-[#9CA3AF]/50 hover:text-[#2D8C6F] text-sm transition-colors">&larr; Back</button>
        </div>
      )}
    </div>
  )
}
