"use client"

import { useState, useEffect, useCallback } from "react"
import { SqueegeeInvoice, SqueegeeJob } from "@/lib/squeegee/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  FileText,
  Plus,
  Check,
  Copy,
  Loader2,
  Send,
  CreditCard,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"

type InvoiceStatus = SqueegeeInvoice["status"]

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

function getDueDateDefault(): string {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d.toISOString().split("T")[0]
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
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className={cn("h-7 px-2 gap-1 text-xs", copied && "text-green-600")}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  )
}

interface Props {
  job: SqueegeeJob
}

export function JobInvoices({ job }: Props) {
  const [invoices, setInvoices] = useState<SqueegeeInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [form, setForm] = useState({
    amount: job.price != null ? String(job.price) : "",
    due_date: getDueDateDefault(),
    notes: "",
  })

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch(`/api/squeegee/jobs/${job.id}/invoices`)
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.invoices || [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [job.id])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.amount || parseFloat(form.amount) <= 0) {
      setFormError("Amount must be greater than 0.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/squeegee/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: job.id,
          client_id: job.client_id ?? null,
          amount: parseFloat(form.amount),
          due_date: form.due_date || null,
          notes: form.notes.trim() || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setFormError(err.error || "Failed to create invoice.")
        setSubmitting(false)
        return
      }

      setShowForm(false)
      setForm({
        amount: job.price != null ? String(job.price) : "",
        due_date: getDueDateDefault(),
        notes: "",
      })
      await fetchInvoices()
    } catch {
      setFormError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function updateStatus(invoiceId: string, status: InvoiceStatus) {
    setUpdatingId(invoiceId)
    try {
      await fetch(`/api/squeegee/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      await fetchInvoices()
    } catch {
      // silent
    } finally {
      setUpdatingId(null)
    }
  }

  async function markPaid(invoiceId: string, paymentMethod: string) {
    setUpdatingId(invoiceId)
    try {
      await fetch(`/api/squeegee/invoices/${invoiceId}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method: paymentMethod }),
      })
      await fetchInvoices()
    } catch {
      // silent
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleDeleteInvoice(invoiceId: string) {
    setDeletingId(invoiceId)
    try {
      await fetch(`/api/squeegee/invoices/${invoiceId}`, { method: "DELETE" })
      await fetchInvoices()
    } catch {
      // silent
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  async function handleEditInvoice(
    invoiceId: string,
    fields: { amount?: number; due_date?: string | null; notes?: string | null }
  ) {
    setUpdatingId(invoiceId)
    try {
      await fetch(`/api/squeegee/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      })
      await fetchInvoices()
    } catch {
      // silent
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#3A6B4C]" />
            <CardTitle className="text-base">
              Invoices
              {invoices.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({invoices.length})
                </span>
              )}
            </CardTitle>
          </div>
          {!showForm && (
            <Button
              size="sm"
              onClick={() => setShowForm(true)}
              className="bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create Invoice
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Create form */}
        {showForm && (
          <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">New Invoice</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowForm(false)
                  setFormError(null)
                }}
                className="h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Amount ($) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Due Date</Label>
                  <Input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Optional invoice note…"
                  />
                </div>
              </div>

              {formError && (
                <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {formError}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  Create Invoice
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setFormError(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Invoice list */}
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Loading invoices…</span>
          </div>
        ) : invoices.length === 0 ? (
          !showForm && (
            <div className="text-center py-6 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-25" />
              <p className="text-sm">No invoices yet for this job.</p>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                isUpdating={updatingId === inv.id}
                isDeleting={deletingId === inv.id}
                confirmingDelete={confirmDeleteId === inv.id}
                onMarkSent={() => updateStatus(inv.id, "sent")}
                onMarkPaid={(method) => markPaid(inv.id, method)}
                onRequestDelete={() => setConfirmDeleteId(inv.id)}
                onCancelDelete={() => setConfirmDeleteId(null)}
                onConfirmDelete={() => handleDeleteInvoice(inv.id)}
                onEdit={(fields) => handleEditInvoice(inv.id, fields)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "zelle", label: "Zelle" },
  { value: "stripe", label: "Stripe" },
  { value: "check", label: "Check" },
] as const

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  zelle: "Zelle",
  stripe: "Stripe",
  check: "Check",
}

function InvoiceRow({
  invoice,
  isUpdating,
  isDeleting,
  confirmingDelete,
  onMarkSent,
  onMarkPaid,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onEdit,
}: {
  invoice: SqueegeeInvoice
  isUpdating: boolean
  isDeleting: boolean
  confirmingDelete: boolean
  onMarkSent: () => void
  onMarkPaid: (method: string) => void
  onRequestDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
  onEdit: (fields: { amount?: number; due_date?: string | null; notes?: string | null }) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showPaymentMethods, setShowPaymentMethods] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editAmount, setEditAmount] = useState(String(invoice.amount))
  const [editDueDate, setEditDueDate] = useState(invoice.due_date ?? "")
  const [editNotes, setEditNotes] = useState(invoice.notes ?? "")
  const [editError, setEditError] = useState<string | null>(null)

  function handleOpenEdit() {
    setEditAmount(String(invoice.amount))
    setEditDueDate(invoice.due_date ?? "")
    setEditNotes(invoice.notes ?? "")
    setEditError(null)
    setShowEditForm(true)
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    const amount = parseFloat(editAmount)
    if (isNaN(amount) || amount <= 0) {
      setEditError("Amount must be a positive number.")
      return
    }
    setEditError(null)
    setShowEditForm(false)
    onEdit({
      amount,
      due_date: editDueDate || null,
      notes: editNotes.trim() || null,
    })
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{invoice.invoice_number}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[invoice.status]}`}>
              {STATUS_LABEL[invoice.status]}
            </span>
          </div>
          {invoice.due_date && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Due {new Date(invoice.due_date + "T00:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-semibold">${Number(invoice.amount).toFixed(2)}</span>
          {/* Edit button */}
          {invoice.status !== "paid" && (
            <button
              type="button"
              title="Edit invoice"
              onClick={(e) => { e.stopPropagation(); handleOpenEdit() }}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {/* Delete controls */}
          {confirmingDelete ? (
            <div
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={onConfirmDelete}
                disabled={isDeleting}
                className="px-2 py-0.5 rounded bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete"}
              </button>
              <button
                type="button"
                onClick={onCancelDelete}
                className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              title="Delete invoice"
              onClick={(e) => { e.stopPropagation(); onRequestDelete() }}
              className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Inline edit form */}
      {showEditForm && (
        <div
          className="border-t border-[#3A6B4C]/30 px-4 py-3 bg-[#3A6B4C]/5 space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#3A6B4C]">Edit Invoice</p>
            <button
              type="button"
              onClick={() => { setShowEditForm(false); setEditError(null) }}
              className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <form onSubmit={handleSaveEdit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Amount ($) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Due Date</Label>
                <Input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Optional note…"
                  className="text-sm"
                />
              </div>
            </div>
            {editError && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {editError}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={isUpdating}
                className="bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white h-7 text-xs px-3"
              >
                {isUpdating && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-3"
                onClick={() => { setShowEditForm(false); setEditError(null) }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Expanded actions */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-muted/20 space-y-3">
          {invoice.notes && (
            <p className="text-sm text-muted-foreground">{invoice.notes}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {/* Payment link */}
            {invoice.stripe_payment_link ? (
              <CopyButton text={invoice.stripe_payment_link} />
            ) : null}

            {/* Mark Sent */}
            {invoice.status === "draft" && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 gap-1.5 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  onMarkSent()
                }}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                Mark Sent
              </Button>
            )}

            {/* Mark Paid — shows payment method picker */}
            {(invoice.status === "sent" || invoice.status === "overdue") && !showPaymentMethods && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 gap-1.5 text-xs text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowPaymentMethods(true)
                }}
                disabled={isUpdating}
              >
                <CreditCard className="h-3 w-3" />
                Mark Paid
              </Button>
            )}

            {/* Payment method buttons */}
            {showPaymentMethods && (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs text-muted-foreground mr-1">Paid via:</span>
                {PAYMENT_METHODS.map((m) => (
                  <Button
                    key={m.value}
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
                    onClick={() => {
                      onMarkPaid(m.value)
                      setShowPaymentMethods(false)
                    }}
                    disabled={isUpdating}
                  >
                    {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : m.label}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground"
                  onClick={() => setShowPaymentMethods(false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            {invoice.status === "paid" && invoice.paid_at && (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <Check className="h-3 w-3" />
                Paid{invoice.payment_method ? ` (${PAYMENT_METHOD_LABEL[invoice.payment_method] || invoice.payment_method})` : ""}{" "}
                {new Date(invoice.paid_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
