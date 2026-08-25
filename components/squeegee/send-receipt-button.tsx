"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Receipt, Check, Loader2, Copy, ExternalLink, AlertTriangle } from "lucide-react"

// Manual receipt send for a paid invoice. Covers the payments Stripe never sees
// (cash, check, Zelle) and re-sends when a customer says it never arrived.
// The Stripe webhook already fires this automatically for card payments — this
// is the "do it myself" path.
export function SendReceiptButton({
  invoiceId,
  alreadySent,
  onSent,
}: {
  invoiceId: string
  alreadySent?: boolean
  onSent?: () => void
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [reason, setReason] = useState<string | null>(null)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function send() {
    if (state === "sending") return
    setState("sending")
    setReason(null)
    try {
      const res = await fetch(`/api/squeegee/invoices/${invoiceId}/receipt`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (data.receiptUrl) setReceiptUrl(data.receiptUrl)
      if (data.ok) {
        setState("sent")
        onSent?.()
        setTimeout(() => setState("idle"), 3000)
      } else {
        setState("error")
        setReason(data.reason ?? data.error ?? "failed")
        setTimeout(() => setState("idle"), 5000)
      }
    } catch {
      setState("error")
      setReason("network")
      setTimeout(() => setState("idle"), 5000)
    }
  }

  async function copyLink() {
    if (!receiptUrl) return
    try {
      await navigator.clipboard.writeText(receiptUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the link is visible below anyway */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-3 gap-1.5 text-xs"
        onClick={(e) => {
          e.stopPropagation()
          send()
        }}
        disabled={state === "sending"}
      >
        {state === "sending" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : state === "sent" ? (
          <Check className="h-3 w-3" />
        ) : state === "error" ? (
          <AlertTriangle className="h-3 w-3" />
        ) : (
          <Receipt className="h-3 w-3" />
        )}
        {state === "sending"
          ? "Sending…"
          : state === "sent"
            ? "Receipt sent"
            : state === "error"
              ? `Not sent: ${reason}`
              : alreadySent
                ? "Re-send receipt"
                : "Send receipt"}
      </Button>

      {receiptUrl && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 gap-1 text-xs"
            onClick={(e) => {
              e.stopPropagation()
              copyLink()
            }}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy receipt link"}
          </Button>
          <a
            href={receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-[var(--crm-accent)] hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </a>
        </>
      )}
    </div>
  )
}
