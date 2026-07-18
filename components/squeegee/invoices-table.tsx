"use client"

// Invoice list + bulk "mark paid" — kills the one-at-a-time click-through when a
// backlog of invoices are actually already paid (cash/Zelle/check, no Stripe webhook).
// Posts sequentially to the EXISTING /api/squeegee/invoices/[id]/mark-paid route —
// no new API needed, just a picker + progress bar wrapped around it.
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { SqueegeeInvoice } from "@/lib/squeegee/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

type InvoiceStatus = SqueegeeInvoice["status"]
type PaymentMethod = "cash" | "zelle" | "check"

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
}

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "zelle", label: "Zelle" },
  { value: "check", label: "Check" },
]

export interface InvoiceRow extends SqueegeeInvoice {
  job_client_name?: string | null
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function InvoicesTable({ invoices }: { invoices: InvoiceRow[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [method, setMethod] = useState<PaymentMethod>("cash")
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [failedCount, setFailedCount] = useState(0)

  const unpaidIds = useMemo(
    () => invoices.filter((i) => i.status !== "paid").map((i) => i.id),
    [invoices]
  )
  const allSelected = unpaidIds.length > 0 && selected.size === unpaidIds.length

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(unpaidIds))
  }

  async function markSelectedPaid() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setProcessing(true)
    setFailedCount(0)
    setProgress({ done: 0, total: ids.length })

    let failures = 0
    for (let i = 0; i < ids.length; i++) {
      try {
        const res = await fetch(`/api/squeegee/invoices/${ids[i]}/mark-paid`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_method: method }),
        })
        if (!res.ok) failures++
      } catch {
        failures++
      }
      setProgress({ done: i + 1, total: ids.length })
    }

    setFailedCount(failures)
    setSelected(new Set())
    setProcessing(false)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <Card className="border-[#2D8C6F]/30 bg-[#2D8C6F]/5">
          <div className="p-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">
              {selected.size} invoice{selected.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-1 rounded-md border overflow-hidden h-8">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={cn(
                    "px-2.5 text-xs font-medium transition-colors h-full",
                    method === m.value
                      ? "bg-[#2D8C6F] text-white"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              onClick={markSelectedPaid}
              disabled={processing}
              className="bg-[#2D8C6F] hover:bg-[#1F6B54] text-white gap-1.5"
            >
              {processing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Marking {progress?.done}/{progress?.total}…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark selected paid
                </>
              )}
            </Button>
            {!processing && failedCount > 0 && (
              <span className="text-xs text-destructive">{failedCount} failed — try again</span>
            )}
          </div>
        </Card>
      )}

      {/* Desktop table */}
      <div className="hidden md:block">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 w-8">
                    {unpaidIds.length > 0 && (
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all unpaid" />
                    )}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice #</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Job</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => {
                  const selectable = inv.status !== "paid"
                  return (
                    <tr key={inv.id} className="hover:bg-muted/40 transition-colors group">
                      <td className="px-4 py-3">
                        {selectable && (
                          <Checkbox
                            checked={selected.has(inv.id)}
                            onCheckedChange={() => toggle(inv.id)}
                            aria-label={`Select invoice ${inv.invoice_number}`}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        <Link href={`/crm/jobs/${inv.job_id}`} className="block">{inv.invoice_number}</Link>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/crm/jobs/${inv.job_id}`} className="block">{inv.job_client_name || "—"}</Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/crm/jobs/${inv.job_id}`} className="block">
                          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[inv.status]}`}>
                            {STATUS_LABEL[inv.status]}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        <Link href={`/crm/jobs/${inv.job_id}`} className="block">{formatDate(inv.due_date)}</Link>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        <Link href={`/crm/jobs/${inv.job_id}`} className="block">${Number(inv.amount).toFixed(2)}</Link>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/crm/jobs/${inv.job_id}`} className="text-xs text-[#3A6B4C] group-hover:underline">
                          View Job →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {invoices.map((inv) => {
          const selectable = inv.status !== "paid"
          return (
            <Card key={inv.id} className="hover:shadow-md transition-shadow">
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {selectable && (
                      <Checkbox
                        checked={selected.has(inv.id)}
                        onCheckedChange={() => toggle(inv.id)}
                        className="mt-0.5"
                        aria-label={`Select invoice ${inv.invoice_number}`}
                      />
                    )}
                    <Link href={`/crm/jobs/${inv.job_id}`} className="min-w-0">
                      <p className="font-medium truncate">{inv.job_client_name || "Unknown client"}</p>
                      <p className="text-xs font-mono text-muted-foreground">{inv.invoice_number}</p>
                    </Link>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[inv.status]}`}>
                    {STATUS_LABEL[inv.status]}
                  </span>
                </div>
                <Link href={`/crm/jobs/${inv.job_id}`} className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Due {formatDate(inv.due_date)}</p>
                  <p className="font-bold">${Number(inv.amount).toFixed(2)}</p>
                </Link>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
