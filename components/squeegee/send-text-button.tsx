"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Send, Check, Loader2, MessageSquare } from "lucide-react"

// One-click send from the Dr. Squeegee business line. Posts to the CRM send
// route (sends from the 704, logs to sms_messages, opt-out is absolute). Use
// anywhere the CRM used to copy text or open an sms: link on Anthony's phone.
export function SendTextButton({
  phone,
  body,
  kind = "manual",
  clientId,
  label = "Send text",
  sentLabel = "Sent",
  size = "sm",
  variant = "outline",
  iconOnly = false,
  className,
  onSent,
}: {
  phone: string | null | undefined
  body: string
  kind?: string
  clientId?: string | null
  label?: string
  sentLabel?: string
  size?: "sm" | "default" | "icon"
  variant?: "outline" | "default" | "ghost"
  iconOnly?: boolean
  className?: string
  onSent?: () => void
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [reason, setReason] = useState<string | null>(null)

  async function send() {
    if (!phone || state === "sending") return
    setState("sending")
    setReason(null)
    try {
      const res = await fetch("/api/crm/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, body, kind, client_id: clientId ?? undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.ok) {
        setState("sent")
        onSent?.()
        setTimeout(() => setState("idle"), 2500)
      } else {
        setState("error")
        setReason(data.reason ?? "failed")
        setTimeout(() => setState("idle"), 4000)
      }
    } catch {
      setState("error")
      setReason("network")
      setTimeout(() => setState("idle"), 4000)
    }
  }

  const disabled = !phone || state === "sending"
  const icon =
    state === "sending" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
    state === "sent" ? <Check className="h-3.5 w-3.5" /> :
    iconOnly ? <MessageSquare className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />

  const text =
    state === "sending" ? "Sending…" :
    state === "sent" ? sentLabel :
    state === "error" ? (reason === "opted out" ? "Opted out" : reason === "no consent" ? "No consent" : "Failed") :
    label

  return (
    <Button
      type="button"
      size={size}
      variant={state === "error" ? "outline" : variant}
      disabled={disabled}
      onClick={send}
      className={className}
      title={!phone ? "No phone number on file" : label}
    >
      {icon}
      {!iconOnly && <span className={size === "icon" ? "sr-only" : "ml-1.5"}>{text}</span>}
    </Button>
  )
}
