import { createClient } from "@/lib/supabase/server"
import { SqueegeeInvoice } from "@/lib/squeegee/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { FileText, DollarSign, CheckCircle2, AlertCircle } from "lucide-react"

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

interface InvoiceRow extends SqueegeeInvoice {
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

export default async function InvoicesPage() {
  const supabase = await createClient()

  // Fetch invoices — also grab job client_name via job_id
  const { data: invoices } = await supabase
    .from("squeegee_invoices")
    .select("*, squeegee_jobs(client_name)")
    .order("created_at", { ascending: false })

  const allInvoices: InvoiceRow[] = (invoices || []).map((inv) => {
    const row = inv as unknown as SqueegeeInvoice & { squeegee_jobs?: { client_name?: string } | null }
    return {
      ...row,
      job_client_name: row.squeegee_jobs?.client_name ?? null,
    }
  })

  // Revenue summary
  const totalInvoiced = allInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)
  const totalPaid = allInvoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + (inv.amount || 0), 0)
  const outstanding = allInvoices
    .filter((inv) => inv.status === "sent" || inv.status === "overdue")
    .reduce((sum, inv) => sum + (inv.amount || 0), 0)
  const overdue = allInvoices
    .filter((inv) => inv.status === "overdue")
    .reduce((sum, inv) => sum + (inv.amount || 0), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            {allInvoices.length} invoice{allInvoices.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/crm/jobs">
            <FileText className="h-4 w-4 mr-2" />
            Create from Job
          </Link>
        </Button>
      </div>

      {/* Revenue summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Invoiced</p>
            </div>
            <p className="text-xl font-bold">
              ${totalInvoiced.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <p className="text-xs text-muted-foreground">Paid</p>
            </div>
            <p className="text-xl font-bold text-green-700 dark:text-green-400">
              ${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <p className="text-xs text-muted-foreground">Outstanding</p>
            </div>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
              ${outstanding.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
            <p className="text-xl font-bold text-red-700 dark:text-red-400">
              ${overdue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices list */}
      {allInvoices.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-25" />
            <p className="font-medium mb-1">No invoices yet</p>
            <p className="text-sm mb-5">
              Create invoices from individual job pages.
            </p>
            <Button asChild variant="outline">
              <Link href="/crm/jobs">View Jobs</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice #</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Job</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/40 transition-colors group">
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
                          <Link
                            href={`/crm/jobs/${inv.job_id}`}
                            className="text-xs text-[#3A6B4C] group-hover:underline"
                          >
                            View Job →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {allInvoices.map((inv) => (
              <Link key={inv.id} href={`/crm/jobs/${inv.job_id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{inv.job_client_name || "Unknown client"}</p>
                        <p className="text-xs font-mono text-muted-foreground">{inv.invoice_number}</p>
                      </div>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[inv.status]}`}>
                        {STATUS_LABEL[inv.status]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Due {formatDate(inv.due_date)}
                      </p>
                      <p className="font-bold">${Number(inv.amount).toFixed(2)}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
