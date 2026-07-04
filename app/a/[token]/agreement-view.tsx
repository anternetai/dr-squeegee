"use client"

import { useEffect, useRef, useState } from "react"
import { BRAND, FONTS } from "@/lib/squeegee/brand"
import {
  formatMoney,
  totalVisits,
  RESCHEDULE_MIN_NOTICE_HOURS,
  RESCHEDULE_WINDOW_DAYS,
  type SqueegeePlan,
} from "@/lib/squeegee/plans"

interface Props {
  plan: SqueegeePlan
}

export function AgreementView({ plan }: Props) {
  const [signed, setSigned] = useState(Boolean(plan.signed_at))
  const [portalToken, setPortalToken] = useState<string | null>(
    plan.signed_at ? plan.portal_token : null
  )
  const [mode, setMode] = useState<"draw" | "type">("draw")
  const [typedSignature, setTypedSignature] = useState("")
  const [fullName, setFullName] = useState(plan.client_name)
  const [agreed, setAgreed] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)

  const services = Array.isArray(plan.services) ? plan.services : []
  const visits = totalVisits(services)
  const savings = plan.annual_value - plan.total_price
  const isPif = plan.billing === "paid_in_full"

  // ---- signature canvas ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || signed) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#0A0A0A"
  }, [signed, mode])

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    const ctx = e.currentTarget.getContext("2d")
    if (!ctx) return
    const { x, y } = pointerPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const ctx = e.currentTarget.getContext("2d")
    if (!ctx) return
    const { x, y } = pointerPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasDrawn(true)
  }

  function handlePointerUp() {
    drawingRef.current = false
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  const canSign =
    agreed &&
    fullName.trim().length > 1 &&
    (mode === "draw" ? hasDrawn : typedSignature.trim().length > 1)

  async function handleSign() {
    if (!canSign || submitting) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const signature_data =
        mode === "draw"
          ? canvasRef.current?.toDataURL("image/png") ?? ""
          : typedSignature.trim()

      const res = await fetch(`/api/plans/${plan.token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signed_name: fullName.trim(),
          signature_type: mode === "draw" ? "drawn" : "typed",
          signature_data,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || "Something went wrong. Please try again.")
        return
      }
      setPortalToken(json.portal_token)
      setSigned(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch {
      setErrorMsg("Network error — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] py-8 px-4" style={{ fontFamily: FONTS.body }}>
      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="text-center pb-1">
          <img
            src="/images/squeegee/logo-badge.png"
            alt="Dr. Squeegee"
            className="h-16 w-auto mx-auto mb-3"
          />
          <h1
            className="text-2xl font-bold text-white tracking-wide"
            style={{ fontFamily: FONTS.display }}
          >
            {plan.plan_name}
          </h1>
          <p className="text-sm text-white/50 mt-1">{BRAND.tagline}</p>
        </div>

        {signed && (
          <div className="bg-[#2D8C6F] rounded-2xl px-5 py-6 text-center">
            <div className="w-12 h-12 bg-white/15 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-bold text-lg" style={{ fontFamily: FONTS.display }}>
              You&apos;re all set, {(plan.signed_name ?? fullName).split(" ")[0]}!
            </p>
            <p className="text-white/80 text-sm mt-1">
              {plan.signed_at
                ? "Your Annual Exterior Care Plan is signed. Your member portal has your full visit schedule — bookmark it!"
                : "Your plan is signed. One more fun step: pick the months for your visits — takes about a minute."}
            </p>
            {portalToken && (
              <a
                href={`/portal/${portalToken}`}
                className="mt-4 inline-flex items-center justify-center h-12 px-6 rounded-xl bg-white text-[#0A0A0A] font-bold text-sm hover:bg-white/90 transition-colors"
                style={{ fontFamily: FONTS.display }}
              >
                {plan.signed_at ? "OPEN MY MEMBER PORTAL →" : "SET UP MY SCHEDULE →"}
              </a>
            )}
          </div>
        )}

        {/* The agreement document */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-xl">
          {/* Client block */}
          <div className="px-5 py-4 bg-[#2D8C6F]">
            <p className="text-xs uppercase tracking-widest text-white/60 font-medium">
              Prepared for
            </p>
            <p className="text-lg font-bold text-white mt-0.5" style={{ fontFamily: FONTS.display }}>
              {plan.client_name}
            </p>
            <p className="text-xs text-white/70 mt-0.5">{plan.address}</p>
          </div>

          {/* Services */}
          <div className="px-5 py-4">
            <p className="text-xs uppercase tracking-widest text-[#2B2B2B]/40 font-semibold mb-3">
              Your year of service &middot; {visits} visits
            </p>
            <div className="divide-y divide-[#2D8C6F]/10">
              {services.map((s, i) => (
                <div key={i} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#2B2B2B]">
                      {s.name}
                      <span className="ml-2 inline-block text-[11px] font-bold text-[#2D8C6F] bg-[#E6F5F0] rounded-full px-2 py-0.5 align-middle">
                        {s.visits_per_year}&times;/year
                      </span>
                    </p>
                    {s.description && (
                      <p className="text-xs text-[#2B2B2B]/50 mt-0.5 leading-relaxed">{s.description}</p>
                    )}
                  </div>
                  <p className="text-sm text-[#2B2B2B]/70 tabular-nums shrink-0 pt-0.5">
                    {formatMoney(Number(s.price_per_visit) * Number(s.visits_per_year))}
                  </p>
                </div>
              ))}
            </div>

            {/* Pricing */}
            <div className="mt-4 rounded-xl bg-[#0A0A0A] px-4 py-4">
              <div className="flex items-baseline justify-between">
                <p className="text-xs text-white/50">Total annual value</p>
                <p className="text-sm text-white/50 line-through tabular-nums">
                  {formatMoney(plan.annual_value)}
                </p>
              </div>
              {isPif ? (
                <>
                  <div className="flex items-baseline justify-between mt-2">
                    <p className="text-sm text-white font-semibold">
                      Paid in full &middot; {Number(plan.discount_percent)}% off
                    </p>
                    <p
                      className="text-3xl font-black text-[#2D8C6F] tabular-nums"
                      style={{ fontFamily: FONTS.display }}
                    >
                      {formatMoney(plan.total_price)}
                    </p>
                  </div>
                  <p className="text-right text-xs text-[#2D8C6F] font-medium mt-1">
                    You save {formatMoney(savings)}
                  </p>
                </>
              ) : (
                <div className="flex items-baseline justify-between mt-2">
                  <p className="text-sm text-white font-semibold">Monthly plan</p>
                  <p
                    className="text-3xl font-black text-[#2D8C6F] tabular-nums"
                    style={{ fontFamily: FONTS.display }}
                  >
                    {formatMoney(plan.monthly_price ?? plan.annual_value / 12)}
                    <span className="text-base font-bold text-white/60">/mo</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Terms */}
          <div className="px-5 pb-5">
            <div className="rounded-xl bg-[#2D8C6F]/5 border border-[#2D8C6F]/15 px-4 py-3.5">
              <p className="text-[11px] font-bold text-[#2D8C6F] uppercase tracking-widest mb-2">
                Agreement Terms
              </p>
              <ul className="space-y-1.5 text-xs text-[#2B2B2B]/70 leading-relaxed list-disc pl-4">
                <li>Your 12-month term begins the day you sign. All listed visits are included.</li>
                <li>
                  We schedule visits across the year and confirm each one with you ahead of time.
                  You can reschedule any visit in your member portal up to{" "}
                  {RESCHEDULE_MIN_NOTICE_HOURS} hours before, within {RESCHEDULE_WINDOW_DAYS} days
                  of the original date.
                </li>
                <li>Services are weather-dependent and may be rescheduled — we&apos;ll always keep you posted.</li>
                <li>
                  Dr. Squeegee is not liable for pre-existing damage, items left in the service
                  area, or damage from conditions beyond our control (deteriorated surfaces,
                  improper installation, etc.).
                </li>
                <li>
                  {isPif
                    ? "Paid-in-full pricing covers every listed visit for the term. If you cancel early, completed visits are charged at standard per-visit rates and the remainder is refunded."
                    : "Monthly plans are billed each month for the 12-month term."}
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Signature */}
        {!signed && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-3.5 border-b border-[#2D8C6F]/15">
              <h2 className="text-sm font-bold text-[#2B2B2B]" style={{ fontFamily: FONTS.display }}>
                SIGN TO START YOUR PLAN
              </h2>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Mode toggle */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#2B2B2B]/5">
                <button
                  onClick={() => {
                    setMode("draw")
                    setHasDrawn(false)
                  }}
                  className={`h-9 rounded-lg text-sm font-semibold transition-colors ${
                    mode === "draw" ? "bg-white shadow text-[#2B2B2B]" : "text-[#2B2B2B]/50"
                  }`}
                >
                  Draw
                </button>
                <button
                  onClick={() => setMode("type")}
                  className={`h-9 rounded-lg text-sm font-semibold transition-colors ${
                    mode === "type" ? "bg-white shadow text-[#2B2B2B]" : "text-[#2B2B2B]/50"
                  }`}
                >
                  Type
                </button>
              </div>

              {mode === "draw" ? (
                <div>
                  <div className="relative rounded-xl border-2 border-dashed border-[#2D8C6F]/30 bg-[#FEFCF7]">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-40 rounded-xl"
                      style={{ touchAction: "none" }}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerLeave={handlePointerUp}
                    />
                    {!hasDrawn && (
                      <p className="absolute inset-0 flex items-center justify-center text-sm text-[#2B2B2B]/30 pointer-events-none">
                        Sign here with your finger
                      </p>
                    )}
                  </div>
                  <button
                    onClick={clearCanvas}
                    className="mt-2 text-xs text-[#2B2B2B]/50 underline underline-offset-2"
                  >
                    Clear signature
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    placeholder="Type your name"
                    className="w-full h-12 px-4 rounded-xl border border-[#2B2B2B]/15 text-[#2B2B2B] text-sm focus:outline-none focus:border-[#2D8C6F]"
                  />
                  <div className="mt-2 h-24 rounded-xl border-2 border-dashed border-[#2D8C6F]/30 bg-[#FEFCF7] flex items-center justify-center overflow-hidden">
                    {typedSignature.trim() ? (
                      <p
                        className="text-4xl text-[#0A0A0A] px-4 truncate"
                        style={{ fontFamily: "var(--font-signature), cursive" }}
                      >
                        {typedSignature}
                      </p>
                    ) : (
                      <p className="text-sm text-[#2B2B2B]/30">Your signature preview</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-[#2B2B2B]/60">Full legal name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full h-12 px-4 rounded-xl border border-[#2B2B2B]/15 text-[#2B2B2B] text-sm focus:outline-none focus:border-[#2D8C6F]"
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#2D8C6F]"
                />
                <span className="text-xs text-[#2B2B2B]/60 leading-relaxed">
                  I agree to the terms above and authorize {BRAND.name} to perform the listed
                  services. I agree my electronic signature is the legal equivalent of my
                  handwritten signature.
                </span>
              </label>

              {errorMsg && (
                <p className="text-sm text-[#B8453A] font-medium">{errorMsg}</p>
              )}

              <button
                onClick={handleSign}
                disabled={!canSign || submitting}
                className="w-full h-14 rounded-xl bg-[#2D8C6F] hover:bg-[#1F6B54] active:bg-[#175C47] text-white font-bold text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ fontFamily: FONTS.display }}
              >
                {submitting
                  ? "Signing..."
                  : isPif
                    ? `SIGN & LOCK IN ${formatMoney(plan.total_price)}`
                    : "SIGN AGREEMENT"}
              </button>
            </div>
          </div>
        )}

        {/* Signed signature display */}
        {signed && plan.signed_at && (
          <div className="bg-white rounded-2xl px-5 py-4 shadow-xl">
            <p className="text-[11px] font-bold text-[#2D8C6F] uppercase tracking-widest mb-2">
              Signed
            </p>
            {plan.signature_type === "drawn" && plan.signature_data ? (
              <img src={plan.signature_data} alt="Signature" className="h-20 w-auto" />
            ) : (
              <p
                className="text-4xl text-[#0A0A0A]"
                style={{ fontFamily: "var(--font-signature), cursive" }}
              >
                {plan.signature_data || plan.signed_name}
              </p>
            )}
            <p className="text-xs text-[#2B2B2B]/50 mt-2">
              {plan.signed_name} &middot;{" "}
              {new Date(plan.signed_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pb-4">
          <p className="text-xs text-white/30" style={{ fontFamily: FONTS.display }}>
            {BRAND.name} &middot; {BRAND.tagline}
          </p>
          <a href={`tel:${BRAND.phoneTel}`} className="text-xs text-[#2D8C6F] mt-1 inline-block">
            Questions? Call or text {BRAND.phone}
          </a>
        </div>
      </div>
    </div>
  )
}
