"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import type { SqueegeeQuote, QuoteInvoice } from "./page"
import { FONTS } from "@/lib/squeegee/brand"
import { QuotePayCard } from "@/components/squeegee/quote-pay-card"

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

interface Props {
  quote: SqueegeeQuote
  invoice: QuoteInvoice | null
}

export function QuoteView({ quote: initialQuote, invoice: initialInvoice }: Props) {
  const [quote, setQuote] = useState(initialQuote)
  const [invoice, setInvoice] = useState<QuoteInvoice | null>(initialInvoice)
  const [submitting, setSubmitting] = useState(false)
  const [paid, setPaid] = useState(initialInvoice?.status === "paid")

  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const services = Array.isArray(quote.services) ? quote.services : []
  const hasDiscount = quote.discount_type && (quote.discount_value ?? 0) > 0
  const discountVal = Number(quote.discount_value) || 0
  const subtotal = quote.subtotal ?? services.reduce((sum, s) => sum + Number(s.price), 0)
  const discountAmount = quote.discount_type === "percent"
    ? Math.round(subtotal * (discountVal / 100) * 100) / 100
    : discountVal

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
        const json = (await res.json()) as {
          alreadyResponded?: boolean
          invoice?: { id: string; invoice_number: string; amount: number } | null
        }
        if (json.alreadyResponded) {
          window.location.reload()
          return
        }
        setQuote((prev) => ({ ...prev, status: action }))
        // Surface the pay card immediately on accept — no refetch.
        if (action === "accepted" && json.invoice) {
          setInvoice({
            id: json.invoice.id,
            invoice_number: json.invoice.invoice_number,
            amount: json.invoice.amount,
            tip_amount: 0,
            status: "sent",
          })
        }
      }
    } catch {
      // silently fail
    } finally {
      setSubmitting(false)
    }
  }

  // pending/help → still choosing. accepted/declined are terminal for the buttons.
  const showActionButtons = quote.status === "pending" || quote.status === "help"
  const showPayCard = quote.status === "accepted" && invoice != null && !paid
  const showReceipt = paid && invoice != null
  const tipPaid = Number(invoice?.tip_amount) || 0

  return (
    <div className="min-h-screen bg-background py-8 px-4" style={{ fontFamily: FONTS.body }}>
      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="relative text-center pb-2">
          {mounted && (
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              className="absolute right-0 top-0 h-9 w-9 rounded-lg border border-[#2D8C6F]/20 text-foreground/70 hover:text-foreground hover:border-[#2D8C6F]/40 flex items-center justify-center transition-colors"
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          )}
          <img src="/images/squeegee/logo-badge.png" alt="Dr. Squeegee" className="h-28 w-auto mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">House Calls for a Cleaner Home</p>
        </div>

        {/* Quote details — prescription pad style */}
        <div className="bg-card rounded-2xl shadow-sm border border-[#2D8C6F]/20 overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2D8C6F]/20 bg-[#2D8C6F]">
            <h1 className="text-lg font-bold text-white" style={{ fontFamily: FONTS.display }}>
              Service Quote
            </h1>
            <p className="text-sm text-white/80 mt-0.5">{quote.client_name}</p>
            <p className="text-xs text-white/60 mt-0.5">{quote.address}</p>
          </div>
          <div className="px-5 py-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted-foreground border-b border-[#2D8C6F]/20">
                  <th className="text-left pb-2 font-medium">Service</th>
                  <th className="text-right pb-2 font-medium">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D8C6F]/10">
                {services.map((s, i) => (
                  <tr key={i}>
                    <td className="py-2.5">
                      <div className="text-foreground font-medium">{s.name}</div>
                      {s.detail && (
                        <div className="text-xs text-[#2D8C6F]/80 mt-0.5">{s.detail}</div>
                      )}
                      {!s.detail && (s.description || SERVICE_DESCRIPTIONS[s.name]) && (
                        <div className="text-xs text-muted-foreground mt-0.5">{s.description || SERVICE_DESCRIPTIONS[s.name]}</div>
                      )}
                    </td>
                    <td className="py-2.5 text-right text-foreground tabular-nums align-top">
                      ${Number(s.price).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {hasDiscount && (
                  <>
                    <tr className="border-t-2 border-[#2D8C6F]/30">
                      <td className="pt-2 text-muted-foreground text-xs">Subtotal</td>
                      <td className="pt-2 text-right text-muted-foreground text-xs tabular-nums">
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
                  <td className="pt-3 font-bold text-foreground">Total</td>
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

        {/* Paid receipt */}
        {showReceipt && (
          <div className="bg-card rounded-2xl shadow-sm border border-[#2D8C6F]/20 px-5 py-6 text-center">
            <div className="w-12 h-12 bg-[#2D8C6F]/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-[#2D8C6F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-foreground font-bold text-lg" style={{ fontFamily: FONTS.display }}>
              Paid — thank you!
            </p>
            <p className="text-xs text-muted-foreground mt-1">Invoice {invoice!.invoice_number}</p>
            <div className="mt-4 pt-4 border-t border-[#2D8C6F]/15 text-sm space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Service</span>
                <span className="tabular-nums">${Number(invoice!.amount).toFixed(2)}</span>
              </div>
              {tipPaid > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tip</span>
                  <span className="tabular-nums">${tipPaid.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-foreground font-bold pt-1">
                <span>Total paid</span>
                <span className="tabular-nums">${(Number(invoice!.amount) + tipPaid).toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Pay card (accepted + unpaid) */}
        {showPayCard && (
          <>
            <div className="bg-[#2D8C6F]/10 dark:bg-[#2D8C6F]/15 rounded-2xl border border-[#2D8C6F]/20 px-5 py-4 text-center">
              <p className="text-sm text-foreground font-semibold">Quote accepted — you&apos;re on the schedule.</p>
              <p className="text-xs text-muted-foreground mt-1">Pay securely below whenever you&apos;re ready.</p>
            </div>
            <QuotePayCard
              token={quote.token}
              serviceTotal={Number(invoice!.amount)}
              invoiceNumber={invoice!.invoice_number}
              onPaid={() => setPaid(true)}
            />
          </>
        )}

        {/* Prep + agreement + action buttons only while still deciding */}
        {showActionButtons && (
          <>
            {/* Prep Instructions */}
            <div className="bg-card rounded-2xl shadow-sm border border-[#2D8C6F]/10 overflow-hidden">
              <div className="px-5 py-3 border-b border-[#2D8C6F]/10">
                <h2 className="text-sm font-bold text-foreground">Service Prep Instructions</h2>
              </div>
              <div className="px-5 py-4 space-y-2">
                {prepInstructions.map((instruction, i) => (
                  <div key={i} className="flex gap-2.5 text-sm text-foreground/80">
                    <span className="text-[#2D8C6F] mt-0.5 shrink-0">&#8226;</span>
                    <span>{instruction}</span>
                  </div>
                ))}
                <div className="flex gap-2.5 text-sm text-foreground/80">
                  <span className="text-[#2D8C6F] mt-0.5 shrink-0">&#8226;</span>
                  <span>
                    Our team will treat your property with care. If you have any concerns, let us
                    know before we begin.
                  </span>
                </div>
              </div>
            </div>

            {/* Service Agreement */}
            <div className="bg-[#2D8C6F]/10 dark:bg-[#2D8C6F]/15 rounded-2xl border border-[#2D8C6F]/20 px-5 py-4">
              <h2 className="text-xs font-bold text-[#2D8C6F] uppercase tracking-wide mb-2">
                Service Agreement
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                By accepting this quote, you agree that Dr. Squeegee is not liable for: pre-existing
                damage, items left in the service area, or damage resulting from conditions beyond
                our control (deteriorated surfaces, improper installation, etc.). Service is
                weather-dependent and may be rescheduled.
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-2">
                You also agree to receive text messages from Dr. Squeegee about this job
                (confirmation, appointment reminders, invoice). Msg &amp; data rates may apply. Reply
                STOP to opt out at any time.
              </p>
            </div>

            {quote.status === "help" && (
              <div className="bg-card rounded-2xl shadow-sm border border-[#2D8C6F]/10 px-5 py-4 text-center">
                <p className="text-3xl mb-2">&#128172;</p>
                <p className="text-foreground font-medium text-sm">Got it! Anthony will reach out shortly.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Got your answer? You can still accept or decline below.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => handleAction("accepted")}
                disabled={submitting}
                className="w-full h-14 rounded-xl bg-[#2D8C6F] hover:bg-[#1F6B54] active:bg-[#175C47] text-white font-bold text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Accept Quote
              </button>
              <button
                onClick={() => handleAction("help")}
                disabled={submitting}
                className="w-full h-14 rounded-xl bg-card hover:bg-muted text-foreground font-semibold text-base border border-[#2D8C6F]/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                I Have Questions
              </button>
              <button
                onClick={() => handleAction("declined")}
                disabled={submitting}
                className="w-full h-14 rounded-xl bg-card hover:bg-[#B8453A]/5 active:bg-[#B8453A]/10 text-[#B8453A] font-semibold text-base border border-[#B8453A]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Decline
              </button>
            </div>
          </>
        )}

        {/* Declined terminal state */}
        {quote.status === "declined" && (
          <div className="bg-card rounded-2xl shadow-sm border border-[#2D8C6F]/10 px-5 py-6 text-center">
            <p className="text-4xl mb-3">&#128075;</p>
            <p className="text-foreground font-medium text-base">Got it! We&apos;ll remove you from our list.</p>
          </div>
        )}

        {/* Accepted but no invoice yet (fallback) */}
        {quote.status === "accepted" && !invoice && !paid && (
          <div className="bg-card rounded-2xl shadow-sm border border-[#2D8C6F]/10 px-5 py-6 text-center">
            <div className="w-12 h-12 bg-[#2D8C6F]/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-[#2D8C6F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-foreground font-medium text-base">
              Quote accepted! Anthony from Dr. Squeegee will reach out shortly to confirm your appointment.
            </p>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pb-4" style={{ fontFamily: FONTS.display }}>
          Dr. Squeegee &middot; House Calls for a Cleaner Home
        </p>
      </div>
    </div>
  )
}
