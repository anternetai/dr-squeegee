"use client"

import { useState } from "react"
import type { SqueegeeQuote } from "./page"

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  "House Washing":
    "Soft wash of all exterior siding, eaves, and trim to remove dirt, mildew, and algae.",
  "Surface Cleaning":
    "High-pressure cleaning of concrete, brick, or stone walkways and patios.",
  Driveway:
    "Full driveway pressure wash to remove oil stains, tire marks, and buildup.",
  "Pool Deck":
    "Pressure wash and surface treatment of pool deck to restore a clean, slip-safe finish.",
  Pavers:
    "Pressure wash of paver surfaces with joint sand preservation and weed removal.",
}

const PREP_INSTRUCTIONS: Record<string, string> = {
  "House Washing":
    "Please close all windows and doors before we arrive. Remove any fragile items or outdoor décor from the area.",
  "Surface Cleaning":
    "Please clear the driveway/surface of vehicles and any items you'd like to protect.",
  Driveway:
    "Please clear the driveway/surface of vehicles and any items you'd like to protect.",
  "Pool Deck":
    "Please remove pool furniture and any items from the deck area.",
  Pavers:
    "Please clear the paver area of furniture and decorative items.",
}

const RESPONSE_MESSAGES: Record<string, string> = {
  accepted:
    "Quote accepted! Anthony from Dr. Squeegee will reach out shortly to confirm your appointment.",
  declined: "Got it! We'll remove you from our list.",
  help: "Got it! Anthony will reach out shortly.",
}

interface Props {
  quote: SqueegeeQuote
}

