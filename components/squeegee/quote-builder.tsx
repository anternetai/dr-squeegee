"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { SqueegeeJob } from "@/lib/squeegee/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileText, Check, Copy, Loader2, ExternalLink, Trash2, Pencil, X, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

const QUOTE_SERVICES = [
  "House Washing",
  "Surface Cleaning",
  "Driveway",
  "Pool Deck",
  "Pavers",
] as const

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  "House Washing": "Soft wash of exterior siding, eaves, and trim",
  "Surface Cleaning": "High-pressure cleaning of walkways and patios",
  Driveway: "Full driveway pressure wash — oil stains, tire marks, buildup",
  "Pool Deck": "Pressure wash and surface treatment of pool deck",
  Pavers: "Paver pressure wash with joint sand preservation",
}

type QuoteService = (typeof QUOTE_SERVICES)[number]

interface QuoteRecord {
  id: string
  token: string
  services: { name: string; price: number }[]
  total_price: number
  status: "pending" | "accepted" | "declined" | "help"
  created_at: string
  client_response_at: string | null
}

const STATUS_BADGE: Record<QuoteRecord["status"], string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
  accepted: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  declined: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  help: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
}

const STATUS_LABELS: Record<QuoteRecord["status"], string> = {
  pending: "Pending",
  accepted: "Accepted ✅",
  declined: "Declined ❌",
  help: "Questions 💬",
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn(
        "gap-1.5 transition-colors h-9",
        copied && "border-green-500 text-green-600"
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : "Copy"}
    </Button>
  )
}

interface Props {
  job: SqueegeeJob
}

