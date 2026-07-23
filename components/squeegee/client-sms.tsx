"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MessageSquare, Check, ShieldCheck } from "lucide-react"

export function ClientSms({
  clientId,
  name,
  phone,
  initialConsent,
}: {
  clientId: string
  name: string
  phone: string | null
  initialConsent: boolean
}) {
  const first = (name || "there").trim().split(/\s+/)[0]
  const [msg, setMsg] = useState(`Hi ${first}, it's Dr. Squeegee — `)
  const [consent, setConsent] = useState(initialConsent)
  const [recordConsent, setRecordConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  if (!phone) return null

  async function send() {
    setBusy(true)
    setResult(null)
    const res = await fetch("/api/crm/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        body: msg,
        client_id: clientId,
        set_consent: recordConsent || undefined,
        kind: "manual",
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (data.ok) {
      setResult(data.test ? "Sent (test mode → your cell)" : "Sent ✓")
      if (recordConsent) setConsent(true)
    } else {
      setResult(`Not sent: ${data.reason ?? "error"}`)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#2D8C6F]" /> Text {first}
          {consent ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 font-medium inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Consented
            </span>
          ) : (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 font-medium">
              No consent on file
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#2D8C6F] focus:ring-1 focus:ring-[#2D8C6F]"
        />
        <p className="text-xs text-muted-foreground">&quot;Reply STOP to opt out&quot; is added automatically.</p>
        {!consent && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={recordConsent} onChange={(e) => setRecordConsent(e.target.checked)} className="h-4 w-4 accent-[#2D8C6F]" />
            Customer agreed to receive texts (record consent)
          </label>
        )}
        <div className="flex items-center gap-3">
          <Button onClick={send} disabled={busy || !msg.trim()} className="bg-[#2D8C6F] hover:bg-[#1F6B54]">
            {busy ? "Sending…" : result?.startsWith("Sent") ? <><Check className="h-4 w-4 mr-1.5" /> {result}</> : "Send text"}
          </Button>
          {result && !result.startsWith("Sent") && <span className="text-sm text-amber-600">{result}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
