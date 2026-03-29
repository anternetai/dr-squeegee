"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface Loaf {
  name: string
  price: string
}

interface OrderFormProps {
  availableLoaves: Loaf[]
  preselected: string | null
  onClose: () => void
}

interface LoafSelection {
  name: string
  qty: number
  presliced: boolean
}

const MAX_QTY = 5

export function OrderForm({ availableLoaves, preselected, onClose }: OrderFormProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [selections, setSelections] = useState<Record<string, LoafSelection>>(() => {
    const initial: Record<string, LoafSelection> = {}
    if (preselected) {
      initial[preselected] = { name: preselected, qty: 1, presliced: false }
    }
    return initial
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const dialogRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    // Prevent body scroll while modal is open
    document.body.style.overflow = "hidden"
    // Focus the dialog
    dialogRef.current?.focus()
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [handleKeyDown])

  function toggleLoaf(loafName: string) {
    setSelections((prev) => {
      const next = { ...prev }
      if (next[loafName]) {
        delete next[loafName]
      } else {
        next[loafName] = { name: loafName, qty: 1, presliced: false }
      }
      return next
    })
  }

  function updateQty(loafName: string, qty: number) {
    if (qty < 1 || qty > MAX_QTY) return
    setSelections((prev) => ({
      ...prev,
      [loafName]: { ...prev[loafName], qty },
    }))
  }

  function togglePresliced(loafName: string) {
    setSelections((prev) => ({
      ...prev,
      [loafName]: { ...prev[loafName], presliced: !prev[loafName].presliced },
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    const loaves = Object.values(selections)
    if (!name.trim() || !phone.trim() || loaves.length === 0) {
      setError("Please fill in your name, phone, and select at least one loaf.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/bumblebread/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name.trim(),
          phone: phone.trim(),
          loaves,
          notes: notes.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to submit order")
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(27,20,100,0.5)" }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Order confirmed"
      >
        <div
          className="w-full max-w-md rounded-2xl p-8 text-center"
          style={{ backgroundColor: "var(--bb-cream)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-4xl mb-4">🍞</div>
          <h3
            className="text-2xl font-bold mb-2"
            style={{ fontFamily: "var(--font-bb-heading)", color: "var(--bb-navy)" }}
          >
            You&apos;re in!
          </h3>
          <p
            className="mb-6"
            style={{ fontFamily: "var(--font-bb-body)", color: "var(--bb-text-muted)" }}
          >
            We&apos;ll text you with pickup details.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-full font-semibold transition-all hover:scale-105 cursor-pointer"
            style={{
              fontFamily: "var(--font-bb-body)",
              backgroundColor: "var(--bb-navy)",
              color: "var(--bb-cream)",
            }}
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(27,20,100,0.5)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Place your order"
      ref={dialogRef}
      tabIndex={-1}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: "var(--bb-cream)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3
            className="text-xl font-bold"
            style={{ fontFamily: "var(--font-bb-heading)", color: "var(--bb-navy)" }}
          >
            Place Your Order
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label
              htmlFor="bb-order-name"
              className="block text-sm font-medium mb-1.5"
              style={{ fontFamily: "var(--font-bb-body)", color: "var(--bb-text)" }}
            >
              Your Name
            </label>
            <input
              id="bb-order-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg border text-base outline-none transition-colors"
              style={{
                fontFamily: "var(--font-bb-body)",
                borderColor: "var(--bb-cream-dark)",
                backgroundColor: "white",
                color: "var(--bb-text)",
              }}
              placeholder="Jane Doe"
            />
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="bb-order-phone"
              className="block text-sm font-medium mb-1.5"
              style={{ fontFamily: "var(--font-bb-body)", color: "var(--bb-text)" }}
            >
              Phone Number
            </label>
            <input
              id="bb-order-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg border text-base outline-none transition-colors"
              style={{
                fontFamily: "var(--font-bb-body)",
                borderColor: "var(--bb-cream-dark)",
                backgroundColor: "white",
                color: "var(--bb-text)",
              }}
              placeholder="(704) 555-1234"
            />
          </div>

          {/* Loaf selection */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ fontFamily: "var(--font-bb-body)", color: "var(--bb-text)" }}
            >
              Select Your Loaves
            </label>
            <div className="space-y-3">
              {availableLoaves.map((loaf) => {
                const selected = !!selections[loaf.name]
                return (
                  <div
                    key={loaf.name}
                    className="rounded-lg border p-3 transition-all cursor-pointer"
                    style={{
                      borderColor: selected ? "var(--bb-gold)" : "var(--bb-cream-dark)",
                      backgroundColor: selected ? "rgba(201,168,76,0.08)" : "white",
                    }}
                    onClick={() => toggleLoaf(loaf.name)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                          style={{
                            borderColor: selected ? "var(--bb-gold)" : "#ccc",
                            backgroundColor: selected ? "var(--bb-gold)" : "transparent",
                          }}
                        >
                          {selected && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                              <path d="M2 6l3 3 5-5" />
                            </svg>
                          )}
                        </div>
                        <span
                          className="font-medium text-sm"
                          style={{ fontFamily: "var(--font-bb-heading)", color: "var(--bb-text)" }}
                        >
                          {loaf.name}
                        </span>
                      </div>
                      <span
                        className="text-sm font-bold"
                        style={{ color: "var(--bb-gold)" }}
                      >
                        {loaf.price}
                      </span>
                    </div>

                    {selected && (
                      <div
                        className="flex items-center gap-4 mt-3 pl-7"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: "var(--bb-text-muted)" }}>Qty:</span>
                          <button
                            type="button"
                            onClick={() => updateQty(loaf.name, selections[loaf.name].qty - 1)}
                            className="w-6 h-6 rounded-full border flex items-center justify-center text-sm cursor-pointer hover:bg-black/5"
                            style={{ borderColor: "var(--bb-cream-dark)" }}
                          >
                            -
                          </button>
                          <span className="text-sm font-medium w-4 text-center">
                            {selections[loaf.name].qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(loaf.name, selections[loaf.name].qty + 1)}
                            className="w-6 h-6 rounded-full border flex items-center justify-center text-sm cursor-pointer hover:bg-black/5"
                            style={{ borderColor: "var(--bb-cream-dark)" }}
                          >
                            +
                          </button>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selections[loaf.name].presliced}
                            onChange={() => togglePresliced(loaf.name)}
                            className="rounded"
                          />
                          <span className="text-xs" style={{ color: "var(--bb-text-muted)" }}>
                            Presliced
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="bb-order-notes"
              className="block text-sm font-medium mb-1.5"
              style={{ fontFamily: "var(--font-bb-body)", color: "var(--bb-text)" }}
            >
              Notes <span style={{ color: "var(--bb-text-muted)" }}>(optional)</span>
            </label>
            <textarea
              id="bb-order-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg border text-base outline-none resize-none"
              style={{
                fontFamily: "var(--font-bb-body)",
                borderColor: "var(--bb-cream-dark)",
                backgroundColor: "white",
                color: "var(--bb-text)",
              }}
              placeholder="Pickup preference, questions, etc."
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" style={{ fontFamily: "var(--font-bb-body)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-full font-semibold text-base transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            style={{
              fontFamily: "var(--font-bb-body)",
              backgroundColor: "var(--bb-gold)",
              color: "var(--bb-navy)",
            }}
          >
            {submitting ? "Submitting..." : "Place Order"}
          </button>
        </form>
      </div>
    </div>
  )
}
