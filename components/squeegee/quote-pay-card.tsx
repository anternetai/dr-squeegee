"use client"

import { useEffect, useMemo, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import {
  Elements,
  PaymentElement,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { useTheme } from "next-themes"
import {
  stripeAppearance,
  STRIPE_ELEMENT_FONTS,
  tipTiers,
  maxTip,
} from "@/lib/squeegee/stripe-appearance"
import { FONTS } from "@/lib/squeegee/brand"

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null

interface Props {
  token: string
  serviceTotal: number
  invoiceNumber: string
  onPaid: () => void
}

export function QuotePayCard({ token, serviceTotal, invoiceNumber, onPaid }: Props) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [tip, setTip] = useState(0)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only mount guard for theme-dependent Elements
  useEffect(() => setMounted(true), [])

  const theme = resolvedTheme === "dark" ? "dark" : "light"
  const amountCents = Math.round((serviceTotal + tip) * 100)

  // Elements options change with tip (amount) and theme (appearance);
  // react-stripe-js calls elements.update() for these without a remount.
  const options = useMemo(
    () => ({
      mode: "payment" as const,
      amount: amountCents,
      currency: "usd",
      appearance: stripeAppearance(theme),
      fonts: STRIPE_ELEMENT_FONTS,
    }),
    [amountCents, theme]
  )

  if (!mounted) {
    return <PayCardSkeleton />
  }

  if (!stripePromise) {
    return (
      <div className="rounded-2xl border border-[#2D8C6F]/20 bg-card px-5 py-6 text-center text-sm text-muted-foreground">
        Online payment is being set up. Anthony will text you a secure payment link.
      </div>
    )
  }

  return (
    // Keyed on theme so a light/dark toggle cleanly re-applies the Elements
    // appearance; tip changes flow through options.amount without remounting.
    <Elements key={theme} stripe={stripePromise} options={options}>
      <PayForm
        token={token}
        serviceTotal={serviceTotal}
        tip={tip}
        setTip={setTip}
        invoiceNumber={invoiceNumber}
        onPaid={onPaid}
      />
    </Elements>
  )
}

interface FormProps {
  token: string
  serviceTotal: number
  tip: number
  setTip: (n: number) => void
  invoiceNumber: string
  onPaid: () => void
}

function PayForm({ token, serviceTotal, tip, setTip, invoiceNumber, onPaid }: FormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customMode, setCustomMode] = useState(false)
  const [customValue, setCustomValue] = useState("")
  const [walletReady, setWalletReady] = useState(false)

  const tiers = useMemo(() => tipTiers(serviceTotal), [serviceTotal])
  const cap = maxTip(serviceTotal)
  const total = serviceTotal + tip

  function selectTier(value: number) {
    setCustomMode(false)
    setCustomValue("")
    setTip(value)
  }

  function onCustomChange(raw: string) {
    setCustomValue(raw)
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) {
      setTip(0)
      return
    }
    setTip(Math.min(Math.round(n * 100) / 100, cap))
  }

  // Create/refresh the PaymentIntent server-side (authoritative amount) and
  // return its client secret. Returns null on error or if already paid.
  async function createIntent(): Promise<string | null> {
    const res = await fetch(`/api/squeegee/quotes/${token}/payment-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tip_amount: tip }),
    })
    const json = (await res.json().catch(() => ({}))) as {
      clientSecret?: string
      alreadyPaid?: boolean
      error?: string
    }
    if (json.alreadyPaid) {
      onPaid()
      return null
    }
    if (!res.ok || !json.clientSecret) {
      setError(json.error ?? "Could not start payment. Please try again.")
      return null
    }
    return json.clientSecret
  }

  async function runConfirm(clientSecret: string) {
    if (!stripe || !elements) return
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/q/${token}`,
      },
      redirect: "if_required",
    })
    if (confirmError) {
      setError(confirmError.message ?? "Payment could not be completed.")
      setSubmitting(false)
    } else {
      // Succeeded inline (no redirect). The webhook finalizes the DB.
      onPaid()
    }
  }

  async function handlePay() {
    if (!stripe || !elements || submitting) return
    setSubmitting(true)
    setError(null)
    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message ?? "Please check your payment details.")
      setSubmitting(false)
      return
    }
    const clientSecret = await createIntent()
    if (!clientSecret) {
      if (!error) setSubmitting(false)
      return
    }
    await runConfirm(clientSecret)
  }

  async function handleExpressConfirm() {
    if (!stripe || !elements || submitting) return
    setSubmitting(true)
    setError(null)
    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message ?? "Please check your payment details.")
      setSubmitting(false)
      return
    }
    const clientSecret = await createIntent()
    if (!clientSecret) {
      if (!error) setSubmitting(false)
      return
    }
    await runConfirm(clientSecret)
  }

  return (
    <div className="rounded-2xl border border-[#2D8C6F]/20 bg-card shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2D8C6F]/15 bg-[#2D8C6F]">
        <h2 className="text-base font-bold text-white" style={{ fontFamily: FONTS.display }}>
          Pay Securely
        </h2>
        <p className="text-xs text-white/75 mt-0.5">Invoice {invoiceNumber}</p>
      </div>

      <div className="px-5 py-5 space-y-5">
        {/* Tip picker */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-sm font-semibold text-foreground">Add a tip?</span>
            <span className="text-xs text-muted-foreground">Optional</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tiers.map((t) => {
              const active = !customMode && tip === t.value
              return (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => selectTier(t.value)}
                  className={
                    "h-11 rounded-xl border text-sm font-semibold transition-colors " +
                    (active
                      ? "border-[#2D8C6F] bg-[#2D8C6F] text-white"
                      : "border-[#2D8C6F]/20 bg-transparent text-foreground hover:border-[#2D8C6F]/50")
                  }
                >
                  {t.label}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              setCustomMode(true)
              setTip(0)
            }}
            className={
              "mt-2 text-xs font-medium underline-offset-2 hover:underline " +
              (customMode ? "text-[#2D8C6F]" : "text-muted-foreground")
            }
          >
            Enter a custom amount
          </button>
          {customMode && (
            <div className="mt-2 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/60 text-sm">$</span>
              <input
                type="number"
                min={0}
                max={cap}
                step="0.01"
                inputMode="decimal"
                value={customValue}
                onChange={(e) => onCustomChange(e.target.value)}
                placeholder="0.00"
                className="w-full h-11 rounded-xl border border-[#2D8C6F]/20 bg-transparent pl-7 pr-3 text-sm text-foreground focus:border-[#2D8C6F] focus:outline-none tabular-nums"
              />
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Tips go straight to the crew — never expected, always appreciated.
          </p>
        </div>

        {/* Wallets (Apple Pay / Google Pay) — only renders if available */}
        <div className={walletReady ? "" : "hidden"}>
          <ExpressCheckoutElement
            onReady={(e) => setWalletReady(!!e.availablePaymentMethods)}
            onConfirm={handleExpressConfirm}
          />
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#2D8C6F]/15" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-xs text-muted-foreground">or pay with card</span>
            </div>
          </div>
        </div>

        {/* Card fields */}
        <PaymentElement options={{ layout: "tabs" }} />

        {error && (
          <p className="text-sm text-[#B8453A] font-medium">{error}</p>
        )}

        <button
          type="button"
          onClick={handlePay}
          disabled={submitting || !stripe}
          className="w-full h-14 rounded-xl bg-[#2D8C6F] hover:bg-[#1F6B54] active:bg-[#175C47] text-white font-bold text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ fontFamily: FONTS.display }}
        >
          {submitting ? "Processing…" : `Pay $${total.toFixed(2)}`}
        </button>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Service</span>
          <span className="tabular-nums">${serviceTotal.toFixed(2)}</span>
        </div>
        {tip > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground -mt-3">
            <span>Tip</span>
            <span className="tabular-nums">${tip.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function PayCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#2D8C6F]/20 bg-card shadow-sm overflow-hidden animate-pulse">
      <div className="px-5 py-4 border-b border-[#2D8C6F]/15 bg-[#2D8C6F]/80 h-16" />
      <div className="px-5 py-5 space-y-4">
        <div className="h-11 rounded-xl bg-foreground/5" />
        <div className="h-24 rounded-xl bg-foreground/5" />
        <div className="h-14 rounded-xl bg-[#2D8C6F]/30" />
      </div>
    </div>
  )
}