export function QuoteView({ quote: initialQuote }: Props) {
  const [quote, setQuote] = useState(initialQuote)
  const [submitting, setSubmitting] = useState(false)
  const [responseMessage, setResponseMessage] = useState<string | null>(
    initialQuote.status !== "pending" ? RESPONSE_MESSAGES[initialQuote.status] ?? null : null
  )

  const services = Array.isArray(quote.services) ? quote.services : []
  const hasDiscount = quote.discount_type && (quote.discount_value ?? 0) > 0
  const discountVal = Number(quote.discount_value) || 0
  const subtotal = quote.subtotal ?? services.reduce((sum, s) => sum + Number(s.price), 0)
  const discountAmount = quote.discount_type === "percent"
    ? Math.round(subtotal * (discountVal / 100) * 100) / 100
    : discountVal

  // Unique prep instructions for selected services
  const prepInstructions = Array.from(
    new Set(services.map((s) => PREP_INSTRUCTIONS[s.name]).filter(Boolean))
  )

  async function handleAction(action: "accepted" | "declined" | "help") {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/squeegee/quotes/${quote.token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })

      if (res.ok) {
        setQuote((prev) => ({ ...prev, status: action }))
        setResponseMessage(RESPONSE_MESSAGES[action])
      }
    } catch {
      // silently fail
    } finally {
      setSubmitting(false)
    }
  }

  const alreadyResponded = quote.status !== "pending"

  return (
    <div className="min-h-screen bg-[#FEFCF7] py-8 px-4" style={{ fontFamily: "var(--font-brand-body), sans-serif" }}>
      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="text-center pb-2">
          <div className="inline-flex items-center gap-2 mb-1">
            <span
              className="text-2xl font-black text-[#3A6B4C] tracking-tight"
              style={{ fontFamily: "var(--font-brand-display), serif" }}
            >
              Dr. Squeegee
            </span>
          </div>
          <p className="text-sm text-[#2B2B2B]/50">House Calls for a Cleaner Home</p>
        </div>

        {/* Quote details — prescription pad style */}
        <div className="bg-[#F5F0E1] rounded-2xl shadow-sm border border-[#C8973E]/20 overflow-hidden">
          <div className="px-5 py-4 border-b border-[#C8973E]/20 bg-[#3A6B4C]">
            <h1
              className="text-lg font-bold text-[#F5F0E1]"
              style={{ fontFamily: "var(--font-brand-display), serif" }}
            >
              Service Quote
            </h1>
            <p className="text-sm text-[#F5F0E1]/80 mt-0.5">{quote.client_name}</p>
            <p className="text-xs text-[#F5F0E1]/60 mt-0.5">{quote.address}</p>
          </div>
          <div className="px-5 py-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-[#2B2B2B]/40 border-b border-[#C8973E]/20">
                  <th className="text-left pb-2 font-medium">Service</th>
                  <th className="text-right pb-2 font-medium">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#C8973E]/10">
                {services.map((s, i) => (
                  <tr key={i}>
                    <td className="py-2.5">
                      <div className="text-[#2B2B2B] font-medium">{s.name}</div>
                      {SERVICE_DESCRIPTIONS[s.name] && (
                        <div className="text-xs text-[#2B2B2B]/50 mt-0.5">{SERVICE_DESCRIPTIONS[s.name]}</div>
                      )}
                    </td>
                    <td className="py-2.5 text-right text-[#2B2B2B] tabular-nums align-top">
                      ${Number(s.price).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {hasDiscount && (
                  <>
                    <tr className="border-t-2 border-[#C8973E]/30">
                      <td className="pt-2 text-[#2B2B2B]/60 text-xs">Subtotal</td>
                      <td className="pt-2 text-right text-[#2B2B2B]/60 text-xs tabular-nums">
                        ${subtotal.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="pt-1 text-[#3A6B4C] text-xs font-medium">
                        Discount{quote.discount_type === "percent" ? ` (${discountVal}%)` : ""}
                      </td>
                      <td className="pt-1 text-right text-[#3A6B4C] text-xs tabular-nums font-medium">
                        −${discountAmount.toFixed(2)}
                      </td>
                    </tr>
                  </>
                )}
                <tr className={hasDiscount ? "" : "border-t-2 border-[#C8973E]/30"}>
                  <td className="pt-3 font-bold text-[#2B2B2B]">Total</td>
                  <td
                    className="pt-3 text-right font-black text-[#3A6B4C] text-base tabular-nums"
                    style={{ fontFamily: "var(--font-brand-display), serif" }}
                  >
                    ${Number(quote.total_price).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Prep Instructions */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#3A6B4C]/10 overflow-hidden">
          <div className="px-5 py-3 border-b border-[#3A6B4C]/10">
            <h2 className="text-sm font-bold text-[#2B2B2B]">Service Prep Instructions</h2>
          </div>
          <div className="px-5 py-4 space-y-2">
            {prepInstructions.map((instruction, i) => (
              <div key={i} className="flex gap-2.5 text-sm text-[#2B2B2B]/80">
                <span className="text-[#3A6B4C] mt-0.5 shrink-0">&#8226;</span>
                <span>{instruction}</span>
              </div>
            ))}
            <div className="flex gap-2.5 text-sm text-[#2B2B2B]/80">
              <span className="text-[#3A6B4C] mt-0.5 shrink-0">&#8226;</span>
              <span>
                Our team will treat your property with care. If you have any concerns, let us
                know before we begin.
              </span>
            </div>
          </div>
        </div>

        {/* Service Agreement */}
        <div className="bg-[#C8973E]/10 rounded-2xl border border-[#C8973E]/20 px-5 py-4">
          <h2 className="text-xs font-bold text-[#C8973E] uppercase tracking-wide mb-2">
            Service Agreement
          </h2>
          <p className="text-xs text-[#2B2B2B]/60 leading-relaxed">
            By accepting this quote, you agree that Dr. Squeegee is not liable for: pre-existing
            damage, items left in the service area, or damage resulting from conditions beyond
            our control (deteriorated surfaces, improper installation, etc.). Service is
            weather-dependent and may be rescheduled.
          </p>
        </div>

        {/* Action buttons or response */}
        {responseMessage ? (
          <div className="bg-white rounded-2xl shadow-sm border border-[#3A6B4C]/10 px-5 py-6 text-center">
            {quote.status === "accepted" && (
              <div className="w-12 h-12 bg-[#3A6B4C]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-[#3A6B4C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {quote.status === "declined" && (
              <p className="text-4xl mb-3">&#128075;</p>
            )}
            {quote.status === "help" && (
              <p className="text-4xl mb-3">&#128172;</p>
            )}
            <p className="text-[#2B2B2B] font-medium text-base">{responseMessage}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => handleAction("accepted")}
              disabled={submitting || alreadyResponded}
              className="w-full h-14 rounded-xl bg-[#3A6B4C] hover:bg-[#2F5A3F] active:bg-[#264733] text-[#F5F0E1] font-bold text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Accept Quote
            </button>
            <button
              onClick={() => handleAction("help")}
              disabled={submitting || alreadyResponded}
              className="w-full h-14 rounded-xl bg-white hover:bg-[#F5F0E1]/50 active:bg-[#F5F0E1] text-[#2B2B2B] font-semibold text-base border border-[#3A6B4C]/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              I Have Questions
            </button>
            <button
              onClick={() => handleAction("declined")}
              disabled={submitting || alreadyResponded}
              className="w-full h-14 rounded-xl bg-white hover:bg-[#B8453A]/5 active:bg-[#B8453A]/10 text-[#B8453A] font-semibold text-base border border-[#B8453A]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Decline
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-[#2B2B2B]/30 pb-4" style={{ fontFamily: "var(--font-brand-display), serif" }}>
          Dr. Squeegee &middot; House Calls for a Cleaner Home
        </p>
      </div>
    </div>
  )
}
