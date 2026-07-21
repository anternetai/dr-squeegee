"use client"

// One-screen New Quote flow — replaces "create client → create job → create quote"
// with a single form + a single submit. Posts to /api/squeegee/quotes/full, which
// upserts the client, creates the job, and creates the quote (via the same
// createQuote() helper the per-job quote route uses).
import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Search,
  UserPlus,
  X,
  Loader2,
  Check,
  Copy,
  ExternalLink,
  Send,
  CalendarCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate, formatTime } from "@/lib/squeegee/utils"
import { SmartQuoteLines, QuoteLine, linesToServices } from "@/components/squeegee/smart-quote-lines"

interface ClientOption {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
}

interface Props {
  clients: ClientOption[]
  /**
   * Prefill from a "New Quote" link elsewhere in the CRM (job detail, client
   * detail). A real `id` selects the existing client outright; an empty `id`
   * (job predates client_id linking) just pre-fills the new-client fields.
   */
  initialClient?: ClientOption | null
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className={cn("gap-1.5 h-9", copied && "border-green-500 text-green-600")}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : "Copy"}
    </Button>
  )
}

export function QuickQuoteFlow({ clients, initialClient }: Props) {
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(
    initialClient?.id ? initialClient : null
  )
  const [search, setSearch] = useState(initialClient?.id ? initialClient.name : "")
  const [showResults, setShowResults] = useState(false)

  const [newClientName, setNewClientName] = useState(!initialClient?.id ? initialClient?.name ?? "" : "")
  const [newClientPhone, setNewClientPhone] = useState(!initialClient?.id ? initialClient?.phone ?? "" : "")
  const [newClientEmail, setNewClientEmail] = useState(!initialClient?.id ? initialClient?.email ?? "" : "")
  const [newClientAddress, setNewClientAddress] = useState(!initialClient?.id ? initialClient?.address ?? "" : "")

  const [lines, setLines] = useState<QuoteLine[]>([])
  const [discountType, setDiscountType] = useState<"percent" | "dollar">("dollar")
  const [discountValue, setDiscountValue] = useState("")

  // Optional scheduling — set a slot right here instead of a second trip to
  // the job page. Wired through to the same Cal.com schedule endpoint the
  // job detail Schedule card uses.
  const [apptDate, setApptDate] = useState("")
  const [apptTime, setApptTime] = useState("")
  const [scheduling, setScheduling] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    token: string
    job_id: string
    quote_url: string
    scheduled: boolean
    scheduleError: string | null
  } | null>(null)

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    const qDigits = q.replace(/\D/g, "")
    return clients
      .filter((c) => {
        if (c.name.toLowerCase().includes(q)) return true
        if (qDigits.length > 0 && (c.phone ?? "").replace(/\D/g, "").includes(qDigits)) return true
        return false
      })
      .slice(0, 8)
  }, [search, clients])

  const clientName = selectedClient ? selectedClient.name : newClientName
  const clientPhone = selectedClient ? selectedClient.phone ?? "" : newClientPhone
  const clientEmail = selectedClient ? selectedClient.email ?? "" : newClientEmail
  const address = selectedClient ? selectedClient.address ?? "" : newClientAddress

  const services = linesToServices(lines)
  const subtotal = services.reduce((sum, s) => sum + s.price, 0)
  const discountNum = parseFloat(discountValue) || 0
  const discountAmount =
    discountType === "percent" ? Math.round(subtotal * (discountNum / 100) * 100) / 100 : discountNum
  const total = Math.max(0, subtotal - discountAmount)

  // Date + time must both be set or both blank — a lone date/time can't book a Cal.com slot.
  const scheduleIncomplete = Boolean(apptDate) !== Boolean(apptTime)
  const canSubmit =
    clientName.trim().length > 0 && address.trim().length > 0 && services.length > 0 && !scheduleIncomplete

  function pickClient(c: ClientOption) {
    setSelectedClient(c)
    setSearch(c.name)
    setShowResults(false)
  }

  function clearClient() {
    setSelectedClient(null)
    setSearch("")
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/squeegee/quotes/full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClient?.id ?? null,
          client_name: clientName.trim(),
          client_phone: clientPhone.trim() || null,
          client_email: clientEmail.trim() || null,
          address: address.trim(),
          services,
          discount_type: discountAmount > 0 ? discountType : null,
          discount_value: discountAmount > 0 ? discountNum : 0,
        }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to create quote")
      }

      const data = (await res.json()) as { token: string; job_id: string; quote_url: string }

      let scheduled = false
      let scheduleError: string | null = null
      if (apptDate && apptTime) {
        setScheduling(true)
        try {
          const schedRes = await fetch(`/api/squeegee/jobs/${data.job_id}/schedule`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: apptDate, time: apptTime }),
          })
          if (schedRes.ok) {
            scheduled = true
          } else {
            const schedData = (await schedRes.json()) as { error?: string }
            scheduleError = schedData.error ?? "Failed to schedule"
          }
        } catch {
          scheduleError = "Network error — job was not scheduled."
        } finally {
          setScheduling(false)
        }
      }

      setResult({ ...data, scheduled, scheduleError })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    const smsParts = [
      `Hey ${clientName.split(" ")[0]}! This is Anthony from Dr. Squeegee. Here's your quote: ${result.quote_url}`,
      address ? `Service address: ${address}` : null,
      result.scheduled && apptDate && apptTime
        ? `We've got you scheduled for ${formatDate(apptDate)} at ${formatTime(apptTime)}.`
        : null,
    ].filter(Boolean)
    const smsBody = smsParts.join(" ")
    return (
      <Card className="border-[#3A6B4C]/30">
        <CardContent className="p-6 space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-[#3A6B4C]/10 flex items-center justify-center mx-auto">
            <Check className="h-6 w-6 text-[#3A6B4C]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Quote sent</h2>
            <p className="text-sm text-muted-foreground">
              {clientName} · ${total.toFixed(2)}
            </p>
            {apptDate && apptTime && (
              <p className="text-xs mt-1">
                {result.scheduled ? (
                  <span className="text-[#3A6B4C]">
                    Scheduled {formatDate(apptDate)} at {formatTime(apptTime)}
                  </span>
                ) : (
                  <span className="text-destructive">
                    {result.scheduleError ?? "Scheduling failed"} — schedule it from the job page.
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="bg-muted rounded-lg p-3 text-left space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Quote Link</p>
            <code className="text-xs break-all block text-foreground">{result.quote_url}</code>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <CopyButton text={result.quote_url} />
            {clientPhone && (
              <Button asChild size="sm" className="gap-1.5 bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white">
                <a href={`sms:${clientPhone.replace(/[^\d+]/g, "")}&body=${encodeURIComponent(smsBody)}`}>
                  <Send className="h-3.5 w-3.5" />
                  Text it
                </a>
              </Button>
            )}
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <a href={result.quote_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </a>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5 border-[#2D8C6F]/40 text-[#2D8C6F] hover:bg-[#2D8C6F]/5">
              <Link href={`/crm/jobs/${result.job_id}`}>
                <CalendarCheck className="h-3.5 w-3.5" />
                Open job to schedule →
              </Link>
            </Button>
          </div>

          <button
            type="button"
            onClick={() => {
              setResult(null)
              setSelectedClient(null)
              setSearch("")
              setNewClientName("")
              setNewClientPhone("")
              setNewClientEmail("")
              setNewClientAddress("")
              setLines([])
              setDiscountValue("")
              setApptDate("")
              setApptTime("")
            }}
            className="text-sm text-[#3A6B4C] hover:underline"
          >
            Create another quote
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      {/* Client */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client</p>

          {selectedClient ? (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-[#3A6B4C]/30 bg-[#3A6B4C]/5 p-3">
              <div className="min-w-0">
                <p className="font-medium text-sm">{selectedClient.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[selectedClient.phone, selectedClient.email].filter(Boolean).join(" · ") || "No contact info"}
                </p>
                <p className="text-xs text-muted-foreground truncate">{selectedClient.address || "No address on file"}</p>
              </div>
              <button
                type="button"
                onClick={clearClient}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Change client"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search existing clients by name or phone…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setShowResults(true)
                  }}
                  onFocus={() => setShowResults(true)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
              {showResults && matches.length > 0 && (
                <div className="rounded-md border border-border divide-y divide-border overflow-hidden">
                  {matches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pickClient(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <span className="font-medium">{c.name}</span>
                      {c.phone && <span className="text-muted-foreground"> · {c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}

              <div className="border-t pt-3 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <UserPlus className="h-3.5 w-3.5" />
                  Or add a new client
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="new_client_name" className="text-xs">
                      Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="new_client_name"
                      placeholder="Jane Smith"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new_client_phone" className="text-xs">Phone</Label>
                    <Input
                      id="new_client_phone"
                      type="tel"
                      placeholder="(704) 555-1234"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="new_client_email" className="text-xs">Email</Label>
                    <Input
                      id="new_client_email"
                      type="email"
                      placeholder="jane@example.com"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="new_client_address" className="text-xs">
                      Address <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="new_client_address"
                      placeholder="123 Main St, Charlotte, NC 28201"
                      value={newClientAddress}
                      onChange={(e) => setNewClientAddress(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Services */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Services</p>
          <SmartQuoteLines lines={lines} onChange={setLines} />
        </CardContent>
      </Card>

      {/* Schedule (optional) — books the Cal.com slot right after the quote/job are created */}
      {services.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Schedule now (optional)
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1 flex-1 min-w-[140px]">
                <Label htmlFor="appt_date" className="text-xs">Date</Label>
                <Input
                  id="appt_date"
                  type="date"
                  value={apptDate}
                  onChange={(e) => setApptDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1 flex-1 min-w-[120px]">
                <Label htmlFor="appt_time" className="text-xs">Time</Label>
                <Input
                  id="appt_time"
                  type="time"
                  value={apptTime}
                  onChange={(e) => setApptTime(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            {(apptDate || apptTime) && (
              <p className="text-xs text-muted-foreground">
                Leave both blank to skip — you can always schedule later from the job page.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Discount + total */}
      {services.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Discount (optional)
            </p>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border overflow-hidden h-8">
                <button
                  type="button"
                  onClick={() => setDiscountType("dollar")}
                  className={cn(
                    "px-2.5 text-xs font-medium transition-colors",
                    discountType === "dollar" ? "bg-[#3A6B4C] text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  $
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType("percent")}
                  className={cn(
                    "px-2.5 text-xs font-medium transition-colors",
                    discountType === "percent" ? "bg-[#3A6B4C] text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  %
                </button>
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="h-8 w-24 text-sm"
              />
              {discountAmount > 0 && (
                <span className="text-xs text-muted-foreground">−${discountAmount.toFixed(2)} off</span>
              )}
            </div>

            <div className="border-t pt-3 space-y-1">
              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">${subtotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-base font-bold tabular-nums">${total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {scheduleIncomplete && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          Set both a date and a time to schedule, or clear both to skip.
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit || loading}
        className="w-full h-12 bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white text-sm font-medium"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {scheduling ? "Scheduling…" : "Creating…"}
          </>
        ) : (
          "Create & Send Quote"
        )}
      </Button>
    </div>
  )
}