export function QuoteBuilder({ job }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [discountType, setDiscountType] = useState<"percent" | "dollar">("dollar")
  const [discountValue, setDiscountValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedToken, setGeneratedToken] = useState<string | null>(null)
  const [pastQuotes, setPastQuotes] = useState<QuoteRecord[]>([])
  const [loadingQuotes, setLoadingQuotes] = useState(true)
  const [deletingToken, setDeletingToken] = useState<string | null>(null)
  const [confirmDeleteToken, setConfirmDeleteToken] = useState<string | null>(null)
  const [editingQuote, setEditingQuote] = useState<QuoteRecord | null>(null)
  const [editPrices, setEditPrices] = useState<Record<string, string>>({})
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const fetchPastQuotes = useCallback(async () => {
    setLoadingQuotes(true)
    try {
      const res = await fetch(`/api/squeegee/quotes?job_id=${job.id}`)
      if (res.ok) {
        const data = (await res.json()) as QuoteRecord[]
        setPastQuotes(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoadingQuotes(false)
    }
  }, [job.id])

  useEffect(() => {
    fetchPastQuotes()
  }, [fetchPastQuotes])

  const selectedServices = QUOTE_SERVICES.filter((s) => selected[s])
  const subtotal = selectedServices.reduce((sum, s) => {
    const p = parseFloat(prices[s] ?? "")
    return sum + (isNaN(p) ? 0 : p)
  }, 0)

  const discountNum = parseFloat(discountValue) || 0
  const discountAmount =
    discountType === "percent"
      ? Math.round(subtotal * (discountNum / 100) * 100) / 100
      : discountNum
  const total = Math.max(0, subtotal - discountAmount)

  const canGenerate =
    selectedServices.length > 0 &&
    selectedServices.every((s) => {
      const p = parseFloat(prices[s] ?? "")
      return !isNaN(p) && p > 0
    })

  const quoteUrl = generatedToken
    ? `https://drsqueegeeclt.com/q/${generatedToken}`
    : null

  async function handleGenerate() {
    if (!canGenerate) return
    setLoading(true)
    setError(null)

    const services = selectedServices.map((name) => ({
      name,
      price: parseFloat(prices[name]),
    }))

    try {
      const res = await fetch("/api/squeegee/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: job.id,
          client_name: job.client_name,
          client_phone: job.client_phone,
          client_email: job.client_email,
          address: job.address,
          services,
          discount_type: discountAmount > 0 ? discountType : null,
          discount_value: discountAmount > 0 ? discountNum : 0,
        }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to create quote")
      }

      const data = (await res.json()) as { quote: { id: string; token: string } }
      setGeneratedToken(data.quote.token)
      // Refresh past quotes + page data (job status updates to "quoted")
      await fetchPastQuotes()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteQuote(token: string) {
    setDeletingToken(token)
    try {
      await fetch(`/api/squeegee/quotes/${token}`, { method: "DELETE" })
      await fetchPastQuotes()
      router.refresh()
    } catch {
      // silent
    } finally {
      setDeletingToken(null)
      setConfirmDeleteToken(null)
    }
  }

  function openEditQuote(q: QuoteRecord) {
    const prices: Record<string, string> = {}
    q.services.forEach((s) => { prices[s.name] = String(s.price) })
    setEditPrices(prices)
    setEditError(null)
    setEditingQuote(q)
  }

  async function handleSaveEdit() {
    if (!editingQuote) return
    setEditLoading(true)
    setEditError(null)

    const services = editingQuote.services.map((s) => ({
      name: s.name,
      price: parseFloat(editPrices[s.name] ?? String(s.price)),
    }))

    if (services.some((s) => isNaN(s.price) || s.price < 0)) {
      setEditError("All prices must be valid numbers.")
      setEditLoading(false)
      return
    }

    const total_price = services.reduce((sum, s) => sum + s.price, 0)

    try {
      const res = await fetch(`/api/squeegee/quotes/${editingQuote.token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services, total_price }),
      })
      if (!res.ok) {
        const d = await res.json()
        setEditError(d.error ?? "Failed to save changes.")
        return
      }
      setEditingQuote(null)
      await fetchPastQuotes()
      router.refresh()
    } catch {
      setEditError("Network error. Please try again.")
    } finally {
      setEditLoading(false)
    }
  }

  function toggleService(service: QuoteService) {
    setSelected((prev) => ({ ...prev, [service]: !prev[service] }))
    if (selected[service]) {
      setPrices((prev) => {
        const next = { ...prev }
        delete next[service]
        return next
      })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#3A6B4C]" />
          <CardTitle className="text-base">Send Quote</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Service selection */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Select Services
          </p>
          <div className="space-y-2">
            {QUOTE_SERVICES.map((service) => (
              <div key={service} className="flex items-center gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer min-w-[160px]">
                  <input
                    type="checkbox"
                    checked={!!selected[service]}
                    onChange={() => toggleService(service)}
                    className="h-4 w-4 rounded border-border accent-[#3A6B4C]"
                  />
                  <div>
                    <span className="text-sm font-medium">{service}</span>
                    {SERVICE_DESCRIPTIONS[service] && (
                      <p className="text-[11px] text-muted-foreground leading-tight">{SERVICE_DESCRIPTIONS[service]}</p>
                    )}
                  </div>
                </label>
                {selected[service] && (
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={prices[service] ?? ""}
                      onChange={(e) =>
                        setPrices((prev) => ({ ...prev, [service]: e.target.value }))
                      }
                      className="h-8 w-28 text-sm"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Discount */}
        {selectedServices.length > 0 && (
          <div className="space-y-2 border-t pt-3">
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
                    discountType === "dollar"
                      ? "bg-[#3A6B4C] text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  $
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType("percent")}
                  className={cn(
                    "px-2.5 text-xs font-medium transition-colors",
                    discountType === "percent"
                      ? "bg-[#3A6B4C] text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
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
                <span className="text-xs text-muted-foreground">
                  −${discountAmount.toFixed(2)} off
                </span>
              )}
            </div>
          </div>
        )}

        {/* Total */}
        {selectedServices.length > 0 && (
          <div className="border-t pt-3 space-y-1">
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">${subtotal.toFixed(2)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-sm text-green-600">
                <span>Discount ({discountType === "percent" ? `${discountNum}%` : `$${discountNum.toFixed(2)}`})</span>
                <span className="tabular-nums">−${discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-base font-bold tabular-nums">
                ${total.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            {error}
          </p>
        )}

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={!canGenerate || loading}
          className="w-full h-12 bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white text-sm font-medium"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Generate Quote Link
            </>
          )}
        </Button>

        {/* Generated link */}
        {quoteUrl && (
          <div className="space-y-2 bg-muted rounded-lg p-3">
            <p className="text-xs font-medium text-muted-foreground">Quote Link</p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs break-all flex-1 text-foreground">{quoteUrl}</code>
              <div className="flex gap-2">
                <CopyButton text={quoteUrl} />
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-9 gap-1.5"
                >
                  <a href={quoteUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </a>
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Copy and text this link to {job.client_name.split(" ")[0]}.
            </p>
          </div>
        )}

        {/* Past quotes */}
        {!loadingQuotes && pastQuotes.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Previous Quotes
            </p>
            <div className="space-y-2">
              {pastQuotes.map((q) => (
                <div key={q.id} className="space-y-0">
                  <div className="flex items-center justify-between gap-2 text-xs bg-muted/50 rounded-md px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <a
                        href={`https://drsqueegeeclt.com/q/${q.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[#3A6B4C] hover:underline truncate"
                      >
                        /q/{q.token}
                      </a>
                      <span className="text-muted-foreground hidden sm:inline">·</span>
                      <span className="text-muted-foreground hidden sm:inline tabular-nums">
                        ${Number(q.total_price).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full border text-xs font-medium whitespace-nowrap",
                          STATUS_BADGE[q.status]
                        )}
                      >
                        {STATUS_LABELS[q.status]}
                      </span>
                      {/* Edit button */}
                      <button
                        type="button"
                        onClick={() => openEditQuote(q)}
                        title="Edit quote prices"
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      {/* Delete button / confirm */}
                      {confirmDeleteToken === q.token ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteQuote(q.token)}
                            disabled={deletingToken === q.token}
                            className="px-2 py-0.5 rounded bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                          >
                            {deletingToken === q.token ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Delete"
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteToken(null)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteToken(q.token)}
                          title="Delete quote"
                          className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline edit form */}
                  {editingQuote?.token === q.token && (
                    <div className="border border-[#3A6B4C]/30 rounded-md p-3 bg-[#3A6B4C]/5 space-y-3 mt-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-[#3A6B4C]">Edit Prices</p>
                        <button
                          type="button"
                          onClick={() => { setEditingQuote(null); setEditError(null) }}
                          className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {q.services.map((s) => (
                          <div key={s.name} className="flex items-center gap-2">
                            <span className="text-xs flex-1">{s.name}</span>
                            <span className="text-xs text-muted-foreground">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editPrices[s.name] ?? String(s.price)}
                              onChange={(e) =>
                                setEditPrices((prev) => ({ ...prev, [s.name]: e.target.value }))
                              }
                              className="w-24 h-7 rounded border border-input bg-background px-2 text-xs text-right"
                            />
                          </div>
                        ))}
                      </div>
                      {editError && (
                        <div className="flex items-center gap-1.5 text-xs text-destructive">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          {editError}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={editLoading}
                          className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#3A6B4C] text-white text-xs font-medium hover:bg-[#2F5A3F] transition-colors disabled:opacity-50"
                        >
                          {editLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                          Save Changes
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingQuote(null); setEditError(null) }}
                          className="px-3 py-1 rounded border border-input text-xs hover:bg-muted transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
