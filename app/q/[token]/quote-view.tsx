"use client"

import { useState } from "react"
import type { SqueegeeQuote } from "./page"
import { FONTS } from "@/lib/squeegee/brand"

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  "House Washing":
    "Soft wash of all exterior siding, eaves, and trim to remove dirt, mildew, and algae.",
  "Window Cleaning":
    "Streak-free cleaning of interior and exterior windows, frames, and sills.",
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
  "Window Cleaning":
    "Please ensure windows are accessible and remove any window screens you'd like cleaned separately.",
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
        const json = (await res.json()) as { alreadyResponded?: boolean }
        if (json.alreadyResponded) {
          // Stale tab — the quote was already responded to elsewhere.
          // Reload so the page shows the real state instead of pretending
          // this tap went through.
          window.location.reload()
          return
        }
        setQuote((prev) => ({ ...prev, status: action }))
        setResponseMessage(RESPONSE_MESSAGES[action])
      }
    } catch {
      // silently fail
    } finally {
      setSubmitting(false)
    }
  }

  // accepted/declined are final; "help" keeps the quote open so the client
  // can still accept or decline after their question is answered.
  const locked = quote.status === "accepted" || quote.status === "declined"

  return (
    <div className="min-h-screen bg-[#FFFFFF] py-8 px-4" style={{ fontFamily: FONTS.body }}>
      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="text-center pb-2">
          <img src="/images/squeegee/logo-badge.png" alt="Dr. Squeegee" className="h-14 w-auto mx-auto mb-2" />
          <p className="text-sm text-[#2B2B2B]/50">House Calls for a Cleaner Home</p>
        </div>

        {/* Quote details — prescription pad style */}
        <div className="bg-[#FFFFFF] rounded-2xl shadow-sm border border-[#2D8C6F]/20 overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2D8C6F]/20 bg-[#2D8C6F]">
            <h1
              className="text-lg font-bold text-[#FFFFFF]"
              style={{ fontFamily: FONTS.display }}
            >
              Service Quote
            </h1>
            <p className="text-sm text-[#FFFFFF]/80 mt-0.5">{quote.client_name}</p>
            <p className="text-xs text-[#FFFFFF]/60 mt-0.5">{quote.address}</p>
          </div>
          <div className="px-5 py-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-[#2B2B2B]/40 border-b border-[#2D8C6F]/20">
                  <th className="text-left pb-2 font-medium">Service</th>
                  <th className="text-right pb-2 font-medium">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D8C6F]/10">
                {services.map((s, i) => (
                  <tr key={i}>
                    <td className="py-2.5">
                      <div className="text-[#2B2B2B] font-medium">{s.name}</div>
                      {s.detail && (
                        <div className="text-xs text-[#2D8C6F]/70 mt-0.5">{s.detail}</div>
                      )}
                      {!s.detail && (s.description || SERVICE_DESCRIPTIONS[s.name]) && (
                        <div className="text-xs text-[#2B2B2B]/50 mt-0.5">{s.description || SERVICE_DESCRIPTIONS[s.name]}</div>
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
                    <tr className="border-t-2 border-[#2D8C6F]/30">
                      <td className="pt-2 text-[#2B2B2B]/60 text-xs">Subtotal</td>
                      <td className="pt-2 text-right text-[#2B2B2B]/60 text-xs tabular-nums">
                        ${subtotal.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="pt-1 text-[#2D8C6F] text-xs font-medium">
                        Discount{quote.discount_type === "percent" ? ` (${discountVal}%)` : ""}
                      </td>
                      <td className="pt-1 text-right text-[#2D8C6F] text-xs tabular-nums font-medium">
                        −${discountAmount.toFixed(2)}
                      </td>
                    </tr>
                  </>
                )}
                <tr className={hasDiscount ? "" : "border-t-2 border-[#2D8C6F]/30"}>
                  <td className="pt-3 font-bold text-[#2B2B2B]">Total</td>
                  <td
                    className="pt-3 text-right font-black text-[#2D8C6F] text-base tabular-nums"
                    style={{ fontFamily: FONTS.display }}
                  >
                    ${Number(quote.total_price).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Prep Instructions */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#2D8C6F]/10 overflow-hidden">
          <div className="px-5 py-3 border-b border-[#2D8C6F]/10">
            <h2 className="text-sm font-bold text-[#2B2B2B]">Service Prep Instructions</h2>
          </div>
          <div className="px-5 py-4 space-y-2">
            {prepInstructions.map((instruction, i) => (
              <div key={i} className="flex gap-2.5 text-sm text-[#2B2B2B]/80">
                <span className="text-[#2D8C6F] mt-0.5 shrink-0">&#8226;</span>
                <span>{instruction}</span>
              </div>
            ))}
            <div className="flex gap-2.5 text-sm text-[#2B2B2B]/80">
              <span className="text-[#2D8C6F] mt-0.5 shrink-0">&#8226;</span>
              <span>
                Our team will treat your property with care. If you have any concerns, let us
                know before we begin.
              </span>
            </div>
          </div>
        </div>

        {/* Service Agreement */}
        <div className="bg-[#2D8C6F]/10 rounded-2xl border border-[#2D8C6F]/20 px-5 py-4">
          <h2 className="text-xs font-bold text-[#2D8C6F] uppercase tracking-wide mb-2">
            Service Agreement
          </h2>
          <p className="text-xs text-[#2B2B2B]/60 leading-relaxed">
            By accepting this quote, you agree that Dr. Squeegee is not liable for: pre-existing
            damage, items left in the service area, or damage resulting from conditions beyond
            our control (deteriorated surfaces, improper installation, etc.). Service is
            weather-dependent and may be rescheduled.
          </p>
        </div>

        {/* Response message (help keeps the buttons below it) */}
        {responseMessage && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#2D8C6F]/10 px-5 py-6 text-center">
            {quote.status === "accepted" && (
              <div className="w-12 h-12 bg-[#2D8C6F]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-[#2D8C6F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            {quote.status === "help" && (
              <p className="text-xs text-[#2B2B2B]/50 mt-2">
                Got your answer? You can still accept or decline below.
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        {!locked && (
          <div className="space-y-3">
            <button
              onClick={() => handleAction("accepted")}
              disabled={submitting}
              className="w-full h-14 rounded-xl bg-[#2D8C6F] hover:bg-[#1F6B54] active:bg-[#175C47] text-[#FFFFFF] font-bold text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Accept Quote
            </button>
            <button
              onClick={() => handleAction("help")}
              disabled={submitting}
              className="w-full h-14 rounded-xl bg-white hover:bg-[#FFFFFF]/50 active:bg-[#FFFFFF] text-[#2B2B2B] font-semibold text-base border border-[#2D8C6F]/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              I Have Questions
            </button>
            <button
              onClick={() => handleAction("declined")}
              disabled={submitting}
              className="w-full h-14 rounded-xl bg-white hover:bg-[#B8453A]/5 active:bg-[#B8453A]/10 text-[#B8453A] font-semibold text-base border border-[#B8453A]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Decline
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-[#2B2B2B]/30 pb-4" style={{ fontFamily: FONTS.display }}>
          Dr. Squeegee &middot; House Calls for a Cleaner Home
        </p>
      </div>
    </div>
  )
}
